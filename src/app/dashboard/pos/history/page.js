'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getShiftTransactions } from '@/app/actions/pos';
import { getCurrentShift } from '@/app/actions/shift';
import ThermalReceipt from '@/components/pos/ThermalReceipt';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useBluetooth, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';

function formatRupiah(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(num));
}

function formatDateTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function ShiftHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [shiftData, setShiftData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  // hasNoShift: true jika kasir belum membuka shift — blokir fetch transaksi
  const [hasNoShift, setHasNoShift] = useState(false);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Detail Modal & Thermal Print State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printMode, setPrintMode] = useState('CUSTOMER');

  // Bluetooth Printer — koneksi global dari context
  const { isConnected: btConnected, printBytes } = useBluetooth();

  async function loadTransactions() {
    setLoading(true);
    setHasNoShift(false);
    try {
      // ── 1. Cek shift aktif kasir terlebih dahulu ───────────────────────────
      const shiftRes = await getCurrentShift();

      if (!shiftRes?.data) {
        // Tidak ada shift aktif — tampilkan empty state, JANGAN fetch transaksi
        setHasNoShift(true);
        setLoading(false);
        return;
      }

      // ── 2. Ada shift aktif — fetch HANYA transaksi shift ini ──────────────
      const res = await getShiftTransactions({ shiftId: shiftRes.data.id });
      if (res?.error) {
        if (res.sessionRevoked || res.error.includes('Sesi tidak valid')) {
          try { sessionStorage.clear(); localStorage.clear(); } catch { }
          window.location.replace('/api/auth/clear-session');
          return;
        }
        toast.error(res.error);
      } else if (res?.data) {
        setShiftData(res.data.shift);
        setStoreData(res.data.store);
        setTransactions(res.data.transactions || []);
      }
    } catch (err) {
      console.error('[loadTransactions] Error:', err);
      toast.error('Gagal mengambil riwayat transaksi shift.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((order) => {
      const matchMethod =
        methodFilter === 'ALL' ||
        (order.payment?.method && order.payment.method === methodFilter);

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchMethod;

      const matchOrderNum = order.orderNumber?.toLowerCase().includes(q);
      const matchQueue = order.queueNumber?.toLowerCase().includes(q);
      const matchCustomer = order.customerNameSnapshot?.toLowerCase().includes(q);
      const matchPhone = order.customerPhoneSnapshot?.toLowerCase().includes(q);
      const matchCashier = (order.createdBy?.name || order.payment?.shift?.user?.name)?.toLowerCase().includes(q);
      const matchShift = order.payment?.shift?.id?.toLowerCase().includes(q);

      return matchMethod && (matchOrderNum || matchQueue || matchCustomer || matchPhone || matchCashier || matchShift);
    });
  }, [transactions, searchQuery, methodFilter]);

  // Statistik Ringkasan Shift
  const shiftStats = useMemo(() => {
    const totalTrx = transactions.length;
    const totalOmset = transactions.reduce(
      (sum, o) => sum + Number(o.cashPayable || o.grandTotal || 0),
      0
    );
    const cashCount = transactions.filter((o) => o.payment?.method === 'CASH').length;
    const qrisCount = transactions.filter((o) => o.payment?.method === 'QRIS').length;

    return { totalTrx, totalOmset, cashCount, qrisCount };
  }, [transactions]);

  // Eksekusi Cetak Thermal
  const handlePrint = (order, mode) => {
    if (!order) {
      toast.error('Data transaksi tidak tersedia.');
      return;
    }

    // ── Path 1: Bluetooth BLE (jika printer terhubung via context) ─────────
    if (btConnected) {
      const store = {
        name: storeData?.name || 'SCHAW CAFE',
        printerWidth: storeData?.printerWidth || storeData?.settings?.printerWidth || 58,
        code: storeData?.code || 'MAIN',
      };

      toast.loading(
        mode === 'KITCHEN' ? 'Mengirim tiket dapur ke printer...' : 'Mengirim struk ke printer Bluetooth...',
        { id: 'thermal-print', duration: 8000 }
      );

      setPrintOrder(order);
      setPrintMode(mode);

      const bytes = buildReceiptBytes(order, store, mode);
      printBytes(bytes)
        .then(() => {
          toast.success(
            mode === 'KITCHEN' ? 'Tiket dapur berhasil dicetak!' : 'Struk berhasil dicetak!',
            { id: 'thermal-print', duration: 3000 }
          );
        })
        .catch((err) => {
          console.error('[BLE Print Error]', err);
          toast.error(
            'Gagal cetak via Bluetooth: ' + (err.message || 'Cek koneksi printer.'),
            { id: 'thermal-print' }
          );
        });
      return;
    }

    // Printer BLE tidak terhubung — tampilkan pesan yang jelas
    toast.error(
      'Printer Bluetooth belum terhubung. Hubungkan printer di halaman Pengaturan terlebih dahulu.',
      { duration: 5000 }
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── Hidden Printable Thermal Receipt Container ───────────────────────── */}
      <ThermalReceipt order={printOrder} store={storeData} printMode={printMode} />

      {/* ─── 1. Header & Navigation ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Kembali ke Layar POS
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Kasir POS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar riwayat transaksi penjualan kasir, informasi kasir &amp; shift yang melayani, serta cetak ulang struk.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <svg
              className={cn('w-4 h-4 text-slate-500', loading && 'animate-spin')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Muat Ulang
          </button>
        </div>
      </div>

      {/* ─── 2. Empty State — Belum Buka Shift ───────────────────────────────── */}
      {!loading && hasNoShift && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5 border-2 border-slate-200">
            <svg className="w-9 h-9 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Shift Kasir Belum Dibuka</h2>
          <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            Anda harus membuka shift kasir terlebih dahulu untuk melihat riwayat transaksi.
            Riwayat hanya menampilkan transaksi dari shift Anda yang sedang aktif.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/dashboard/pos/shift"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Buka Shift Kasir Sekarang
            </Link>
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl shadow-2xs transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Kembali ke Layar POS
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-6">
            Ingin melihat semua transaksi toko? Akses menu{' '}
            <Link href="/dashboard/transactions" className="text-emerald-600 font-semibold hover:underline">
              Semua Transaksi
            </Link>{' '}(khusus Owner).
          </p>
        </div>
      )}

      {/* ─── Konten Utama (Shift Aktif) ─────────────────────────────────────── */}
      {!hasNoShift && (
        <>
          {/* ─── 2. Shift Info & Stats Card ─────────────────────────────────── */}
          {shiftData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status Shift</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Aktif (OPEN)
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 mt-2 truncate">
              {shiftData.user?.name || 'Kasir'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Mulai: {formatDateTime(shiftData.startTime || shiftData.openedAt)}
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Modal Kas Awal</span>
            <p className="text-xl font-bold text-slate-900 mt-2">
              {formatRupiah(shiftData.openingCash)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Kas fisik di laci saat buka shift</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Total Penjualan Shift</span>
            <p className="text-xl font-bold text-emerald-600 mt-2">
              {formatRupiah(shiftStats.totalOmset)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {shiftStats.totalTrx} transaksi berhasil
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Metode Pembayaran</span>
            <div className="flex items-center gap-4 mt-2">
              <div>
                <span className="text-xs text-slate-500">Tunai (Cash):</span>
                <p className="text-sm font-bold text-slate-800">{shiftStats.cashCount} Trx</p>
              </div>
              <div className="w-px h-7 bg-slate-200" />
              <div>
                <span className="text-xs text-slate-500">QRIS:</span>
                <p className="text-sm font-bold text-slate-800">{shiftStats.qrisCount} Trx</p>
              </div>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
            <span>
              <strong>Mode Riwayat Toko:</strong> Tidak ada shift aktif untuk kasir Anda saat ini. Menampilkan riwayat transaksi penjualan toko.
            </span>
          </div>
          <Link
            href="/dashboard/pos/shift"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            Buka Shift Kasir Baru &rarr;
          </Link>
        </div>
      )}

      {/* ─── 3. Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. order, antrean, pelanggan..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Method Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <span className="text-xs font-medium text-slate-500 mr-1 hidden sm:inline">
            Metode:
          </span>
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'CASH', label: 'Cash / Tunai' },
            { id: 'QRIS', label: 'QRIS' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMethodFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                methodFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 4. Transactions Table / Cards ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Memuat transaksi shift...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {transactions.length === 0
                ? 'Belum Ada Transaksi'
                : 'Tidak Ada Transaksi Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {transactions.length === 0
                ? 'Seluruh transaksi kasir yang selesai dibayar pada shift ini akan muncul di sini.'
                : 'Coba ubah kata kunci pencarian atau ganti filter metode pembayaran.'}
            </p>
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
                  <th className="py-3 px-4">Menu Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.map((order) => {
                  const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0;
                  const finalAmount = order.cashPayable || order.grandTotal;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Waktu */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        <div>{formatTime(order.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                      </td>

                      {/* No Order */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-800">
                        {order.orderNumber}
                      </td>

                      {/* Kasir */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          <span className="truncate max-w-28">
                            {order.createdBy?.name || order.payment?.shift?.user?.name || 'Kasir'}
                          </span>
                        </div>
                        {(order.createdBy?.username || order.payment?.shift?.user?.username) && (
                          <div className="text-[10px] text-slate-400 font-mono pl-5">
                            @{order.createdBy?.username || order.payment?.shift?.user?.username}
                          </div>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.payment?.shift ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                Shift #{order.payment.shift.id.slice(-6).toUpperCase()}
                              </span>
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                                  order.payment.shift.status === 'OPEN'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                                )}
                              >
                                {order.payment.shift.status === 'OPEN' ? 'Aktif' : 'Tutup'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {formatTime(order.payment.shift.openedAt)}
                              {order.payment.shift.closedAt ? ` - ${formatTime(order.payment.shift.closedAt)}` : ' - Sekarang'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Tanpa Shift</span>
                        )}
                      </td>

                      {/* Antrean */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-slate-900 text-white shadow-2xs">
                          {order.queueNumber || '-'}
                        </span>
                      </td>

                      {/* Pelanggan */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 truncate max-w-32.5">
                          {order.customerNameSnapshot || order.customer?.name || 'Pelanggan'}
                        </div>
                        {order.customerPhoneSnapshot && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {order.customerPhoneSnapshot}
                          </div>
                        )}
                      </td>

                      {/* Menu Items */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-600 font-medium">
                          {itemCount} item
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-40">
                          {order.items?.map((it) => it.productNameSnapshot).join(', ')}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">
                        {formatRupiah(finalAmount)}
                      </td>

                      {/* Metode Pembayaran */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold',
                            order.payment?.method === 'QRIS'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {order.payment?.method || 'CASH'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Lunas
                        </span>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Lihat Detail
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

      {/* ─── 5. MODAL DETAIL PESANAN & CETAK STRUK ─────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Detail Transaksi #{selectedOrder.orderNumber}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-slate-900 text-white">
                    Antrean {selectedOrder.queueNumber || '-'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Waktu: {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Info Pelanggan & Kasir */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Nama Pelanggan
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedOrder.customerNameSnapshot || selectedOrder.customer?.name || 'Umum'}
                  </span>
                  {selectedOrder.customerPhoneSnapshot && (
                    <span className="text-[11px] text-slate-500 block font-mono">
                      {selectedOrder.customerPhoneSnapshot}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Kasir &amp; Shift
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedOrder.createdBy?.name || selectedOrder.payment?.shift?.user?.name || 'Kasir'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {selectedOrder.payment?.shift
                      ? `Shift #${selectedOrder.payment.shift.id.slice(-6).toUpperCase()} (${selectedOrder.payment.shift.status === 'OPEN' ? 'Aktif' : 'Tutup'})`
                      : 'Sumber: ' + (selectedOrder.source === 'PUBLIC_QR' ? 'QR Meja Online' : 'Kasir POS')}
                  </span>
                </div>
              </div>

              {/* Rincian Item yang Dipesan */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Daftar Pesanan ({selectedOrder.items?.length || 0} Item)
                </h3>
                <div className="divide-y divide-slate-100 border rounded-xl p-3 bg-white">
                  {selectedOrder.items?.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-start justify-between py-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.productNameSnapshot}
                          {item.variantNameSnapshot && (
                            <span className="text-slate-500 font-normal text-[11px] ml-1">
                              ({item.variantNameSnapshot})
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-amber-700 italic bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            Catatan: {item.notes}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.quantity} x {formatRupiah(item.unitPrice)}
                        </div>
                      </div>

                      <div className="text-right font-bold text-slate-800">
                        {formatRupiah(item.subtotal)}
                        {item.promotionDiscount > 0 && (
                          <div className="text-[10px] text-rose-500 font-medium">
                            Diskon: -{formatRupiah(item.promotionDiscount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rincian Kalkulasi Finansial */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Menu:</span>
                  <span className="font-medium">{formatRupiah(selectedOrder.productSubtotal)}</span>
                </div>

                {selectedOrder.promotionDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Diskon Promosi:</span>
                    <span>-{formatRupiah(selectedOrder.promotionDiscount)}</span>
                  </div>
                )}

                {selectedOrder.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Layanan ({selectedOrder.serviceChargeRate}%):</span>
                    <span>{formatRupiah(selectedOrder.serviceChargeAmount)}</span>
                  </div>
                )}

                {selectedOrder.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak (PPN {selectedOrder.taxRate}%):</span>
                    <span>{formatRupiah(selectedOrder.taxAmount)}</span>
                  </div>
                )}

                {selectedOrder.roundingAmount !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Pembulatan Tunai:</span>
                    <span>{formatRupiah(selectedOrder.roundingAmount)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-xs font-black text-slate-900">
                  <span>Grand Total Tagihan:</span>
                  <span className="text-emerald-600">
                    {formatRupiah(selectedOrder.cashPayable || selectedOrder.grandTotal)}
                  </span>
                </div>

                {/* Pembayaran Detail */}
                <div className="border-t border-dashed border-slate-200 pt-1.5 space-y-1">
                  <div className="flex justify-between text-slate-700 font-semibold">
                    <span>Metode Bayar:</span>
                    <span>{selectedOrder.payment?.method || 'CASH'}</span>
                  </div>

                  {selectedOrder.payment?.method === 'CASH' && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Uang Diterima:</span>
                        <span>
                          {formatRupiah(
                            selectedOrder.payment?.cashReceived ||
                            selectedOrder.cashPayable ||
                            selectedOrder.grandTotal
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Kembalian:</span>
                        <span>{formatRupiah(selectedOrder.payment?.changeAmount || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer: Action Buttons (Cetak Struk & Cetak Tiket Dapur) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center gap-2.5">
              {/* Tombol 1: Cetak Struk Pelanggan */}
              <button
                onClick={() => handlePrint(selectedOrder, 'CUSTOMER')}
                className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.418 3.582-8 8-8s8 3.582 8 8c0 1.109-.13 2.189-.37 3.229M3.75 17.25h16.5m-16.5 0a2.25 2.25 0 00-2.25 2.25v.75a2.25 2.25 0 002.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-.75a2.25 2.25 0 00-2.25-2.25m-16.5 0v-3.75a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v3.75m-9.75-9.75h7.5" />
                </svg>
                Cetak Struk Pelanggan
              </button>

              {/* Tombol 2: Cetak Tiket Dapur */}
              <button
                onClick={() => handlePrint(selectedOrder, 'KITCHEN')}
                className="w-full sm:flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Cetak Tiket Dapur
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
