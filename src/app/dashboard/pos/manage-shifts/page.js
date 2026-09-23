'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getAllShifts, getShiftDetail } from '@/app/actions/shift';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';

export default function ManageShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState('TODAY');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [shiftDetail, setShiftDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reconciliation'); // 'reconciliation' | 'movements' | 'payments'

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getAllShifts({
      datePreset,
      status: statusFilter,
      search: searchQuery,
    });

    if (res.error) {
      toast.error(res.error);
    } else if (res.data) {
      setShifts(res.data.shifts || []);
      setStats(res.data.stats || null);
    }
    setLoading(false);
  }, [datePreset, statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function openDetailModal(shiftId) {
    setSelectedShiftId(shiftId);
    setDetailModalOpen(true);
    setDetailLoading(true);
    setActiveTab('reconciliation');

    const res = await getShiftDetail(shiftId);
    if (res.error) {
      toast.error(res.error);
      setDetailModalOpen(false);
    } else {
      setShiftDetail(res.data);
    }
    setDetailLoading(false);
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
    setSelectedShiftId(null);
    setShiftDetail(null);
  }

  // Durasi shift helper
  function calculateDuration(openedAt, closedAt) {
    if (!openedAt) return '-';
    const start = new Date(openedAt);
    const end = closedAt ? new Date(closedAt) : new Date();
    const diffMs = end - start;
    if (diffMs < 0) return '-';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${minutes}m`;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Kelola Shift & Setoran Kasir
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Pengawasan Owner / Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekap modal awal, pergerakan kas laci, omzet tunai & QRIS, serta uang yang disetorkan kasir ke owner per sesi shift.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pos/shift"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Layar Buka/Tutup Kasir
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <svg
              className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ─── STAT CARDS SUMMARY ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Shift</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-black font-mono text-slate-900 mt-1">
            {stats?.totalShifts || 0} Shift
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
            <span className="text-emerald-600 font-bold">{stats?.openShiftCount || 0} Aktif</span> &bull; {stats?.closedShiftCount || 0} Selesai
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Modal Awal</span>
            <span className="text-slate-400 font-mono text-xs">Rp</span>
          </div>
          <p className="text-xl font-black font-mono text-slate-900 mt-1">
            {formatRupiah(stats?.totalOpeningCash || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Kas drawer saat buka sesi</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Penjualan Tunai</span>
            <span className="text-emerald-600 font-bold text-xs">CASH</span>
          </div>
          <p className="text-xl font-black font-mono text-emerald-700 mt-1">
            {formatRupiah(stats?.totalCashSales || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Uang kas dari pesanan</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total QRIS</span>
            <span className="text-blue-600 font-bold text-xs">QRIS</span>
          </div>
          <p className="text-xl font-black font-mono text-blue-700 mt-1">
            {formatRupiah(stats?.totalQrisSales || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Non-tunai rekening bank</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Disetor ke Owner</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          </div>
          <p className="text-xl font-black font-mono text-emerald-800 mt-1">
            {formatRupiah(stats?.totalDepositedCash || 0)}
          </p>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Diserahkan saat tutup shift</p>
        </div>
      </div>

      {/* ─── FILTER & SEARCH BAR ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Preset Date Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'LAST_7_DAYS', label: '7 Hari Terakhir' },
            { id: 'THIS_MONTH', label: 'Bulan Ini' },
            { id: 'ALL', label: 'Semua Waktu' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                datePreset === p.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-2">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">Semua Status</option>
            <option value="OPEN">Aktif (Open)</option>
            <option value="CLOSED">Selesai (Closed)</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari nama kasir..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-44 sm:w-56"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Waktu Shift</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Modal Awal</th>
                <th className="py-3 px-4 text-right text-emerald-700">Cash In</th>
                <th className="py-3 px-4 text-right text-rose-600">Cash Out</th>
                <th className="py-3 px-4 text-right text-blue-700">Total QRIS</th>
                <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                <th className="py-3 px-4 text-right">Uang Fisik (Actual)</th>
                <th className="py-3 px-4 text-right font-black text-emerald-800 bg-emerald-50/40">Disetor ke Owner</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data shift kasir...</span>
                    </div>
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-1">
                      <p className="font-semibold text-slate-600">Tidak ada riwayat shift</p>
                      <p className="text-[11px]">
                        {searchQuery
                          ? 'Tidak ada shift kasir yang cocok dengan pencarian.'
                          : 'Belum ada data shift untuk periode waktu yang dipilih.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                shifts.map((s) => {
                  const isOpen = s.status === 'OPEN';
                  const hasDiff = s.difference != null && s.difference !== 0;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => openDetailModal(s.id)}
                      className={cn(
                        'transition-colors cursor-pointer group',
                        isOpen ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'hover:bg-slate-50/80'
                      )}
                    >
                      {/* Kasir */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {s.user?.name?.slice(0, 1)?.toUpperCase() || 'K'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {s.user?.name || 'Kasir'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">@{s.user?.username || 'user'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Waktu Shift & Durasi */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="space-y-0.5">
                          <p className="font-mono text-slate-800 font-medium">
                            {formatDateTime(s.openedAt)}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <span>Sampai:</span>
                            {s.closedAt ? formatDateTime(s.closedAt) : (
                              <span className="text-emerald-600 font-semibold font-sans">Sedang Berjalan</span>
                            )}
                            <span className="text-slate-300">&bull;</span>
                            <span className="font-semibold text-slate-600">
                              ({calculateDuration(s.openedAt, s.closedAt)})
                            </span>
                          </p>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            OPEN
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            CLOSED
                          </span>
                        )}
                      </td>

                      {/* Modal Awal */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                        {formatRupiah(s.openingCash)}
                      </td>

                      {/* Cash In */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-700 whitespace-nowrap">
                        {s.cashIn > 0 ? `+${formatRupiah(s.cashIn)}` : '-'}
                      </td>

                      {/* Cash Out */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-rose-600 whitespace-nowrap">
                        {s.cashOut > 0 ? `-${formatRupiah(s.cashOut)}` : '-'}
                      </td>

                      {/* Total QRIS */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700 whitespace-nowrap">
                        {s.qrisSales > 0 ? formatRupiah(s.qrisSales) : '-'}
                      </td>

                      {/* Penjualan Tunai */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(s.cashSales)}
                      </td>

                      {/* Uang Fisik (Actual) & Selisih */}
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        {s.actualCash != null ? (
                          <div>
                            <p className="font-bold text-slate-900">{formatRupiah(s.actualCash)}</p>
                            {hasDiff ? (
                              <p className={cn('text-[10px] font-bold', s.difference > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                {s.difference > 0 ? `+${formatRupiah(s.difference)}` : formatRupiah(s.difference)}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400">Pas (0)</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-sans text-[11px]">Belum dihitung</span>
                        )}
                      </td>

                      {/* Uang Disetor ke Owner */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                        {s.depositedCash > 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md border border-emerald-300">
                            {formatRupiah(s.depositedCash)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Rp 0</span>
                        )}
                      </td>

                      {/* Aksi Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetailModal(s.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL DETAIL SHIFT (3 TABS) ────────────────────────────────────── */}
      {detailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Detail Rekap Sesi Shift
                  </h3>
                  {shiftDetail?.status === 'OPEN' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      OPEN
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                      CLOSED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kasir: <strong className="text-slate-800">{shiftDetail?.user?.name || 'Kasir'}</strong> &bull; Mulai: {shiftDetail?.openedAt ? formatDateTime(shiftDetail.openedAt) : '-'}
                </p>
              </div>

              <button
                onClick={closeDetailModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className="px-6 border-b border-slate-200 bg-white flex gap-6 shrink-0">
              <button
                onClick={() => setActiveTab('reconciliation')}
                className={cn(
                  'py-3 text-xs font-bold border-b-2 transition-colors',
                  activeTab === 'reconciliation'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
              >
                1. Rekonsiliasi Kas & Setoran
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={cn(
                  'py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'movements'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
              >
                2. Arus Kas Laci (In/Out)
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                  {shiftDetail?.cashMovements?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={cn(
                  'py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'payments'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
              >
                3. Transaksi Pesanan
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                  {shiftDetail?.payments?.length || 0}
                </span>
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Memuat detail rincian shift...</p>
                </div>
              ) : !shiftDetail ? (
                <p className="py-8 text-center text-xs text-slate-400">Gagal memuat detail shift.</p>
              ) : (
                <>
                  {/* ─── TAB 1: RECONCILIATION & SETORAN ─────────────────── */}
                  {activeTab === 'reconciliation' && (
                    <div className="space-y-4">
                      {/* Top Highlight Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kas Fisik Aktual</p>
                          <p className="text-lg font-black font-mono text-slate-900 mt-1">
                            {shiftDetail.actualCash != null ? formatRupiah(shiftDetail.actualCash) : 'Belum ditutup'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Dihitung kasir di laci</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Disetor ke Owner</p>
                          <p className="text-lg font-black font-mono text-emerald-800 mt-1">
                            {formatRupiah(shiftDetail.depositedCash)}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Uang setoran fisik</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sisa Tinggal di Laci</p>
                          <p className="text-lg font-black font-mono text-slate-800 mt-1">
                            {shiftDetail.remainingInDrawer != null ? formatRupiah(shiftDetail.remainingInDrawer) : '-'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Actual - Setoran</p>
                        </div>
                      </div>

                      {/* Detail Breakdown List */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                          <span className="font-sans font-medium">1. Modal Awal Kasir (Opening Cash)</span>
                          <span className="font-bold text-slate-800">{formatRupiah(shiftDetail.openingCash)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                          <span className="font-sans font-medium">2. Penjualan Tunai (Cash Sales)</span>
                          <span className="font-bold text-emerald-700">+{formatRupiah(shiftDetail.cashSales)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                          <span className="font-sans font-medium">3. Kas Masuk Operasional (Cash In)</span>
                          <span className="font-bold text-emerald-700">+{formatRupiah(shiftDetail.cashIn)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                          <span className="font-sans font-medium">4. Kas Keluar Operasional (Cash Out)</span>
                          <span className="font-bold text-rose-600">-{formatRupiah(shiftDetail.cashOut)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200 font-bold bg-slate-50 px-2 rounded-lg text-slate-900">
                          <span className="font-sans">Kas Diharapkan di Laci (Expected Cash = 1+2+3-4):</span>
                          <span>{formatRupiah(shiftDetail.expectedCash)}</span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                          <span className="font-sans font-medium">Uang Fisik Dihitung Kasir (Actual Cash):</span>
                          <span className="font-bold">
                            {shiftDetail.actualCash != null ? formatRupiah(shiftDetail.actualCash) : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200 text-xs px-2 rounded-lg bg-slate-50">
                          <span className="font-sans font-bold text-slate-700">Selisih Kas Rekonsiliasi (Actual - Expected):</span>
                          <span
                            className={cn(
                              'font-bold',
                              shiftDetail.difference == null || shiftDetail.difference === 0
                                ? 'text-slate-700'
                                : shiftDetail.difference > 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-600'
                            )}
                          >
                            {shiftDetail.difference == null
                              ? '-'
                              : shiftDetail.difference === 0
                                ? 'Pas (Rp 0)'
                                : shiftDetail.difference > 0
                                  ? `+${formatRupiah(shiftDetail.difference)} (Surplus/Lebih)`
                                  : `${formatRupiah(shiftDetail.difference)} (Defisit/Kurang)`}
                          </span>
                        </div>

                        {/* QRIS Separation Note */}
                        <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between text-blue-900 font-bold">
                            <span className="font-sans">Total Transaksi QRIS (Non-Tunai):</span>
                            <span>{formatRupiah(shiftDetail.qrisSales)}</span>
                          </div>
                          <p className="text-[11px] text-blue-700 font-sans">
                            *Pembayaran QRIS langsung masuk ke rekening bank cafe dan tidak mempengaruhi saldo kas fisik di laci kasir.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── TAB 2: CASH MOVEMENTS (IN/OUT) ──────────────────── */}
                  {activeTab === 'movements' && (
                    <div className="space-y-3">
                      {shiftDetail.cashMovements?.length === 0 ? (
                        <p className="py-12 text-center text-xs text-slate-400">
                          Tidak ada catatan kas masuk / kas keluar manual pada shift ini.
                        </p>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Jam</th>
                                <th className="py-2.5 px-4">Jenis Mutasi</th>
                                <th className="py-2.5 px-4">Alasan / Keperluan</th>
                                <th className="py-2.5 px-4 text-right">Nominal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {shiftDetail.cashMovements.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                                    {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <span
                                      className={cn(
                                        'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                        m.type === 'CASH_IN'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                          : 'bg-rose-100 text-rose-800 border-rose-200'
                                      )}
                                    >
                                      {m.type === 'CASH_IN' ? '+ KAS MASUK' : '- KAS KELUAR'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                                    {m.reason}
                                  </td>
                                  <td
                                    className={cn(
                                      'py-2.5 px-4 text-right font-mono font-bold',
                                      m.type === 'CASH_IN' ? 'text-emerald-700' : 'text-rose-600'
                                    )}
                                  >
                                    {m.type === 'CASH_IN' ? '+' : '-'}{formatRupiah(m.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── TAB 3: ORDER PAYMENTS ───────────────────────────── */}
                  {activeTab === 'payments' && (
                    <div className="space-y-3">
                      {shiftDetail.payments?.length === 0 ? (
                        <p className="py-12 text-center text-xs text-slate-400">
                          Belum ada transaksi pembayaran order pada shift ini.
                        </p>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-4">No. Order / Antrean</th>
                                <th className="py-2.5 px-4">Waktu</th>
                                <th className="py-2.5 px-4">Pelanggan</th>
                                <th className="py-2.5 px-4 text-center">Metode</th>
                                <th className="py-2.5 px-4 text-right">Total Bayar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {shiftDetail.payments.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                                    {p.order?.orderNumber || '-'}
                                    {p.order?.queueNumber && (
                                      <span className="ml-1.5 px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                                        #{p.order.queueNumber}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                                    {new Date(p.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-700">
                                    {p.order?.customerName || 'Umum'}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <span
                                      className={cn(
                                        'px-2 py-0.5 rounded-full text-[10px] font-bold font-mono',
                                        p.method === 'CASH'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                                      )}
                                    >
                                      {p.method}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                    {formatRupiah(p.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Shift ID: <code className="font-mono text-[10px]">{shiftDetail?.id}</code>
              </span>
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
