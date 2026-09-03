import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession } from '@/app/actions/auth';
import DashboardShell from '@/components/layout/DashboardShell';
import SessionGuard from '@/components/layout/SessionGuard';

export const metadata = {
  title: 'Dashboard — Schaw Cafe POS',
};

export default async function DashboardLayout({ children }) {
  // ── Validasi sesi di server (full DB check) ────────────────────────────
  const user = await verifySession();
  if (!user) {
    const cookieStore = await cookies();
    cookieStore.delete({ name: 'schaw_session', path: '/' });
    cookieStore.set('schaw_session', '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    redirect('/login?revoked=1');
  }
  if (user.mustChangePassword) redirect('/login/change-password');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Real-time Session Guard & Multi-Device Kick-out Handler */}
      <SessionGuard />

      {/* Sidebar & Main Layout (controlled via client DashboardShell) */}
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </div>
  );
}
