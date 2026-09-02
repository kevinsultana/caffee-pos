'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export default function DashboardHeader({ user, onMenuToggle }) {
  const router = useRouter();

  async function handleLogout() {
    const Swal = (await import('sweetalert2')).default;

    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Sesi Anda akan diakhiri.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Logout',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (!result.isConfirmed) return;

    await logout();
    router.replace('/login');
  }

  const roleLabel = user?.role?.name ?? 'Staff';
  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 px-4 lg:px-6 py-3.5 bg-stone-950/80 backdrop-blur-md border-b border-stone-800/60">
      {/* Mobile hamburger */}
      <button
        id="btn-sidebar-toggle"
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Page breadcrumb / title area */}
      <div className="flex-1 hidden lg:block" />

      {/* Right section */}
      <div className="flex items-center gap-3 ml-auto">
        {/* User info */}
        <div className="hidden sm:flex flex-col items-end">
          <p className="text-sm font-semibold text-amber-50 leading-none">{user?.name ?? 'User'}</p>
          <p className="text-xs text-stone-500 mt-0.5">{roleLabel}</p>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-amber-900/40 border border-amber-700/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-amber-300">{initials}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-stone-800" />

        {/* Logout button */}
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium
            text-stone-400 hover:text-red-400 hover:bg-red-950/30
            border border-transparent hover:border-red-900/40
            transition-all duration-200"
          aria-label="Logout"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
