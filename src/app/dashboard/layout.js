import { redirect } from 'next/navigation';
import { verifySession } from '@/app/actions/auth';
import Sidebar from '@/components/layout/Sidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import DashboardShell from '@/components/layout/DashboardShell';

export const metadata = {
  title: 'Dashboard — Schaw Cafe POS',
};

export default async function DashboardLayout({ children }) {
  // ── Validasi sesi di server (full DB check) ────────────────────────────
  const user = await verifySession();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-stone-950 flex">
      {/* Sidebar (controlled via client DashboardShell) */}
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </div>
  );
}
