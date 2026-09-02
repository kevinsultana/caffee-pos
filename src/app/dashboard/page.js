import { verifySession } from '@/app/actions/auth';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Dashboard — Schaw Cafe POS',
  description: 'Ringkasan dan overview operasional Schaw Cafe POS.',
};

const ROLE_LABELS = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Kasir',
  INVENTORY_STAFF: 'Staff Inventori',
};

const QUICK_LINKS = [
  {
    label: 'Buka POS',
    href: '/dashboard/pos',
    description: 'Mulai transaksi penjualan',
    color: 'from-amber-900/50 to-amber-800/30 border-amber-700/30',
    iconColor: 'text-amber-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Produk',
    href: '/dashboard/products',
    description: 'Tambah dan atur produk menu',
    color: 'from-emerald-900/40 to-emerald-800/20 border-emerald-800/30',
    iconColor: 'text-emerald-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    label: 'Stok Inventori',
    href: '/dashboard/inventory',
    description: 'Pantau dan perbarui stok bahan',
    color: 'from-blue-900/40 to-blue-800/20 border-blue-800/30',
    iconColor: 'text-blue-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    label: 'Pengaturan Toko',
    href: '/dashboard/settings',
    description: 'Konfigurasi pajak & service charge',
    color: 'from-purple-900/40 to-purple-800/20 border-purple-800/30',
    iconColor: 'text-purple-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default async function DashboardPage() {
  const user = await verifySession();
  const roleName = ROLE_LABELS[user?.role?.name] ?? user?.role?.name ?? 'Staff';
  const today = formatDate(new Date());

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-800/60 bg-gradient-to-br from-stone-900 to-stone-900/80 p-6">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-1">
            {today}
          </p>
          <h1 className="text-2xl font-bold text-amber-50 mb-1">
            Selamat datang, {user?.name ?? 'User'}! 👋
          </h1>
          <p className="text-stone-400 text-sm">
            Anda masuk sebagai{' '}
            <span className="text-amber-400 font-semibold">{roleName}</span>
            {' '}di Panel {roleName} Schaw Cafe.
          </p>
        </div>
      </div>

      {/* Quick access cards */}
      <div>
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
          Akses Cepat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {QUICK_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${item.color} p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
            >
              <div className={`mb-3 ${item.iconColor}`}>{item.icon}</div>
              <p className="text-sm font-semibold text-stone-200 mb-0.5">{item.label}</p>
              <p className="text-xs text-stone-500">{item.description}</p>
              {/* Arrow */}
              <svg
                className="absolute bottom-4 right-4 w-4 h-4 text-stone-600 group-hover:text-stone-400 group-hover:translate-x-0.5 transition-all duration-150"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* Status info */}
      <div className="rounded-2xl border border-stone-800/60 bg-stone-900/50 p-5">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
          Status Sistem
        </p>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-sm text-stone-300">Sistem berjalan normal</p>
          <span className="ml-auto text-xs text-stone-600">Schaw POS v1.0</span>
        </div>
      </div>
    </div>
  );
}
