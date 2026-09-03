import { redirect } from 'next/navigation';
import { verifySession } from '@/app/actions/auth';
import DashboardShell from '@/components/layout/DashboardShell';
import SessionGuard from '@/components/layout/SessionGuard';

export const metadata = {
  title: 'Dashboard — Schaw Cafe POS',
};

export default async function DashboardLayout({ children }) {
  // ── Validasi sesi di server (full DB check) ────────────────────────────
  const user = await verifySession();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Real-time Session Guard & Multi-Device Kick-out Handler */}
      <SessionGuard />

      {/* Sidebar (controlled via client DashboardShell) */}
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </div>
  );
}
