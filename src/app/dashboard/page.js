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
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER & PERIOD FILTER BAR ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-amber-50 tracking-tight">
            Dashboard & Laporan Finansial
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Ringkasan omzet, laba kotor, HPP, serta pengawasan stok persediaan kafe secara real-time.
          </p>
        </div>

        {/* Period Pills */}
        <div className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-2xl border border-stone-800 overflow-x-auto scrollbar-none">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'THIS_WEEK', label: 'Minggu Ini' },
            { id: 'THIS_MONTH', label: 'Bulan Ini' },
            { id: 'ALL', label: 'Semua' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                period === p.id
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                  : 'text-stone-400 hover:text-stone-200'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !metrics ? (
        <div className="flex items-center justify-center h-72 text-stone-500">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Memuat laporan analitik...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ─── 1. KPI CARDS GRID (FINANCIAL & SALES) ────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Sales */}
            <div className="p-5 rounded-3xl border border-stone-800/80 bg-stone-900/60 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Net Sales (Penjualan Bersih)
                </span>
                <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-amber-50">
                {formatRupiah(metrics.netSales)}
              </p>
              <div className="text-[11px] text-stone-500 flex justify-between pt-1 border-t border-stone-800/60">
                <span>Gross: {formatRupiah(metrics.grossSales)}</span>
                <span className="text-emerald-400">
                  Diskon: -{formatRupiah(metrics.totalDiscount)}
                </span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="p-5 rounded-3xl border border-emerald-900/40 bg-linear-to-br from-stone-900 via-stone-900 to-emerald-950/20 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Gross Profit (Laba Kotor)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  Margin: {metrics.profitMargin}%
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-emerald-400">
                {formatRupiah(metrics.grossProfit)}
              </p>
              <p className="text-[11px] text-stone-400 pt-1 border-t border-stone-800/60">
                Rumus: Net Sales - HPP Bahan Baku
              </p>
            </div>

            {/* Total HPP / COGS */}
            <div className="p-5 rounded-3xl border border-stone-800/80 bg-stone-900/60 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Total HPP (Beban Pokok)
                </span>
                <span className="p-2 rounded-xl bg-red-950/60 text-red-400 border border-red-800/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-red-300">
                {formatRupiah(metrics.totalHpp)}
              </p>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-800/60">
                Berdasarkan WAC saat transaksi
              </p>
            </div>

            {/* AOV & Orders */}
            <div className="p-5 rounded-3xl border border-stone-800/80 bg-stone-900/60 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Rata-rata Order (AOV)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-800 text-stone-300">
                  {metrics.orderCount} Order
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-amber-300">
                {formatRupiah(metrics.aov)}
              </p>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-800/60">
                Net Sales dibagi jumlah transaksi
              </p>
            </div>
          </div>

          {/* ─── 2. PAYMENT METRICS & REVENUE BREAKDOWN ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Payment Method Breakdown */}
            <div className="p-6 rounded-3xl border border-stone-800/80 bg-stone-900/50 space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Distribusi Pembayaran
              </h2>
              <div className="space-y-3">
                {/* Cash */}
                <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-amber-100">Tunai (CASH)</p>
                      <p className="text-[10px] text-stone-400">Masuk ke laci kasir</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {formatRupiah(metrics.cashSales)}
                  </span>
                </div>

                {/* QRIS */}
                <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-blue-100">QRIS (Non-Tunai)</p>
                      <p className="text-[10px] text-stone-400">Masuk ke rekening bank</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-blue-300 text-sm">
                    {formatRupiah(metrics.qrisSales)}
                  </span>
                </div>
              </div>
            </div>

            {/* Taxes & Service Charge Details */}
            <div className="p-6 rounded-3xl border border-stone-800/80 bg-stone-900/50 space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Pajak & Service Charge
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Pajak (PPN Toko):</span>
                  <span className="font-mono font-semibold text-stone-200">
                    {formatRupiah(metrics.totalTax)}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Service Charge:</span>
                  <span className="font-mono font-semibold text-stone-200">
                    {formatRupiah(metrics.totalServiceCharge)}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-800 flex justify-between font-bold text-sm">
                  <span className="text-amber-100">Total Tagihan (Grand Total):</span>
                  <span className="font-mono text-amber-400">
                    {formatRupiah(metrics.totalGrandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div className="p-6 rounded-3xl border border-stone-800/80 bg-stone-900/50 space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Menu Terlaris (Top Selling)
              </h2>
              {metrics.topProducts.length === 0 ? (
                <p className="text-xs text-stone-500 py-4">Belum ada transaksi pada periode ini.</p>
              ) : (
                <div className="space-y-2.5">
                  {metrics.topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-stone-800 text-amber-400 font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-amber-50">{p.name}</span>
                      </div>
                      <span className="font-mono font-bold text-stone-300">
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
            <div className="p-6 rounded-3xl border border-amber-800/50 bg-amber-950/20 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-900/60 text-amber-400 border border-amber-700/50">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-amber-200">
                      Peringatan Stok Menipis & Defisit ({metrics.stockAlerts.length} Bahan)
                    </h2>
                    <p className="text-xs text-amber-400/80">
                      Bahan baku berikut telah menyentuh batas minimum stok atau berstatus negatif.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard/inventory/opname"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-700/40 hover:bg-amber-700 text-amber-200 hover:text-white border border-amber-600/50 text-xs font-semibold transition-all"
                  >
                    Stock Opname
                  </Link>
                  <Link
                    href="/dashboard/inventory/purchases/create"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all"
                  >
                    Beli Bahan (PO)
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {metrics.stockAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-3.5 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-amber-50">{al.name}</p>
                      <p className="text-[10px] text-stone-500 font-mono">
                        Min: {al.minimumStock} {al.unitCode}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono font-bold text-xs px-2.5 py-1 rounded-lg border',
                        al.isNegative
                          ? 'bg-red-950/80 text-red-400 border-red-800'
                          : 'bg-amber-950/80 text-amber-400 border-amber-800'
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
          <div className="rounded-3xl border border-stone-800/80 bg-stone-900/50 overflow-hidden shadow-xl space-y-2">
            <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-50">Transaksi Penjualan Terbaru</h2>
              <Link
                href="/dashboard/pos"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Buka Layar Kasir &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-300">
                <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
                  <tr>
                    <th className="py-3 px-6">Waktu Transaksi</th>
                    <th className="py-3 px-6">No. Order</th>
                    <th className="py-3 px-6">Antrean</th>
                    <th className="py-3 px-6">Pelanggan</th>
                    <th className="py-3 px-6">Metode</th>
                    <th className="py-3 px-6 text-right">Total Tagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {metrics.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500 text-xs">
                        Belum ada transaksi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    metrics.recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-stone-800/30 transition-colors">
                        <td className="py-3 px-6 text-xs text-stone-400 font-mono">
                          {formatDateTime(ord.createdAt)}
                        </td>
                        <td className="py-3 px-6 font-mono font-bold text-xs text-amber-300">
                          #{ord.orderNumber}
                        </td>
                        <td className="py-3 px-6">
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-stone-800 text-stone-200">
                            {ord.queueNumber || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-6 font-semibold text-amber-50">
                          {ord.customerName}
                        </td>
                        <td className="py-3 px-6">
                          <span
                            className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-bold border',
                              ord.paymentMethod === 'CASH'
                                ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                                : 'bg-blue-950/60 text-blue-400 border-blue-800/50'
                            )}
                          >
                            {ord.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-amber-400">
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
