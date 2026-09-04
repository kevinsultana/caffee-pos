import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'schaw_session';

export async function GET(request) {
  return handleClearSession(request);
}

export async function POST(request) {
  return handleClearSession(request);
}

async function handleClearSession(request) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete({ name: SESSION_COOKIE, path: '/' });
  } catch (err) {
    console.error('[clear-session] Error calling cookieStore.delete:', err);
  }

  const redirectUrl = new URL('/login?revoked=1', request.url);
  const response = NextResponse.redirect(redirectUrl);

  // Hapus cookie sesi secara menyeluruh pada response header
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.set(SESSION_COOKIE, '', {
    path: '/',
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  // Header anti-cache agresif agar browser & proxy tidak menyimpan cache sesi lama
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
