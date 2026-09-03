'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Toaster } from 'react-hot-toast';
import { cn } from '@/lib/utils';

/**
 * Client shell yang mengelola state sidebar open/close (mobile) dan collapsed (desktop).
 */
export default function DashboardShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

      {/* Main content area dengan margin-left dinamis */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 bg-slate-50 min-h-screen transition-all duration-300 ease-in-out',
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <DashboardHeader
          user={user}
          onMenuToggle={() => setMobileOpen((v) => !v)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}
