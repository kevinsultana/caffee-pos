'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';

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
 * Login Server Action
 * @param {string} username
 * @param {string} password
 * @returns {{ success: true } | { error: string }}
 */
export async function login(username, password) {
  // ── Validasi input dasar ──────────────────────────────────────────────────
  if (!username?.trim() || !password?.trim()) {
    return { error: 'Username dan password wajib diisi.' };
  }

  try {
    // ── Cari user aktif berdasarkan username ──────────────────────────────
    const user = await prisma.user.findFirst({
      where: {
        username: username.trim(),
        status: 'ACTIVE',
      },
      include: {
        role: true,
        store: true,
      },
    });

    if (!user) {
      return { error: 'Username atau password salah.' };
    }

    // ── Verifikasi password ───────────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return { error: 'Username atau password salah.' };
    }

    // ── Revoke semua sesi aktif (aturan: single active session) ──────────
    await prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

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

    // ── Set HTTP-only cookie ──────────────────────────────────────────────
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return { error: 'Terjadi kesalahan pada server. Silakan coba lagi.' };
  }
}

/**
 * Logout Server Action — revoke sesi saat ini.
 */
export async function logout() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await prisma.userSession.updateMany({
      where: { sessionTokenHash: tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Verifikasi sesi dari cookie — digunakan oleh middleware / server components.
 * @returns {object|null} user object atau null jika sesi tidak valid
 */
export async function verifySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);

  const session = await prisma.userSession.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: {
      user: {
        include: { role: true, store: true },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  return session.user;
}
