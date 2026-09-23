'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getDashboardMetrics } from '@/app/actions/dashboard';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('TODAY');
  const [loading, setLoading] = useState(true);

  async function loadData(selectedPeriod = period) {
    setLoading(true);
    const res = await getDashboardMetrics(selectedPeriod);
    if (res.error) toast.error(res.error);
    else setMetrics(res.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData(period);
  }, [period]);

  return (
    <div className="space-y-6">
      {/* ─── HEADER & PERIOD FILTER BAR ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard & Laporan Finansial
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ringkasan omzet, laba kotor, HPP, serta pengawasan stok persediaan kafe secara real-time.
          </p>
        </div>

        {/* Period Filter Selector */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-none">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'THIS_WEEK', label: 'Minggu Ini' },
            { id: 'THIS_MONTH', label: 'Bulan Ini' },
            { id: 'ALL', label: 'Semua Data' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150',
                period === p.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !metrics ? (
        <div className="flex items-center justify-center h-72 text-slate-400">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-500">Memuat laporan analitik...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ─── 1. KPI METRIC CARDS (FINANCIAL & SALES) ────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Sales */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Net Sales (Penjualan Bersih)
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {formatRupiah(metrics.netSales)}
              </p>
              <div className="text-[11px] text-slate-500 flex justify-between pt-2 border-t border-slate-100 font-mono">
                <span>Gross: {formatRupiah(metrics.grossSales)}</span>
                <span className="text-emerald-600 font-semibold">
                  Diskon: -{formatRupiah(metrics.totalDiscount)}
                </span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 shadow-xs hover:shadow-md transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Gross Profit (Laba Kotor)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Margin: {metrics.profitMargin}%
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-700">
                {formatRupiah(metrics.grossProfit)}
              </p>
              <p className="text-[11px] text-emerald-700/80 pt-2 border-t border-emerald-200/50">
                Formula: Net Sales - HPP Terjual
              </p>
            </div>

            {/* Total HPP / COGS */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total HPP (Biaya Pokok)
                </span>
                <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {formatRupiah(metrics.totalHpp)}
              </p>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                Berdasarkan WAC saat transaksi
              </p>
            </div>

            {/* AOV & Order Count */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Rata-rata Order (AOV)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {metrics.orderCount} Order
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {formatRupiah(metrics.aov)}
              </p>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                Net Sales / Jumlah Transaksi
              </p>
            </div>
          </div>

          {/* ─── 1.5 TODAY'S SHIFT & DEPOSIT SUMMARY ────────────────────────── */}
          <div className="p-6 rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    SETORAN HARIAN
                  </span>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Ringkasan Shift & Setoran Kasir Hari Ini
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pantau modal kas kecil, uang setoran fisik ke owner, omzet QRIS, dan status shift kasir hari ini.
                </p>
              </div>

              <Link
                href="/dashboard/pos/manage-shifts"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors w-fit"
              >
                <span>Kelola Shift Lengkap</span>
                <span className="text-emerald-400">&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Total Modal Awal */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Modal Awal Hari Ini
                </p>
                <p className="text-xl font-black font-mono text-white">
                  {formatRupiah(metrics.todayShiftSummary?.totalOpeningCash || 0)}
                </p>
                <p className="text-[10px] text-slate-400">Modal kas kecil kasir hari ini</p>
              </div>

              {/* Total Uang Disetor ke Owner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-xs space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                    Total Disetor ke Owner
                  </p>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-xl font-black font-mono text-emerald-400">
                  {formatRupiah(metrics.todayShiftSummary?.totalDepositedCash || 0)}
                </p>
                <p className="text-[10px] text-emerald-300/80">Uang fisik diserahkan ke owner</p>
              </div>

              {/* Total QRIS Hari Ini */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 backdrop-blur-xs space-y-1">
                <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
                  Total QRIS Hari Ini
                </p>
                <p className="text-xl font-black font-mono text-blue-300">
                  {formatRupiah(metrics.todayShiftSummary?.totalQris || 0)}
                </p>
                <p className="text-[10px] text-blue-300/80">Langsung masuk ke rekening bank</p>
              </div>

              {/* Status Shift Hari Ini */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Shift Berjalan Hari Ini
                </p>
                <p className="text-xl font-black font-mono text-white">
                  {metrics.todayShiftSummary?.shiftCount || 0} Shift
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                  {metrics.todayShiftSummary?.activeShiftCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {metrics.todayShiftSummary.activeShiftCount} Shift Sedang Aktif
                    </span>
                  ) : (
                    <span className="text-slate-400">Semua shift telah ditutup</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── 2. PAYMENT METRICS & REVENUE BREAKDOWN ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Payment Method Breakdown */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Distribusi Metode Pembayaran
              </h2>
              <div className="space-y-3">
                {/* Cash */}
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Tunai (CASH)</p>
                      <p className="text-[10px] text-slate-500">Masuk ke laci kasir kasir</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatRupiah(metrics.cashSales)}
                  </span>
                </div>

                {/* QRIS */}
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">QRIS (Non-Tunai)</p>
                      <p className="text-[10px] text-slate-500">Settlement rekening bank</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    {formatRupiah(metrics.qrisSales)}
                  </span>
                </div>
              </div>
            </div>

            {/* Taxes & Service Charge Details */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pajak & Service Charge
              </h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Pajak (PPN Toko):</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatRupiah(metrics.totalTax)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Service Charge:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatRupiah(metrics.totalServiceCharge)}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between font-bold text-sm">
                  <span className="text-slate-900">Total Tagihan (Grand Total):</span>
                  <span className="font-mono text-emerald-700 font-extrabold">
                    {formatRupiah(metrics.totalGrandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Menu Terlaris (Top Selling)
              </h2>
              {metrics.topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">Belum ada transaksi pada periode ini.</p>
              ) : (
                <div className="space-y-2.5">
                  {metrics.topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center border border-slate-200">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{p.name}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        {p.quantity} terjual
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── 3. LOW STOCK & INVENTORY ALERTS ─────────────────────────────── */}
          {metrics.stockAlerts.length > 0 && (
            <div className="p-5 rounded-2xl border border-amber-200/80 bg-amber-50/50 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-amber-950">
                      Peringatan Stok Menipis & Defisit ({metrics.stockAlerts.length} Bahan)
                    </h2>
                    <p className="text-xs text-amber-800/80">
                      Bahan baku berikut telah menyentuh batas minimum stok atau bernilai negatif.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard/inventory/opname"
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-2xs"
                  >
                    Stock Opname
                  </Link>
                  <Link
                    href="/dashboard/inventory/purchases/create"
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                  >
                    Beli Bahan (PO) &rarr;
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {metrics.stockAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-3.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{al.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Min: {al.minimumStock} {al.unitCode}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono font-bold text-xs px-2.5 py-1 rounded-lg border',
                        al.isNegative
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      )}
                    >
                      {al.currentQty} {al.unitCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 4. RECENT TRANSACTIONS TABLE ────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs space-y-2">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Transaksi Penjualan Terbaru</h2>
              <Link
                href="/dashboard/pos"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
              >
                Buka Layar Kasir &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-6">Waktu Transaksi</th>
                    <th className="py-3.5 px-6">No. Order</th>
                    <th className="py-3.5 px-6">Antrean</th>
                    <th className="py-3.5 px-6">Pelanggan</th>
                    <th className="py-3.5 px-6">Metode</th>
                    <th className="py-3.5 px-6 text-right">Total Tagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                        Belum ada transaksi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    metrics.recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6 text-xs text-slate-500 font-mono">
                          {formatDateTime(ord.createdAt)}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-xs text-emerald-700">
                          #{ord.orderNumber}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                            {ord.queueNumber || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {ord.customerName}
                        </td>
                        <td className="py-3.5 px-6">
                          <span
                            className={cn(
                              'inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              ord.paymentMethod === 'CASH'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            )}
                          >
                            {ord.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatRupiah(ord.grandTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
