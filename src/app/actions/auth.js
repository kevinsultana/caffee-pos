'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { MENU_PERMISSIONS, getDefaultRouteForUser } from '@/lib/permissions';

const SESSION_COOKIE = 'schaw_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 jam

/**
 * Hash token menggunakan SHA-256 sebelum disimpan ke DB.
 * Token asli dikirim ke client via cookie — hanya hash yang disimpan.
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Parsing payload session cookie yang dapat berupa string token tunggal
 * atau JSON object { token, requiresPasswordChange }.
 */
function parseSessionCookie(cookieValue) {
  if (!cookieValue) return null;
  try {
    const decoded = decodeURIComponent(cookieValue);
    if (decoded.startsWith('{')) {
      return JSON.parse(decoded);
    }
    if (cookieValue.startsWith('{')) {
      return JSON.parse(cookieValue);
    }
    return { token: cookieValue, requiresPasswordChange: false };
  } catch {
    return { token: cookieValue, requiresPasswordChange: false };
  }
}

/**
 * Login Server Action
 * @param {string} username
 * @param {string} password
 * @returns {{ success: true, mustChangePassword: boolean } | { error: string }}
 */
export async function login(username, password) {
  // ── Validasi input dasar ──────────────────────────────────────────────────
  if (!username?.trim() || !password?.trim()) {
    return { error: 'Username dan password wajib diisi.' };
  }

  // ── Validasi panjang input (cegah oversized payload / bcrypt hanging) ──────
  if (username.length > 100) {
    return { error: 'Username tidak valid.' };
  }
  if (password.length > 200) {
    return { error: 'Password tidak valid.' };
  }

  try {
    const cleanUsername = username.trim().toLowerCase();

    // ── Cari user berdasarkan username ────────────────────────────────────
    const user = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
      },
      include: {
        role: true,
        store: true,
      },
    });

    if (!user) {
      return { error: 'Username atau password salah.' };
    }

    // ── Cek status user (RESIGNED / INACTIVE) ──────────────────────────────
    if (user.status === 'RESIGNED') {
      return { error: 'Akun telah berstatus RESIGNED dan tidak dapat login ke sistem.' };
    }

    if (user.status === 'INACTIVE') {
      return { error: 'Akun sedang dinonaktifkan. Silakan hubungi Owner.' };
    }

    // ── Verifikasi password ───────────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return { error: 'Username atau password salah.' };
    }

    // ── Revoke semua sesi aktif sebelumnya (aturan: single active session) ─
    const revokedResult = await prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revokedResult.count > 0) {
      await prisma.auditLog.create({
        data: {
          storeId: user.storeId,
          userId: user.id,
          action: 'SESSION_REPLACEMENT',
          module: 'AUTH',
          entityType: 'UserSession',
          entityId: user.id,
          changeSummary: `Sesi aktif sebelumnya (${revokedResult.count} sesi) dicabut otomatis karena login baru dari perangkat lain.`,
        },
      });
    }

    // ── Buat sesi baru ────────────────────────────────────────────────────
    const rawToken = uuidv4();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionTokenHash: tokenHash,
        deviceId: 'web-pos',
        deviceName: 'POS Web Browser',
        expiresAt,
      },
    });

    // ── Catat Audit Log Login ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        storeId: user.storeId,
        userId: user.id,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'User',
        entityId: user.id,
        changeSummary: `Login berhasil: ${user.name} (${user.username}) [${user.role?.name}]`,
      },
    });

    // ── Set HTTP-only cookie dengan payload sesi ──────────────────────────
    const allPermissionCodes = MENU_PERMISSIONS.map((p) => p.code);
    const effectivePermissions =
      user.role?.name === 'OWNER'
        ? allPermissionCodes
        : user.role?.permissions || [];

    const sessionPayload = JSON.stringify({
      token: rawToken,
      requiresPasswordChange: Boolean(user.mustChangePassword),
      role: user.role?.name,
      permissions: effectivePermissions,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    const targetRedirectRoute = getDefaultRouteForUser(user.role?.name, effectivePermissions);

    return {
      success: true,
      mustChangePassword: Boolean(user.mustChangePassword),
      redirectUrl: user.mustChangePassword ? '/login/change-password' : targetRedirectRoute,
      role: user.role?.name,
      permissions: effectivePermissions,
    };
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return { error: 'Terjadi kesalahan pada server. Silakan coba lagi.' };
  }
}

/**
 * Server Action Ganti Password Wajib Pertama Kali
 * Dipanggil saat user memiliki mustChangePassword === true
 */
export async function changeFirstTimePassword({ currentPassword, newPassword, confirmPassword }) {
  try {
    const user = await verifySession();
    if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

    if (!currentPassword || !newPassword) {
      return { error: 'Password saat ini dan password baru wajib diisi.' };
    }

    if (newPassword.length < 6) {
      return { error: 'Password baru minimal 6 karakter.' };
    }

    if (newPassword !== confirmPassword) {
      return { error: 'Konfirmasi password baru tidak cocok.' };
    }

    if (currentPassword === newPassword) {
      return { error: 'Password baru tidak boleh sama dengan password sementara sebelumnya.' };
    }

    // Ambil full record user untuk cek hash password lama
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) return { error: 'User tidak ditemukan.' };

    const isCurrentValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      return { error: 'Password sementara saat ini salah.' };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false, // Flag dinonaktifkan
        },
      });

      await tx.auditLog.create({
        data: {
          storeId: user.storeId,
          userId: user.id,
          action: 'FORCED_PASSWORD_CHANGE',
          module: 'AUTH',
          entityType: 'User',
          entityId: user.id,
          changeSummary: `Pengguna ${user.name} (${user.username}) berhasil menyelesaikan penggantian password wajib pertama kali.`,
        },
      });
    });

    // ── Perbarui session cookie: hilangkan flag requiresPasswordChange ──────
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;
    const sessionData = parseSessionCookie(rawCookie);
    if (sessionData?.token) {
      const updatedPayload = JSON.stringify({
        token: sessionData.token,
        requiresPasswordChange: false,
      });
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
      cookieStore.set(SESSION_COOKIE, updatedPayload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      });
    }

    const targetRedirectRoute = getDefaultRouteForUser(user.role?.name, user.permissions);
    revalidatePath('/dashboard');
    return { success: true, redirectUrl: targetRedirectRoute };
  } catch (error) {
    console.error('[changeFirstTimePassword] Error:', error);
    return { error: error.message || 'Gagal mengubah password.' };
  }
}

/**
 * Logout Server Action — revoke sesi saat ini.
 */
export async function logout() {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;

    if (rawCookie) {
      const sessionData = parseSessionCookie(rawCookie);
      const rawToken = sessionData?.token;
      if (rawToken) {
        const tokenHash = hashToken(rawToken);
        try {
          const session = await prisma.userSession.findUnique({
            where: { sessionTokenHash: tokenHash },
            include: { user: true },
          });

          if (session) {
            if (!session.revokedAt) {
              await prisma.userSession.update({
                where: { sessionTokenHash: tokenHash },
                data: { revokedAt: new Date() },
              });
            }

            if (session.user?.storeId) {
              await prisma.auditLog.create({
                data: {
                  storeId: session.user.storeId,
                  userId: session.userId,
                  sessionId: session.id,
                  action: 'LOGOUT',
                  module: 'AUTH',
                  changeSummary: 'Pengguna melakukan logout dari sistem.',
                },
              });
            }
          }
        } catch (dbErr) {
          console.error('[logout] Error updating DB or audit log:', dbErr);
        }
      }
    }
  } catch (err) {
    console.error('[logout] Error reading cookie:', err);
  } finally {
    // ── Pembersihan cookie secara tuntas dan aman ───────────────────────────
    try {
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
    } catch (cookieErr) {
      console.error('[logout] Error clearing cookie:', cookieErr);
    }
  }
}

/**
 * Verifikasi sesi dari cookie — digunakan oleh middleware / server components / server actions.
 * @returns {object|null} user object atau null jika sesi tidak valid
 */
export async function verifySession() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawCookie) return null;

  const sessionData = parseSessionCookie(rawCookie);
  const rawToken = sessionData?.token;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);

  let session = null;
  try {
    session = await prisma.userSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: {
          include: { role: true, store: true },
        },
      },
    });
  } catch (err) {
    console.error('[verifySession] DB lookup error:', err);
    return null;
  }

  const isInvalid =
    !session ||
    Boolean(session.revokedAt) ||
    session.expiresAt < new Date() ||
    session.user?.status !== 'ACTIVE';

  if (isInvalid) {
    // Jika dipanggil dari Server Action atau Route Handler (konteks yang mengizinkan modifikasi cookie),
    // hapus cookie sesi yang sudah tidak valid ini secara langsung!
    try {
      cookieStore.delete({ name: SESSION_COOKIE, path: '/' });
      cookieStore.set(SESSION_COOKIE, '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    } catch {
      // Di Server Component (layout/page), cookies() bersifat read-only.
      // Error ReadonlyRequestCookiesError tertangkap dengan aman di sini tanpa me-crash server.
    }
    return null;
  }

  // Pastikan permissions terisi dengan benar (OWNER mendapatkan seluruh hak akses)
  if (session.user.role) {
    if (session.user.role.name === 'OWNER') {
      session.user.role.permissions = MENU_PERMISSIONS.map((p) => p.code);
    } else if (!Array.isArray(session.user.role.permissions)) {
      session.user.role.permissions = [];
    }
  }

  // Set array permissions langsung di objek user agar selalu tersedia bagi UI & Middleware
  session.user.permissions = session.user.role?.permissions || [];

  return session.user;
}

/**
 * Memeriksa validitas sesi saat ini secara real-time dari cookie browser.
 * Digunakan oleh SessionGuard untuk mendeteksi pembatalan sesi (kick-out) saat akun login di device lain.
 * 
 * @returns {Promise<{ isValid: boolean, reason?: string }>}
 */
export async function verifyCurrentSession() {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;

    const clearInvalidCookie = () => {
      try {
        cookieStore.delete({ name: SESSION_COOKIE, path: '/' });
        cookieStore.set(SESSION_COOKIE, '', {
          path: '/',
          expires: new Date(0),
          maxAge: 0,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      } catch (err) {
        console.error('[verifyCurrentSession] Error clearing cookie:', err);
      }
    };

    if (!rawCookie) {
      return { isValid: false, reason: 'REVOKED' };
    }

    const sessionData = parseSessionCookie(rawCookie);
    const rawToken = sessionData?.token;
    if (!rawToken) {
      clearInvalidCookie();
      return { isValid: false, reason: 'REVOKED' };
    }

    const tokenHash = hashToken(rawToken);

    const session = await prisma.userSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      clearInvalidCookie();
      return { isValid: false, reason: 'REVOKED' };
    }

    if (session.user?.status !== 'ACTIVE') {
      clearInvalidCookie();
      return { isValid: false, reason: 'REVOKED' };
    }

    const effectivePermissions =
      session.user.role?.name === 'OWNER'
        ? MENU_PERMISSIONS.map((p) => p.code)
        : session.user.role?.permissions || [];

    // Perbarui cookie sesi jika permissions atau role di database telah berubah
    try {
      const cachedPermissions = Array.isArray(sessionData?.permissions) ? sessionData.permissions : [];
      const hasChanged =
        sessionData?.role !== session.user.role?.name ||
        cachedPermissions.length !== effectivePermissions.length ||
        cachedPermissions.some((p) => !effectivePermissions.includes(p));

      if (hasChanged) {
        const updatedPayload = JSON.stringify({
          token: rawToken,
          requiresPasswordChange: Boolean(session.user.mustChangePassword),
          role: session.user.role?.name,
          permissions: effectivePermissions,
        });
        cookieStore.set(SESSION_COOKIE, updatedPayload, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: session.expiresAt,
          path: '/',
        });
      }
    } catch (cookieErr) {
      console.warn('[verifyCurrentSession] Gagal update cookie permissions:', cookieErr);
    }

    return {
      isValid: true,
      user: {
        id: session.user.id,
        role: session.user.role?.name,
        permissions: effectivePermissions,
      },
    };
  } catch (error) {
    console.error('[verifyCurrentSession] Error:', error);
    // Jika terjadi galat jaringan sementara, jangan langsung menendang user
    return { isValid: true };
  }
}

