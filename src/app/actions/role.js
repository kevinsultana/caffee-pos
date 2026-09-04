'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { MENU_PERMISSIONS, hasPermission } from '@/lib/permissions';

/**
 * Validasi otorisasi Owner / Pengelola Akses Pengguna
 */
async function getAuthenticatedAdmin() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');

  const isOwner = user.role?.name === 'OWNER';
  const canManageUsers = hasPermission(user, 'MENU_USERS');

  if (!isOwner && !canManageUsers) {
    throw new Error('Akses ditolak. Fitur ini hanya untuk Owner atau pengguna dengan izin Manajemen Karyawan.');
  }

  return { user, storeId: user.storeId, isOwner };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET ALL ROLES
// ══════════════════════════════════════════════════════════════════════════════

export async function getRoles() {
  try {
    const { storeId } = await getAuthenticatedAdmin();

    const roles = await prisma.role.findMany({
      where: { storeId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    const allPermissionCodes = MENU_PERMISSIONS.map((p) => p.code);

    const serializedRoles = roles.map((r) => {
      // Role OWNER secara konseptual memiliki seluruh permissions
      const effectivePermissions =
        r.name === 'OWNER' ? allPermissionCodes : r.permissions || [];

      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        isSystem: r.isSystem,
        permissions: effectivePermissions,
        userCount: r._count.users,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      };
    });

    return { data: serializedRoles };
  } catch (error) {
    console.error('[role/getRoles] Error:', error);
    return { error: error.message || 'Gagal memuat daftar role.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CREATE ROLE
// ══════════════════════════════════════════════════════════════════════════════

export async function createRole({ name, description = '', permissions = [] }) {
  try {
    const { user, storeId } = await getAuthenticatedAdmin();

    if (!name?.trim()) {
      return { error: 'Nama role wajib diisi.' };
    }

    const cleanName = name.trim();

    // Guardrail: nama OWNER diproteksi
    if (cleanName.toUpperCase() === 'OWNER') {
      return { error: 'Nama role "OWNER" dilindungi untuk sistem root admin.' };
    }

    // Cek duplikasi nama di toko yang sama
    const existing = await prisma.role.findFirst({
      where: {
        storeId,
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return { error: `Role dengan nama "${cleanName}" sudah ada.` };
    }

    // Filter valid permissions
    const validCodes = new Set(MENU_PERMISSIONS.map((p) => p.code));
    const cleanPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => validCodes.has(p))
      : [];

    const newRole = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          storeId,
          name: cleanName,
          description: description?.trim() || null,
          permissions: cleanPermissions,
          isSystem: false,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'CREATE_ROLE',
          module: 'USER_MANAGEMENT',
          entityType: 'Role',
          entityId: created.id,
          changeSummary: `${user.name} membuat role kustom baru: "${cleanName}" dengan ${cleanPermissions.length} hak akses menu.`,
          afterData: {
            name: created.name,
            permissions: cleanPermissions,
          },
        },
      });

      return created;
    });

    revalidateTag('roles');
    revalidatePath('/dashboard/roles');
    revalidatePath('/dashboard/users');

    return {
      success: true,
      data: {
        ...newRole,
        userCount: 0,
        createdAt: newRole.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('[role/createRole] Error:', error);
    return { error: error.message || 'Gagal menambahkan role.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. UPDATE ROLE
// ══════════════════════════════════════════════════════════════════════════════

export async function updateRole(id, { name, description = '', permissions = [] }) {
  try {
    const { user, storeId } = await getAuthenticatedAdmin();

    if (!id) return { error: 'ID role tidak valid.' };
    if (!name?.trim()) return { error: 'Nama role wajib diisi.' };

    const cleanName = name.trim();

    // ── GUARDRAIL KRUSIAL: Proteksi Role OWNER ──────────────────────────────
    const role = await prisma.role.findFirst({
      where: { id, storeId },
    });

    if (!role) {
      return { error: 'Role tidak ditemukan.' };
    }

    if (role.name === 'OWNER') {
      return { error: 'Role OWNER adalah sistem root admin dan hak aksesnya tidak boleh diubah untuk mencegah lockout sistem.' };
    }

    if (cleanName.toUpperCase() === 'OWNER' && role.name !== 'OWNER') {
      return { error: 'Tidak dapat mengganti nama role menjadi "OWNER".' };
    }

    // Cek duplikasi jika nama berubah
    if (cleanName.toLowerCase() !== role.name.toLowerCase()) {
      const existing = await prisma.role.findFirst({
        where: {
          storeId,
          name: { equals: cleanName, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existing) {
        return { error: `Role dengan nama "${cleanName}" sudah digunakan.` };
      }
    }

    // Filter valid permissions
    const validCodes = new Set(MENU_PERMISSIONS.map((p) => p.code));
    const cleanPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => validCodes.has(p))
      : [];

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.role.update({
        where: { id },
        data: {
          name: cleanName,
          description: description?.trim() || null,
          permissions: cleanPermissions,
        },
        include: {
          _count: { select: { users: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'UPDATE_ROLE',
          module: 'USER_MANAGEMENT',
          entityType: 'Role',
          entityId: id,
          changeSummary: `${user.name} memperbarui role "${cleanName}". Hak akses diatur ke ${cleanPermissions.length} menu.`,
          beforeData: {
            name: role.name,
            permissions: role.permissions,
          },
          afterData: {
            name: res.name,
            permissions: cleanPermissions,
          },
        },
      });

      return res;
    });

    revalidateTag('roles');
    revalidatePath('/dashboard/roles');
    revalidatePath('/dashboard/users');

    return {
      success: true,
      data: {
        ...updated,
        userCount: updated._count.users,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('[role/updateRole] Error:', error);
    return { error: error.message || 'Gagal memperbarui role.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DELETE ROLE
// ══════════════════════════════════════════════════════════════════════════════

export async function deleteRole(id) {
  try {
    const { user, storeId } = await getAuthenticatedAdmin();

    if (!id) return { error: 'ID role tidak valid.' };

    const role = await prisma.role.findFirst({
      where: { id, storeId },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      return { error: 'Role tidak ditemukan.' };
    }

    // ── GUARDRAIL KRUSIAL: Proteksi Hapus Role ──────────────────────────────
    if (role.name === 'OWNER') {
      return { error: 'Role OWNER adalah sistem root admin dan TIDAK DAPAT dihapus.' };
    }

    if (role._count.users > 0) {
      return {
        error: `Role "${role.name}" tidak dapat dihapus karena masih digunakan oleh ${role._count.users} karyawan. Harap pindahkan karyawan ke peran lain terlebih dahulu di menu Manajemen Karyawan.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // Hapus relasi rolePermissions jika ada
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      await tx.role.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'DELETE_ROLE',
          module: 'USER_MANAGEMENT',
          entityType: 'Role',
          entityId: id,
          changeSummary: `${user.name} menghapus role "${role.name}".`,
        },
      });
    });

    revalidateTag('roles');
    revalidatePath('/dashboard/roles');
    revalidatePath('/dashboard/users');

    return { success: true };
  } catch (error) {
    console.error('[role/deleteRole] Error:', error);
    return { error: error.message || 'Gagal menghapus role.' };
  }
}
