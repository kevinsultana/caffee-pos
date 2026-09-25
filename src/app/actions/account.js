'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/app/actions/auth';

const SESSION_COOKIE = 'schaw_session';

/**
 * 1. getCurrentUserProfile()
 * Mengambil profil lengkap user yang sedang aktif login dari DB.
 */
export async function getCurrentUserProfile() {
  try {
    const sessionUser = await verifySession();
    if (!sessionUser) {
      return { error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return { error: 'Data pengguna tidak ditemukan di database.' };
    }

    return {
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email || '',
        role: user.role?.name || 'Staff',
        roleDescription: user.role?.description || '',
        storeName: user.store?.name || 'Schaw Cafe',
        createdAt: user.createdAt,
      },
    };
  } catch (error) {
    console.error('[getCurrentUserProfile] Error:', error);
    return { error: 'Gagal mengambil data profil pengguna.' };
  }
}

/**
 * 2. updateOwnUsername({ newUsername, name })
 * Validasi dan pembaruan username (dan nama lengkap) mandiri oleh user yang login.
 */
export async function updateOwnUsername({ newUsername, name }) {
  try {
    const sessionUser = await verifySession();
    if (!sessionUser) {
      return { error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' };
    }

    if (!newUsername || typeof newUsername !== 'string' || !newUsername.trim()) {
      return { error: 'Username tidak boleh kosong.' };
    }

    const cleanUsername = newUsername.trim().toLowerCase();
    const cleanName = typeof name === 'string' && name.trim() ? name.trim() : undefined;

    if (cleanUsername.length < 3) {
      return { error: 'Username minimal 3 karakter.' };
    }

    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      return { error: 'Username hanya boleh memuat huruf kecil, angka, titik, strip (-), atau underscore (_).' };
    }

    // Cek keunikan username (tidak boleh dipakai user lain dalam toko yang sama)
    const existing = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        storeId: sessionUser.storeId,
        NOT: {
          id: sessionUser.id,
        },
      },
    });

    if (existing) {
      return { error: `Username "${cleanUsername}" sudah digunakan oleh pengguna lain. Silakan pilih username lain.` };
    }

    const oldUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    const updateData = {
      username: cleanUsername,
    };
    if (cleanName) {
      updateData.name = cleanName;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: sessionUser.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: { select: { name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          storeId: sessionUser.storeId,
          userId: sessionUser.id,
          action: 'UPDATE_OWN_PROFILE',
          module: 'ACCOUNT',
          entityType: 'User',
          entityId: sessionUser.id,
          changeSummary: `Pengguna memperbarui profil: username (${oldUser?.username} -> ${cleanUsername})${cleanName && oldUser?.name !== cleanName ? `, nama (${oldUser?.name} -> ${cleanName})` : ''}`,
        },
      });

      return user;
    });

    revalidatePath('/dashboard/account');
    revalidatePath('/dashboard', 'layout');

    return {
      success: true,
      message: 'Username & data profil berhasil diperbarui!',
      data: updatedUser,
    };
  } catch (error) {
    console.error('[updateOwnUsername] Error:', error);
    return { error: error.message || 'Gagal memperbarui username.' };
  }
}

/**
 * 3. updateOwnPassword({ currentPassword, newPassword, confirmPassword })
 * Memperbarui password akun user yang sedang login dengan verifikasi password saat ini.
 */
export async function updateOwnPassword({ currentPassword, newPassword, confirmPassword }) {
  try {
    const sessionUser = await verifySession();
    if (!sessionUser) {
      return { error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' };
    }

    if (!currentPassword?.trim() || !newPassword?.trim()) {
      return { error: 'Password saat ini dan password baru wajib diisi.' };
    }

    if (newPassword.length < 8) {
      return { error: 'Password baru minimal 8 karakter.' };
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return { error: 'Konfirmasi password baru tidak cocok.' };
    }

    if (currentPassword === newPassword) {
      return { error: 'Password baru tidak boleh sama dengan password saat ini.' };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
    if (!dbUser) {
      return { error: 'Data pengguna tidak ditemukan.' };
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      return { error: 'Password saat ini tidak sesuai.' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: sessionUser.id },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      // Cabut seluruh sesi aktif akun ini agar wajib login ulang dengan password baru
      await tx.userSession.updateMany({
        where: { userId: sessionUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          storeId: sessionUser.storeId,
          userId: sessionUser.id,
          action: 'CHANGE_OWN_PASSWORD',
          module: 'ACCOUNT',
          entityType: 'User',
          entityId: sessionUser.id,
          changeSummary: `Pengguna ${sessionUser.name} (@${sessionUser.username}) berhasil memperbarui password akunnya secara mandiri. Seluruh sesi ditutup untuk re-login.`,
        },
      });
    });

    // Hapus session cookie secara tuntas agar ter-logout seketika
    const cookieStore = await cookies();
    cookieStore.delete({ name: SESSION_COOKIE, path: '/' });
    cookieStore.set(SESSION_COOKIE, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    revalidatePath('/dashboard');
    return {
      success: true,
      requireRelogin: true,
      redirectUrl: '/login',
      message: 'Password berhasil diperbarui! Silakan login kembali dengan password baru Anda.',
    };
  } catch (error) {
    console.error('[updateOwnPassword] Error:', error);
    return { error: error.message || 'Gagal memperbarui password.' };
  }
}
