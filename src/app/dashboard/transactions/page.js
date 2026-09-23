'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { getAllTransactions } from '@/app/actions/pos';
import ThermalReceipt from '@/components/pos/ThermalReceipt';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useBluetooth, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';

function formatRupiah(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(num));
}

function formatDateTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function toISODateString(date) { return date.toISOString().split('T')[0]; }

function buildDateRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'TODAY': { const d = toISODateString(now); return { dateFrom: d, dateTo: d }; }
    case 'YESTERDAY': { const y = new Date(now); y.setDate(y.getDate() - 1); const d = toISODateString(y); return { dateFrom: d, dateTo: d }; }
    case 'LAST_7_DAYS': { const from = new Date(now); from.setDate(from.getDate() - 6); return { dateFrom: toISODateString(from), dateTo: toISODateString(now) }; }
    case 'THIS_MONTH': { const first = new Date(now.getFullYear(), now.getMonth(), 1); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0); return { dateFrom: toISODateString(first), dateTo: toISODateString(last) }; }
    default: return { dateFrom: null, dateTo: null };
  }
}

const DATE_PRESETS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: 'LAST_7_DAYS', label: '7 Hari' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'CUSTOM', label: 'Kustom' },
  { id: 'ALL', label: 'Semua' },
];

export default function AllTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [isCapped, setIsCapped] = useState(false);
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printMode, setPrintMode] = useState('CUSTOMER');
  const { isConnected: btConnected, printBytes } = useBluetooth();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let dateFrom = null; let dateTo = null;
      if (datePreset === 'CUSTOM') { dateFrom = customDateFrom || null; dateTo = customDateTo || null; }
      else { const range = buildDateRange(datePreset); dateFrom = range.dateFrom; dateTo = range.dateTo; }
      const res = await getAllTransactions({ dateFrom, dateTo, cashierId: cashierFilter !== 'ALL' ? cashierFilter : null, paymentMethod: methodFilter !== 'ALL' ? methodFilter : null, limit: 500 });
      if (res?.error) {
        if (res.sessionRevoked || res.error.includes('Sesi tidak valid')) { try { sessionStorage.clear(); localStorage.clear(); } catch {} window.location.replace('/api/auth/clear-session'); return; }
        toast.error(res.error);
      } else if (res?.data) {
        setTransactions(res.data.transactions || []); setCashiers(res.data.cashiers || []); setStoreData(res.data.store); setIsCapped(res.data.isCapped || false);
      }
    } catch (err) { console.error('[AllTransactionsPage]', err); toast.error('Gagal memuat transaksi.'); }
    finally { setLoading(false); }
  }, [datePreset, customDateFrom, customDateTo, cashierFilter, methodFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((o) =>
      o.orderNumber?.toLowerCase().includes(q) || o.queueNumber?.toLowerCase().includes(q) ||
      o.customerNameSnapshot?.toLowerCase().includes(q) || o.customerPhoneSnapshot?.toLowerCase().includes(q) ||
      o.createdBy?.name?.toLowerCase().includes(q) || o.createdBy?.username?.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const stats = useMemo(() => {
    const cashTrx = filteredTransactions.filter((o) => o.payment?.method === 'CASH');
    const qrisTrx = filteredTransactions.filter((o) => o.payment?.method === 'QRIS');
    const totalOmset = filteredTransactions.reduce((sum, o) => sum + Number(o.cashPayable || o.grandTotal || 0), 0);
    const cashOmset = cashTrx.reduce((sum, o) => sum + Number(o.cashPayable || o.grandTotal || 0), 0);
    const qrisOmset = qrisTrx.reduce((sum, o) => sum + Number(o.cashPayable || o.grandTotal || 0), 0);
    return { totalTrx: filteredTransactions.length, totalOmset, cashCount: cashTrx.length, qrisCount: qrisTrx.length, cashOmset, qrisOmset };
  }, [filteredTransactions]);

  const handlePrint = (order, mode) => {
    if (!order) { toast.error('Data transaksi tidak tersedia.'); return; }
    if (btConnected) {
      const store = { name: storeData?.name || 'SCHAW CAFE', printerWidth: storeData?.printerWidth || 58, code: storeData?.code || 'MAIN' };
      toast.loading(mode === 'KITCHEN' ? 'Mencetak tiket dapur...' : 'Mencetak struk...', { id: 'thermal-print', duration: 8000 });
      setPrintOrder(order); setPrintMode(mode);
      printBytes(buildReceiptBytes(order, store, mode))
        .then(() => toast.success(mode === 'KITCHEN' ? 'Tiket dapur dicetak!' : 'Struk dicetak!', { id: 'thermal-print', duration: 3000 }))
        .catch((err) => toast.error('Gagal cetak: ' + (err.message || 'Cek printer.'), { id: 'thermal-print' }));
      return;
    }
    toast.error('Printer Bluetooth belum terhubung. Hubungkan di Pengaturan.', { duration: 5000 });
  };

  return (
    <div className="space-y-6">
      <ThermalReceipt order={printOrder} store={storeData} printMode={printMode} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Dashboard
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Laporan & Keuangan</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            </span>
            Semua Transaksi Toko
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Pandangan menyeluruh seluruh transaksi penjualan — khusus Owner &amp; Manager.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {isCapped && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium">⚠ Maks 500 ditampilkan</span>}
          <button onClick={fetchTransactions} disabled={loading} className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer">
            <svg className={cn('w-4 h-4 text-slate-500', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 shrink-0">Periode:</span>
          {DATE_PRESETS.map((p) => (
            <button key={p.id} onClick={() => setDatePreset(p.id)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer', datePreset === p.id ? 'bg-violet-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium">Dari:</span>
            <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <span className="text-xs text-slate-500 font-medium">Sampai:</span>
            <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500">Kasir:</span>
            <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer">
              <option value="ALL">Semua Kasir</option>
              {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name} (@{c.username})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 shrink-0">Metode:</span>
            {[{ id: 'ALL', label: 'Semua' }, { id: 'CASH', label: 'Cash' }, { id: 'QRIS', label: 'QRIS' }].map((m) => (
              <button key={m.id} onClick={() => setMethodFilter(m.id)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer', methodFilter === m.id ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72 md:ml-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari no. order, kasir, pelanggan..." className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Stats Cards — dari filteredTransactions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Total Transaksi</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalTrx}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">pesanan lunas</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Total Omzet</span>
          <p className="text-lg font-black text-emerald-600 mt-1 leading-tight">{formatRupiah(stats.totalOmset)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cash + QRIS gabungan</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Tunai (Cash)</span>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">{stats.cashCount} Trx</span>
          </div>
          <p className="text-lg font-black text-slate-800 mt-1 leading-tight">{formatRupiah(stats.cashOmset)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.totalOmset > 0 ? Math.round((stats.cashOmset / stats.totalOmset) * 100) : 0}% dari total</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">QRIS</span>
            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">{stats.qrisCount} Trx</span>
          </div>
          <p className="text-lg font-black text-slate-800 mt-1 leading-tight">{formatRupiah(stats.qrisOmset)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.totalOmset > 0 ? Math.round((stats.qrisOmset / stats.totalOmset) * 100) : 0}% dari total</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Memuat transaksi...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak Ada Transaksi</h3>
            <p className="text-xs text-slate-500 mt-1">Tidak ditemukan transaksi sesuai filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">No. Order</th>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Antrean</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.map((order) => {
                  const itemCount = order.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        <div>{formatTime(order.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-800">{order.orderNumber}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 truncate max-w-28">{order.createdBy?.name || order.payment?.shift?.user?.name || 'Kasir'}</div>
                        {(order.createdBy?.username) && <div className="text-[10px] text-slate-400 font-mono">@{order.createdBy.username}</div>}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.payment?.shift ? (
                          <span className="font-mono font-bold text-slate-700 text-[11px]">
                            #{order.payment.shift.id.slice(-6).toUpperCase()}
                            <span className={cn('ml-1 px-1 py-0.5 rounded text-[9px] font-bold', order.payment.shift.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                              {order.payment.shift.status === 'OPEN' ? 'Aktif' : 'Tutup'}
                            </span>
                          </span>
                        ) : <span className="text-slate-400 italic text-[11px]">—</span>}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-slate-900 text-white shadow-2xs">{order.queueNumber || '-'}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 truncate max-w-28">{order.customerNameSnapshot || order.customer?.name || 'Umum'}</div>
                        {order.customerPhoneSnapshot && <div className="text-[10px] text-slate-400 font-mono">{order.customerPhoneSnapshot}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-600 font-medium">{itemCount} item</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-36">{order.items?.map((it) => it.productNameSnapshot).join(', ')}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">{formatRupiah(order.cashPayable || order.grandTotal)}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold', order.payment?.method === 'QRIS' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700')}>
                          {order.payment?.method || 'CASH'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button onClick={() => setSelectedOrder(order)} className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Detail #{selectedOrder.orderNumber}</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-slate-900 text-white">Antrean {selectedOrder.queueNumber || '-'}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pelanggan</span>
                  <span className="font-semibold text-slate-800">{selectedOrder.customerNameSnapshot || selectedOrder.customer?.name || 'Umum'}</span>
                  {selectedOrder.customerPhoneSnapshot && <span className="text-[11px] text-slate-500 block font-mono">{selectedOrder.customerPhoneSnapshot}</span>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Kasir & Shift</span>
                  <span className="font-semibold text-slate-800">{selectedOrder.createdBy?.name || selectedOrder.payment?.shift?.user?.name || 'Kasir'}</span>
                  <span className="text-[11px] text-slate-500 block">{selectedOrder.payment?.shift ? `Shift #${selectedOrder.payment.shift.id.slice(-6).toUpperCase()} (${selectedOrder.payment.shift.status === 'OPEN' ? 'Aktif' : 'Tutup'})` : `Sumber: ${selectedOrder.source === 'PUBLIC_QR' ? 'QR Meja' : 'Kasir POS'}`}</span>
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Daftar Pesanan ({selectedOrder.items?.length || 0} Item)</h3>
                <div className="divide-y divide-slate-100 border rounded-xl p-3 bg-white">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-start justify-between py-2">
                      <div>
                        <div className="font-semibold text-slate-900">{item.productNameSnapshot}{item.variantNameSnapshot && <span className="text-slate-500 font-normal text-[11px] ml-1">({item.variantNameSnapshot})</span>}</div>
                        {item.notes && <div className="text-[11px] text-amber-700 italic bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">Catatan: {item.notes}</div>}
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.quantity} x {formatRupiah(item.unitPrice)}</div>
                      </div>
                      <div className="text-right font-bold text-slate-800">
                        {formatRupiah(item.subtotal)}
                        {item.promotionDiscount > 0 && <div className="text-[10px] text-rose-500">-{formatRupiah(item.promotionDiscount)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span className="font-medium">{formatRupiah(selectedOrder.productSubtotal)}</span></div>
                {selectedOrder.promotionDiscount > 0 && <div className="flex justify-between text-rose-600 font-medium"><span>Diskon:</span><span>-{formatRupiah(selectedOrder.promotionDiscount)}</span></div>}
                {selectedOrder.serviceChargeAmount > 0 && <div className="flex justify-between text-slate-600"><span>Biaya Layanan ({selectedOrder.serviceChargeRate}%):</span><span>{formatRupiah(selectedOrder.serviceChargeAmount)}</span></div>}
                {selectedOrder.taxAmount > 0 && <div className="flex justify-between text-slate-600"><span>PPN ({selectedOrder.taxRate}%):</span><span>{formatRupiah(selectedOrder.taxAmount)}</span></div>}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-xs font-black text-slate-900"><span>Grand Total:</span><span className="text-emerald-600">{formatRupiah(selectedOrder.cashPayable || selectedOrder.grandTotal)}</span></div>
                <div className="border-t border-dashed border-slate-200 pt-1.5 space-y-1">
                  <div className="flex justify-between text-slate-700 font-semibold"><span>Metode Bayar:</span><span>{selectedOrder.payment?.method || 'CASH'}</span></div>
                  {selectedOrder.payment?.method === 'CASH' && (<>
                    <div className="flex justify-between text-slate-600"><span>Diterima:</span><span>{formatRupiah(selectedOrder.payment?.cashReceived || selectedOrder.cashPayable || selectedOrder.grandTotal)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Kembalian:</span><span>{formatRupiah(selectedOrder.payment?.changeAmount || 0)}</span></div>
                  </>)}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center gap-2.5">
              <button onClick={() => handlePrint(selectedOrder, 'CUSTOMER')} className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.418 3.582-8 8-8s8 3.582 8 8c0 1.109-.13 2.189-.37 3.229M3.75 17.25h16.5m-16.5 0a2.25 2.25 0 00-2.25 2.25v.75a2.25 2.25 0 002.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-.75a2.25 2.25 0 00-2.25-2.25m-16.5 0v-3.75a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v3.75m-9.75-9.75h7.5" /></svg>
                Cetak Struk
              </button>
              <button onClick={() => handlePrint(selectedOrder, 'KITCHEN')} className="w-full sm:flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                Cetak Tiket Dapur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
