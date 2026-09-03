import { NextResponse } from 'next/server';
import { getRequiredPermissionForRoute } from '@/lib/permissions';

const SESSION_COOKIE = 'schaw_session';

// Rute yang memerlukan autentikasi
const PROTECTED_PREFIXES = ['/dashboard'];

/**
 * Parsing payload session cookie yang dapat berupa string token tunggal
 * atau JSON object { token, requiresPasswordChange, role, permissions }.
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

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const sessionCookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSessionCookie(sessionCookieValue);
  const sessionToken = session?.token;
  const requiresPasswordChange = Boolean(session?.requiresPasswordChange);
  const userRole = session?.role;
  const userPermissions = Array.isArray(session?.permissions) ? session.permissions : [];

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // ── 1. PENGGUNA BELUM LOGIN ─────────────────────────────────────────────────
  if (!sessionToken) {
    // Akses rute yang dilindungi (dashboard) → alihkan ke /login dengan tujuan asal
    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Akses halaman ganti password tanpa login → alihkan ke /login
    if (pathname === '/login/change-password') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  }

  // ── 2. PENGGUNA SUDAH LOGIN TETAPI WAJIB GANTI PASSWORD ────────────────────
  if (requiresPasswordChange) {
    // Izinkan hanya akses ke halaman /login/change-password
    if (pathname === '/login/change-password') {
      return NextResponse.next();
    }

    // Akses rute lain (termasuk /dashboard atau /login) → paksa alihkan ke /login/change-password
    return NextResponse.redirect(new URL('/login/change-password', request.url));
  }

  // ── 3. PENGGUNA SUDAH LOGIN DAN SUDAH PERNAH GANTI PASSWORD (NORMAL) ───────
  if (!requiresPasswordChange) {
    // Jika mencoba akses /login/change-password padahal sudah ganti password → alihkan ke /dashboard
    if (pathname === '/login/change-password') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Jika mencoba akses /login biasa → alihkan ke /dashboard
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ── 4. RBAC: OTORISASI AKSES RUTE MENU ─────────────────────────────────────
  if (isProtected && userRole && userRole !== 'OWNER') {
    const requiredPermission = getRequiredPermissionForRoute(pathname);
    // Jika rute ini memerlukan izin khusus dan pengguna tidak memilikinya
    if (requiredPermission && !userPermissions.includes(requiredPermission)) {
      // Jika mencoba akses /dashboard itu sendiri, biarkan agar tidak terjadi loop
      if (pathname === '/dashboard') {
        return NextResponse.next();
      }

      // Tolak dan alihkan kembali ke /dashboard dengan query parameter forbidden=1
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('forbidden', '1');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Jalankan middleware di semua rute kecuali:
   * - Berkas statis Next.js (_next/static, _next/image, favicon.ico, dll.)
   * - Public assets
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
