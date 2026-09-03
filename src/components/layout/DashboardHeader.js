'use client';

import { useRouter, usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export default function DashboardHeader({ user, onMenuToggle, isCollapsed, onToggleCollapse }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const Swal = (await import('sweetalert2')).default;

    const result = await Swal.fire({
      title: 'Konfirmasi Logout',
      text: 'Apakah Anda yakin ingin mengakhiri sesi kerja ini?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Logout',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
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

  // Simple breadcrumb label helper
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard Ringkasan';
    if (pathname.startsWith('/dashboard/pos/cash')) return 'POS / Arus Kas Manual';
    if (pathname.startsWith('/dashboard/pos/shift')) return 'POS / Manajemen Shift';
    if (pathname.startsWith('/dashboard/pos')) return 'Point of Sale (Kasir)';
    if (pathname.startsWith('/dashboard/qr')) return 'Generate QR Meja';
    if (pathname.startsWith('/dashboard/products/categories')) return 'Master Menu / Kategori';
    if (pathname.startsWith('/dashboard/products/list')) return 'Master Menu / Daftar Menu & Resep';
    if (pathname.startsWith('/dashboard/promotions')) return 'Master Menu / Promosi & Diskon';
    if (pathname.startsWith('/dashboard/customers')) return 'Database Pelanggan & Member';
    if (pathname.startsWith('/dashboard/inventory/items')) return 'Inventaris / Daftar Bahan Baku';
    if (pathname.startsWith('/dashboard/inventory/purchases')) return 'Inventaris / Pembelian Supplier';
    if (pathname.startsWith('/dashboard/inventory/movements')) return 'Inventaris / Kartu Stok Mutasi';
    if (pathname.startsWith('/dashboard/inventory/opname')) return 'Inventaris / Stock Opname';
    if (pathname.startsWith('/dashboard/inventory/suppliers')) return 'Inventaris / Data Supplier';
    if (pathname.startsWith('/dashboard/inventory/setup')) return 'Inventaris / Satuan & Kategori';
    if (pathname.startsWith('/dashboard/users')) return 'Administrasi / Manajemen Karyawan';
    if (pathname.startsWith('/dashboard/audit')) return 'Administrasi / System Audit Trail';
    if (pathname.startsWith('/dashboard/settings')) return 'Konfigurasi Toko';
    return 'Schaw POS';
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 lg:px-8 py-3.5 bg-white border-b border-slate-200/80 shadow-2xs">
      {/* Left: Mobile hamburger, Desktop collapse toggle & breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          id="btn-sidebar-toggle-mobile"
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar mobile"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Desktop collapse toggle */}
        <button
          id="btn-sidebar-toggle-desktop"
          onClick={onToggleCollapse}
          className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          aria-label="Toggle sidebar desktop"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
        </button>

        <div>
          <h2 className="text-xs font-semibold text-slate-700 hidden sm:block">
            {getPageTitle()}
          </h2>
        </div>
      </div>

      {/* Right section: User Profile & Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {/* User Info & Badge */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold text-slate-900 leading-none">{user?.name ?? 'User'}</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-200/60">
              {roleLabel}
            </span>
          </div>

          {/* Avatar with Initials */}
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-100">
            {initials}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200" />

        {/* Logout Button */}
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 transition-all"
          title="Keluar dari sistem"
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
