'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Toaster } from 'react-hot-toast';

/**
 * Client shell yang mengelola state sidebar open/close.
 * Diperlukan karena Server Components tidak bisa menyimpan state.
 */
export default function DashboardShell({ user, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Global toast provider untuk seluruh dashboard */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#292524',
            color: '#fef3c7',
            border: '1px solid #44403c',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#1c1917' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1c1917' },
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <DashboardHeader
          user={user}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}
