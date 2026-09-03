'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache';

async function getAuthenticatedOwner() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  if (user.role?.name !== 'OWNER') {
    throw new Error('Akses ditolak. Fitur ini hanya untuk Owner / Super Admin.');
  }
  return { user, storeId: user.storeId };
}

export const getCachedRoles = unstable_cache(
  async (storeId) => {
    return await prisma.role.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  },
  ['roles'],
  { tags: ['roles'], revalidate: 3600 }
);

export async function getRoles() {
  try {
    const { storeId } = await getAuthenticatedOwner();
    const roles = await getCachedRoles(storeId);
    return { data: roles };
  } catch (error) {
    console.error('[getRoles] Error:', error);
    return { error: error.message || 'Gagal memuat data peran.' };
  }
}

/**
 * Mengambil daftar karyawan dan daftar peran (roles) untuk toko saat ini.
 * Hanya bisa diakses oleh OWNER.
 */
export async function getUsers() {
  try {
    const { storeId } = await getAuthenticatedOwner();

    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
        include: {
          role: { select: { id: true, name: true, description: true } },
          _count: {
            select: {
              ordersCreated: true,
              stockMovements: true,
              shifts: true,
            },
          },
        },
      }),
      getCachedRoles(storeId),
    ]);

    const serializedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      status: u.status,
      mustChangePassword: u.mustChangePassword,
      role: u.role,
      roleId: u.roleId,
      createdAt: u.createdAt,
      transactionCount: u._count.ordersCreated + u._count.stockMovements + u._count.shifts,
    }));

    const serializedRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));

    return { data: { users: serializedUsers, roles: serializedRoles } };
  } catch (error) {
    console.error('[getUsers] Error:', error);
    return { error: error.message || 'Gagal memuat data karyawan.' };
  }
}

/**
 * Membuat akun karyawan baru oleh Owner.
 * Menyetel flag `mustChangePassword = true` dan mencatat AuditLog.
 */
export async function createUser({
  name,
  username,
  email,
  password,
  roleId,
  status = 'ACTIVE',
}) {
  try {
    const { user: currentOwner, storeId } = await getAuthenticatedOwner();

    if (!name?.trim()) return { error: 'Nama karyawan wajib diisi.' };
    if (!username?.trim()) return { error: 'Username wajib diisi.' };
    if (!password || password.length < 6) {
      return { error: 'Password minimal 6 karakter.' };
    }
    if (!roleId) return { error: 'Role wajib dipilih.' };

    const cleanUsername = username.trim().toLowerCase();

    // Cek username unik di toko
    const existing = await prisma.user.findFirst({
      where: { storeId, username: cleanUsername },
    });
    if (existing) {
      return { error: `Username "${cleanUsername}" sudah digunakan di toko ini.` };
    }

    const role = await prisma.role.findFirst({
      where: { id: roleId, storeId },
    });
    if (!role) return { error: 'Role yang dipilih tidak valid.' };

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          storeId,
          roleId,
          name: name.trim(),
          username: cleanUsername,
          email: email?.trim() || null,
          passwordHash,
          status,
          mustChangePassword: true, // KRUSIAL: Wajib ganti password pada login pertama
        },
        include: { role: true },
      });

      // Catat AuditLog
      await tx.auditLog.create({
        data: {
          storeId,
          userId: currentOwner.id,
          action: 'CREATE_USER',
          module: 'USER_MANAGEMENT',
          entityType: 'User',
          entityId: created.id,
          changeSummary: `Owner membuat karyawan baru: ${created.name} (${cleanUsername}) dengan Role: ${role.name}`,
          afterData: {
            name: created.name,
            username: created.username,
            role: role.name,
            status: created.status,
            mustChangePassword: true,
          },
        },
      });

      return created;
    });

    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/audit');

    return {
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
      },
    };
  } catch (error) {
    console.error('[createUser] Error:', error);
    return { error: error.message || 'Gagal membuat akun karyawan.' };
  }
}

/**
 * Memperbarui profil, role, status, atau reset password karyawan.
 */
export async function updateUser({
  id,
  name,
  username,
  email,
  roleId,
  status,
  resetPassword,
}) {
  try {
    const { user: currentOwner, storeId } = await getAuthenticatedOwner();

    const targetUser = await prisma.user.findFirst({
      where: { id, storeId },
      include: { role: true },
    });
    if (!targetUser) return { error: 'Karyawan tidak ditemukan.' };

    // Proteksi: Sistem harus selalu mempertahankan minimal satu Owner ACTIVE
    if (targetUser.role?.name === 'OWNER') {
      if (status !== 'ACTIVE') {
        const otherOwners = await prisma.user.count({
          where: {
            storeId,
            role: { name: 'OWNER' },
            status: 'ACTIVE',
            id: { not: id },
          },
        });
        if (otherOwners === 0) {
          return { error: 'Tidak dapat menonaktifkan Owner satu-satunya pada sistem.' };
        }
      }
    }

    const cleanUsername = username?.trim().toLowerCase();
    if (cleanUsername && cleanUsername !== targetUser.username) {
      const existing = await prisma.user.findFirst({
        where: { storeId, username: cleanUsername, id: { not: id } },
      });
      if (existing) {
        return { error: `Username "${cleanUsername}" sudah digunakan oleh karyawan lain.` };
      }
    }

    let passwordHash = undefined;
    let mustChangePassword = undefined;

    if (resetPassword && resetPassword.trim().length > 0) {
      if (resetPassword.length < 6) {
        return { error: 'Password baru minimal 6 karakter.' };
      }
      passwordHash = await bcrypt.hash(resetPassword, 10);
      mustChangePassword = true; // Set wajib ganti password setelah di-reset
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          username: cleanUsername || undefined,
          email: email !== undefined ? (email ? email.trim() : null) : undefined,
          roleId: roleId || undefined,
          status: status || undefined,
          ...(passwordHash ? { passwordHash, mustChangePassword } : {}),
        },
        include: { role: true },
      });

      // Jika status bukan ACTIVE, batalkan seluruh sesi login aktif karyawan tersebut
      if (status && status !== 'ACTIVE') {
        await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // Catat Audit Log
      await tx.auditLog.create({
        data: {
          storeId,
          userId: currentOwner.id,
          action: resetPassword ? 'RESET_PASSWORD' : 'UPDATE_USER',
          module: 'USER_MANAGEMENT',
          entityType: 'User',
          entityId: id,
          changeSummary: resetPassword
            ? `Owner mereset password akun: ${u.name} (${u.username}). Wajib ganti password diaktifkan.`
            : `Owner memperbarui data akun: ${u.name} (${u.username}). Role: ${u.role?.name}, Status: ${u.status}`,
          beforeData: {
            name: targetUser.name,
            username: targetUser.username,
            role: targetUser.role?.name,
            status: targetUser.status,
          },
          afterData: {
            name: u.name,
            username: u.username,
            role: u.role?.name,
            status: u.status,
            passwordReset: !!resetPassword,
          },
        },
      });

      return u;
    });

    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/audit');

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
      },
    };
  } catch (error) {
    console.error('[updateUser] Error:', error);
    return { error: error.message || 'Gagal memperbarui data karyawan.' };
  }
}

/**
 * Menghapus akun karyawan jika belum memiliki riwayat transaksi atau menandainya sebagai RESIGNED.
 */
export async function deleteUser(id) {
  try {
    const { user: currentOwner, storeId } = await getAuthenticatedOwner();

    const targetUser = await prisma.user.findFirst({
      where: { id, storeId },
      include: {
        role: true,
        _count: {
          select: {
            ordersCreated: true,
            stockMovements: true,
            shifts: true,
          },
        },
      },
    });

    if (!targetUser) return { error: 'Karyawan tidak ditemukan.' };

    if (targetUser.role?.name === 'OWNER') {
      return { error: 'Akun Owner tidak dapat dihapus dari sistem.' };
    }

    const hasHistory =
      targetUser._count.ordersCreated > 0 ||
      targetUser._count.stockMovements > 0 ||
      targetUser._count.shifts > 0;

    if (hasHistory) {
      // Sesuai aturan: Pengguna yang memiliki riwayat data tidak boleh di-hard-delete
      // Melainkan ditandai sebagai RESIGNED
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { status: 'RESIGNED' },
        });

        await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            storeId,
            userId: currentOwner.id,
            action: 'MARK_RESIGNED',
            module: 'USER_MANAGEMENT',
            entityType: 'User',
            entityId: id,
            changeSummary: `Owner menandai karyawan ${targetUser.name} (${targetUser.username}) sebagai RESIGNED untuk mempertahankan integritas riwayat transaksi.`,
          },
        });
      });

      revalidatePath('/dashboard/users');
      revalidatePath('/dashboard/audit');

      return {
        success: true,
        message: `Karyawan "${targetUser.name}" memiliki riwayat transaksi sehingga otomatis ditandai status RESIGNED (akses dinonaktifkan).`,
      };
    }

    // Jika belum ada riwayat sama sekali, boleh di-delete
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: currentOwner.id,
          action: 'DELETE_USER',
          module: 'USER_MANAGEMENT',
          entityType: 'User',
          entityId: id,
          changeSummary: `Owner menghapus akun karyawan baru tanpa riwayat: ${targetUser.name} (${targetUser.username})`,
        },
      });
    });

    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/audit');

    return {
      success: true,
      message: `Karyawan "${targetUser.name}" berhasil dihapus.`,
    };
  } catch (error) {
    console.error('[deleteUser] Error:', error);
    return { error: error.message || 'Gagal menghapus data karyawan.' };
  }
}
