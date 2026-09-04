import { NextResponse } from 'next/server';
import { getRequiredPermissionForRoute, getDefaultRouteForUser } from '@/lib/permissions';

const SESSION_COOKIE = 'schaw_session';

// Rute yang memerlukan autentikasi
const PROTECTED_PREFIXES = ['/dashboard'];

// ── RATE LIMITER (In-Memory, Edge-Compatible) ─────────────────────────────────
// Map: ip -> { count: number, resetAt: number }
const rateLimitStore = new Map();

const RATE_LIMIT_RULES = {
  '/login':  { max: 5,   windowMs: 60_000 }, // Maksimal 5 percobaan per menit per IP
  '/menu':   { max: 60,  windowMs: 60_000 }, // 60 req/menit per IP (public QR)
};

/**
 * Cek apakah request dari IP tertentu melebihi batas rate limit.
 * Mengembalikan true jika harus di-block, false jika boleh lanjut.
 */
function isRateLimited(ip, pathname) {
  // Cari rule yang cocok (prefix match)
  const matchedPath = Object.keys(RATE_LIMIT_RULES).find((p) => pathname.startsWith(p));
  if (!matchedPath) return false;

  const rule = RATE_LIMIT_RULES[matchedPath];
  const key = `${matchedPath}:${ip}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Window baru
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
    return false;
  }

  if (entry.count >= rule.max) {
    return true; // Rate limit terlampaui
  }

  entry.count += 1;
  return false;
}

/**
 * Tambahkan security headers ke response.
 * Headers ini tidak mengubah alur bisnis, hanya memperkuat postur keamanan.
 */
function addSecurityHeaders(response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

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

/**
 * Helper untuk menghapus cookie sesi secara tuntas pada response (Production-safe)
 */
function clearSessionCookie(response) {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.set(SESSION_COOKIE, '', {
    path: '/',
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── RATE LIMITING ─────────────────────────────────────────────────────────────
  const clientIp =
    request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  if (isRateLimited(clientIp, pathname)) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Terlalu banyak percobaan, coba lagi nanti.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      )
    );
  }

  const sessionCookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSessionCookie(sessionCookieValue);
  const sessionToken = session?.token;
  const requiresPasswordChange = Boolean(session?.requiresPasswordChange);
  const userRole = session?.role;
  const userPermissions = Array.isArray(session?.permissions) ? session.permissions : [];

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // ── ATURAN 1: CEGAH INFINITE REDIRECT LOOP DI HALAMAN /login ─────────────────
  // JANGAN PERNAH redirect ke /login jika pengguna SUDAH BERADA di /login.
  if (pathname === '/login') {
    const isRevokedOrRedirected =
      request.nextUrl.searchParams.has('revoked') ||
      request.nextUrl.searchParams.has('from') ||
      request.nextUrl.searchParams.has('logout') ||
      request.nextUrl.searchParams.has('expired');

    // Jika sesi dicabut (Single Active Session) atau redirect error,
    // langsung bersihkan cookie sesi di scope middleware!
    if (isRevokedOrRedirected && sessionCookieValue) {
      const response = NextResponse.next();
      return addSecurityHeaders(clearSessionCookie(response));
    }

    // Jika sudah login normal & valid tanpa flag revoked/from, arahkan ke landing page hak aksesnya
    if (sessionToken && !requiresPasswordChange && !isRevokedOrRedirected) {
      const targetRoute = getDefaultRouteForUser(userRole, userPermissions);
      return addSecurityHeaders(NextResponse.redirect(new URL(targetRoute, request.url)));
    }

    return addSecurityHeaders(NextResponse.next());
  }

  // ── ATURAN 2: PENGGUNA BELUM LOGIN ATAU SESI HILANG ─────────────────────────
  if (!sessionToken) {
    // Akses rute dashboard tanpa sesi → alihkan ke /login dan bersihkan sisa cookie
    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      const response = NextResponse.redirect(loginUrl);
      return addSecurityHeaders(clearSessionCookie(response));
    }

    // Akses ganti password tanpa sesi → alihkan ke /login
    if (pathname === '/login/change-password') {
      const response = NextResponse.redirect(new URL('/login', request.url));
      return addSecurityHeaders(clearSessionCookie(response));
    }

    return addSecurityHeaders(NextResponse.next());
  }

  // ── ATURAN 3: PENGGUNA SUDAH LOGIN TETAPI WAJIB GANTI PASSWORD ──────────────
  if (requiresPasswordChange) {
    if (pathname === '/login/change-password') {
      return addSecurityHeaders(NextResponse.next());
    }
    return addSecurityHeaders(
      NextResponse.redirect(new URL('/login/change-password', request.url))
    );
  }

  // ── ATURAN 4: PENGGUNA SUDAH LOGIN NORMAL (SUDAH PERNAH GANTI PASSWORD) ─────
  if (!requiresPasswordChange) {
    if (pathname === '/login/change-password') {
      const targetRoute = getDefaultRouteForUser(userRole, userPermissions);
      return addSecurityHeaders(NextResponse.redirect(new URL(targetRoute, request.url)));
    }
  }

  // ── ATURAN 5: LANDING ROUTE REDIRECT UNTUK /dashboard ────────────────────────
  // Jika user bukan OWNER dan tidak memiliki izin MENU_DASHBOARD, arahkan ke rute default-nya (misal /dashboard/pos)
  if (
    pathname === '/dashboard' &&
    userRole &&
    userRole !== 'OWNER' &&
    !userPermissions.includes('MENU_DASHBOARD')
  ) {
    const targetRoute = getDefaultRouteForUser(userRole, userPermissions);
    if (targetRoute !== '/dashboard') {
      return addSecurityHeaders(NextResponse.redirect(new URL(targetRoute, request.url)));
    }
  }

  // Teruskan x-pathname di request headers agar Server Components (DashboardLayout)
  // dapat mengevaluasi otorisasi RBAC menggunakan data database terbaru (Real-Time).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  return addSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  );
}

export const config = {
  /*
   * Jalankan middleware di semua rute kecuali:
   * - Berkas statis Next.js (_next/static, _next/image, favicon.ico, dll.)
   * - Public assets
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
