import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'schaw_session';

// Rute yang memerlukan autentikasi
const PROTECTED_PREFIXES = ['/dashboard'];

// Rute yang hanya untuk tamu (belum login)
const GUEST_ONLY_ROUTES = ['/login'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isGuestOnly = GUEST_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // ── Belum login → akses protected route → redirect ke /login ──────────
  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname); // simpan tujuan asal
    return NextResponse.redirect(loginUrl);
  }

  // ── Sudah login → akses /login → redirect ke /dashboard ───────────────
  if (isGuestOnly && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Jalankan middleware di semua rute kecuali:
   * - Berkas statis Next.js (_next/static, _next/image, favicon, dll.)
   * - Public assets
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
