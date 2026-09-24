'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPurchases, confirmPurchase, deletePurchase } from '@/app/actions/purchasing';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/SearchableSelect';

function toLocalDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPurchaseDateString(purchasedAt) {
  if (!purchasedAt) return '';
  const d = new Date(purchasedAt);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(preset) {
  const now = new Date();
  const todayStr = toLocalDateString(now);

  switch (preset) {
    case 'TODAY':
      return { dateFrom: todayStr, dateTo: todayStr };
    case 'YESTERDAY': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toLocalDateString(y);
      return { dateFrom: yStr, dateTo: yStr };
    }
    case 'LAST_7_DAYS': {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { dateFrom: toLocalDateString(past), dateTo: todayStr };
    }
    case 'THIS_MONTH': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { dateFrom: toLocalDateString(first), dateTo: toLocalDateString(last) };
    }
    case 'LAST_MONTH': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: toLocalDateString(first), dateTo: toLocalDateString(last) };
    }
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

const DATE_PRESETS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: 'LAST_7_DAYS', label: '7 Hari Terakhir' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
  { id: 'CUSTOM', label: 'Pilih Tanggal' },
];

export default function PurchasesListPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    setLoading(true);
    const res = await getPurchases();
    if (res.error) toast.error(res.error);
    else setPurchases(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handlePresetChange = (presetId) => {
    setDatePreset(presetId);
    if (presetId === 'ALL') {
      setCustomDateFrom('');
      setCustomDateTo('');
    } else if (presetId !== 'CUSTOM') {
      const range = buildDateRange(presetId);
      setCustomDateFrom(range.dateFrom);
      setCustomDateTo(range.dateTo);
    }
  };

  const handleCustomDateFromChange = (val) => {
    setCustomDateFrom(val);
    setDatePreset('CUSTOM');
  };

  const handleCustomDateToChange = (val) => {
    setCustomDateTo(val);
    setDatePreset('CUSTOM');
  };

  // Filter Data Pembelian Berdasarkan Status, Pencarian, & Filter Tanggal
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      // Filter Status
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) {
        return false;
      }

      // Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = p.purchaseNumber?.toLowerCase().includes(q);
        const matchSupplier = p.supplier?.name?.toLowerCase().includes(q);
        if (!matchNumber && !matchSupplier) {
          return false;
        }
      }

      // Filter Tanggal
      if (datePreset !== 'ALL') {
        const itemDateStr = getPurchaseDateString(p.purchasedAt);
        if (customDateFrom && itemDateStr < customDateFrom) {
          return false;
        }
        if (customDateTo && itemDateStr > customDateTo) {
          return false;
        }
      }

      return true;
    });
  }, [purchases, selectedStatus, searchQuery, datePreset, customDateFrom, customDateTo]);

  // Statistik Real-time dari filteredPurchases
  const stats = useMemo(() => {
    let totalAmount = 0;
    let confirmedAmount = 0;
    let draftAmount = 0;
    let confirmedCount = 0;
    let draftCount = 0;
    let totalItems = 0;

    for (const p of filteredPurchases) {
      const amt = Number(p.totalAmount) || 0;
      totalAmount += amt;
      if (p.status === 'CONFIRMED') {
        confirmedAmount += amt;
        confirmedCount++;
      } else {
        draftAmount += amt;
        draftCount++;
      }
      totalItems += p.items?.length || 0;
    }

    const totalCount = filteredPurchases.length;
    const avgAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

    return {
      totalAmount,
      totalCount,
      confirmedAmount,
      confirmedCount,
      draftAmount,
      draftCount,
      totalItems,
      avgAmount,
    };
  }, [filteredPurchases]);

  async function handleConfirm(purchase) {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Konfirmasi Pembelian?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2 font-sans">
          <p>Anda akan mengonfirmasi PO <b>#${purchase.purchaseNumber}</b>.</p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800">
            ⚠️ <b>Efek Tindakan (Permanen & Atomic):</b>
            <ul class="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
              <li>Stok fisik akan otomatis bertambah ke saldo inventaris.</li>
              <li>Nilai HPP (Weighted Average Cost / WAC) akan diperbarui.</li>
              <li>Kartu stok (Stock Movement) historis akan tercatat secara permanen.</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Posting Stok & WAC',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Memproses transaksi & menghitung WAC...');
      const res = await confirmPurchase(purchase.id);

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success(`PO #${purchase.purchaseNumber} berhasil dikonfirmasi! Stok & WAC terupdate.`, {
          id: toastId,
          duration: 4000,
        });
        loadData();
      }
    });
  }

  async function handleDeleteDraft(purchase) {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Hapus Draft PO?',
      text: `Apakah Anda yakin ingin menghapus draft pembelian #${purchase.purchaseNumber}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Draft',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menghapus draft...');
      const res = await deletePurchase(purchase.id);

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Draft pembelian berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pembelian Bahan Baku (Purchasing)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Purchase Orders (PO), konfirmasi penerimaan barang, dan kalkulasi otomatis WAC (Weighted Average Cost).
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <svg className={cn('w-4 h-4 text-slate-500', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Muat Ulang
          </button>
          <Link
            id="btn-create-po"
            href="/dashboard/inventory/purchases/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all w-fit cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Buat Pembelian Baru
          </Link>
        </div>
      </div>

      {/* ─── FILTERS & DATE RANGE ─────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        {/* Periode Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253 3.75h18M4.5 7.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 19.5 22.5H4.5A2.25 2.25 0 0 1 2.25 20.25V9.75A2.25 2.25 0 0 1 4.5 7.5Z" />
            </svg>
            Periode:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetChange(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                datePreset === p.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker (shown when CUSTOM or when date range is active) */}
        {(datePreset === 'CUSTOM' || customDateFrom || customDateTo) && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Rentang:</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[11px] text-slate-400 font-medium">Dari:</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => handleCustomDateFromChange(e.target.value)}
                className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[11px] text-slate-400 font-medium">Sampai:</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => handleCustomDateToChange(e.target.value)}
                className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer"
              />
            </div>
            {datePreset !== 'ALL' && (
              <button
                type="button"
                onClick={() => handlePresetChange('ALL')}
                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium px-1 cursor-pointer"
              >
                Reset Tanggal
              </button>
            )}
          </div>
        )}

        {/* Search & Status Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Cari nomor PO atau nama supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <SearchableSelect
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'DRAFT', label: 'DRAFT (Belum Konfirmasi)' },
              { value: 'CONFIRMED', label: 'CONFIRMED (Stok & WAC Diposting)' },
            ]}
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val || 'ALL')}
            className="w-full sm:w-60"
          />
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nilai Pembelian */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Nilai Pembelian</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-700 tracking-tight leading-tight">
            {formatRupiah(stats.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
            <span>Dari <strong>{stats.totalCount}</strong> faktur pembelian</span>
          </p>
        </div>

        {/* Card 2: Total Transaksi PO */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Transaksi (PO)</span>
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-tight leading-tight">
            {stats.totalCount} <span className="text-sm font-semibold font-sans text-slate-500">Faktur</span>
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] font-medium">
            <span className="text-emerald-700 font-semibold">{stats.confirmedCount} Selesai</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-amber-700 font-semibold">{stats.draftCount} Draft</span>
          </div>
        </div>

        {/* Card 3: Pembelian Terkonfirmasi (Stok & WAC) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Stok Diposting (WAC)</span>
            <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-sm shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-teal-700 tracking-tight leading-tight">
            {formatRupiah(stats.confirmedAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            <strong>{stats.confirmedCount}</strong> PO ({stats.totalAmount > 0 ? Math.round((stats.confirmedAmount / stats.totalAmount) * 100) : 0}% nilai masuk stok)
          </p>
        </div>

        {/* Card 4: Rata-rata per PO */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Nilai per PO</span>
            <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-800 tracking-tight leading-tight">
            {formatRupiah(stats.avgAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Total <strong>{stats.totalItems}</strong> baris item bahan baku
          </p>
        </div>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">No. Pembelian (PO)</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Tanggal Transaksi</th>
                <th className="py-3.5 px-4">Jumlah Item</th>
                <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat daftar pembelian...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchQuery || selectedStatus !== 'ALL' || datePreset !== 'ALL'
                      ? 'Tidak ada pembelian yang cocok dengan filter tanggal/status.'
                      : 'Belum ada transaksi pembelian. Klik "+ Buat Pembelian Baru" untuk memulai.'}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  const isDraft = p.status === 'DRAFT';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/dashboard/inventory/purchases/${p.id}`}
                          className="font-mono font-bold text-slate-900 hover:text-emerald-700 transition-colors"
                        >
                          #{p.purchaseNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {p.supplier?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">
                        {formatDate(p.purchasedAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {p.items?.length || 0} bahan baku
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                        {formatRupiah(p.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        {isDraft ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            DRAFT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            CONFIRMED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/inventory/purchases/${p.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          Detail
                        </Link>

                        {isDraft && (
                          <>
                            <button
                              onClick={() => handleConfirm(p)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-2xs"
                            >
                              Konfirmasi
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(p)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
