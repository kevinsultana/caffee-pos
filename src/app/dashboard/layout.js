import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { verifySession } from '@/app/actions/auth';
import { getRequiredPermissionForRoute, hasPermission, getDefaultRouteForUser } from '@/lib/permissions';
import DashboardShell from '@/components/layout/DashboardShell';
import SessionGuard from '@/components/layout/SessionGuard';

export const metadata = {
  title: 'Dashboard — Schaw Cafe POS',
};

export default async function DashboardLayout({ children }) {
  const user = await verifySession();
  if (!user) {
    redirect('/api/auth/clear-session');
  }
  if (user.mustChangePassword) redirect('/login/change-password');

  // RBAC Server-Side Otorisasi: Menggunakan data live database (100% Real-Time)
  const headersList = await headers();
  const currentPathname = headersList.get('x-pathname') || '';

  if (currentPathname && user.role?.name !== 'OWNER') {
    const requiredPermission = getRequiredPermissionForRoute(currentPathname);
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      const allowedRoute = getDefaultRouteForUser(user.role?.name, user.permissions);
      if (currentPathname !== allowedRoute) {
        redirect(currentPathname === '/dashboard' ? allowedRoute : `${allowedRoute}?forbidden=1`);
      }
    }
  }

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
