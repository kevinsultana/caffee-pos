'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import toast, { Toaster } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { getRequiredPermissionForRoute, hasPermission, getDefaultRouteForUser } from '@/lib/permissions';

/**
 * Client shell yang mengelola state sidebar open/close (mobile) dan collapsed (desktop).
 */
export default function DashboardShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Deteksi jika user dialihkan karena tidak memiliki izin (403 Forbidden)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('forbidden') === '1') {
        toast.error('Akses Ditolak: Peran akun Anda tidak memiliki hak akses untuk membuka menu tersebut.', {
          id: 'forbidden-toast',
          duration: 5000,
        });
        params.delete('forbidden');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, '', `${window.location.pathname}${newSearch}`);
      }
    }
  }, []);

  // Client-Side RBAC Guard untuk navigasi SPA
  useEffect(() => {
    if (!user) return;
    const isOwner = user.role === 'OWNER' || user.role?.name === 'OWNER';
    if (isOwner) return;

    const requiredPermission = getRequiredPermissionForRoute(pathname);
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      const userRole = typeof user.role === 'string' ? user.role : user.role?.name || '';
      const allowedRoute = getDefaultRouteForUser(userRole, user.permissions);
      if (pathname !== allowedRoute) {
        toast.error('Akses Ditolak: Peran akun Anda tidak memiliki hak akses untuk membuka menu tersebut.', {
          id: 'forbidden-client-toast',
        });
        router.replace(allowedRoute);
      }
    }
  }, [pathname, user, router]);

  return (
    <>
      {/* Global toast provider untuk seluruh dashboard */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
          success: {
            iconTheme: { primary: '#059669', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#e11d48', secondary: '#ffffff' },
          },
        }}
      />

      {/* Fixed Sidebar */}
      <Sidebar
        user={user}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      {/* Fixed Header */}
      <DashboardHeader
        user={user}
        onMenuToggle={() => setMobileOpen((v) => !v)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      {/* Main content area dengan kompensasi Margin Left dan Padding Top */}
      <main
        className={cn(
          'min-h-screen bg-slate-50 transition-all duration-300 pt-16',
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </>
  );
}
