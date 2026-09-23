'use client';

import { useState, useEffect, useMemo, use, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getSupplierPurchaseHistory } from '@/app/actions/supplier';
import { formatRupiah, formatDate, formatDateTime, cn } from '@/lib/utils';

export default function SupplierDetailPage({ params }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CONFIRMED' | 'DRAFT'

  // Accordion State: menyimpan set of purchase ID yang sedang terbuka
  const [expandedPOs, setExpandedPOs] = useState({});

  async function loadData() {
    setLoading(true);
    const res = await getSupplierPurchaseHistory(resolvedParams.id);
    if (res.error) {
      toast.error(res.error);
    } else {
      setSupplier(res.data);
      // Buka PO pertama secara default jika ada
      if (res.data?.purchases?.length > 0) {
        setExpandedPOs({ [res.data.purchases[0].id]: true });
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  // Toggle Accordion per Purchase PO
  const togglePO = (poId) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [poId]: !prev[poId],
    }));
  };

  const expandAll = () => {
    const all = {};
    (supplier?.purchases || []).forEach((p) => {
      all[p.id] = true;
    });
    setExpandedPOs(all);
  };

  const collapseAll = () => {
    setExpandedPOs({});
  };

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    if (!supplier?.purchases) return [];

    return supplier.purchases.filter((p) => {
      const matchStatus =
        statusFilter === 'ALL' || p.status === statusFilter;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchStatus;

      const matchPoNumber = p.purchaseNumber?.toLowerCase().includes(q);
      const matchCreator = p.createdBy?.name?.toLowerCase().includes(q);
      const matchItems = p.items?.some((item) =>
        item.inventoryItem?.name?.toLowerCase().includes(q) ||
        item.inventoryItem?.category?.name?.toLowerCase().includes(q)
      );

      return matchStatus && (matchPoNumber || matchCreator || matchItems);
    });
  }, [supplier?.purchases, searchQuery, statusFilter]);

  // Ringkasan Statistik Supplier
  const stats = useMemo(() => {
    if (!supplier?.purchases) {
      return { totalPurchases: 0, totalSpend: 0, confirmedCount: 0, uniqueItemCount: 0 };
    }

    const totalPurchases = supplier.purchases.length;
    const totalSpend = supplier.purchases.reduce(
      (sum, p) => sum + (p.status === 'CONFIRMED' ? Number(p.totalAmount || 0) : 0),
      0
    );
    const confirmedCount = supplier.purchases.filter((p) => p.status === 'CONFIRMED').length;

    // Hitung jenis barang unik yang pernah dibeli
    const itemIds = new Set();
    supplier.purchases.forEach((p) => {
      p.items?.forEach((it) => {
        if (it.inventoryItemId) itemIds.add(it.inventoryItemId);
      });
    });

    return {
      totalPurchases,
      totalSpend,
      confirmedCount,
      uniqueItemCount: itemIds.size,
    };
  }, [supplier?.purchases]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />
        <div className="h-32 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Supplier Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">
          Data supplier yang Anda cari tidak tersedia atau telah dihapus dari sistem.
        </p>
        <Link
          href="/dashboard/inventory/suppliers"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs"
        >
          &larr; Kembali ke Data Supplier
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── BREADCRUMB & HEADER ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/dashboard/inventory/suppliers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Kembali ke Daftar Supplier
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Inventaris</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            {supplier.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profil vendor dan riwayat seluruh transaksi pembelian (PO) serta daftar barang yang pernah dibeli.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/inventory/purchases/create?supplierId=${supplier.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Buat Pembelian (PO)
          </Link>
        </div>
      </div>

      {/* ─── KARTU PROFIL SUPPLIER & STATISTIK ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Kolom Kiri: Profil Singkat */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Informasi Supplier
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              Vendor Terdaftar
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Nama Perusahaan / Toko</span>
              <span className="text-sm font-bold text-slate-900">{supplier.name}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Kontak / No. Telepon</span>
              <span className="font-mono text-slate-800 font-semibold">
                {supplier.phone || <span className="text-slate-400 font-sans italic">Tidak ada nomor telepon</span>}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Alamat Kantor / Gudang</span>
              <span className="text-slate-700 leading-relaxed block">
                {supplier.address || <span className="text-slate-400 italic">Tidak ada catatan alamat</span>}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Terdaftar Sejak:</span>
              <span>{formatDate(supplier.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: 4 Kotak KPI Belanja */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Transaksi Pembelian</span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
              {stats.totalPurchases} <span className="text-xs font-sans font-medium text-slate-500">PO</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {stats.confirmedCount} transaksi telah dikonfirmasi (Confirmed)
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Belanja Kumulatif</span>
            <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">
              {formatRupiah(stats.totalSpend)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Nilai belanja PO yang sudah terposting ke inventaris
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Jenis Barang Pernah Dibeli</span>
            <p className="text-2xl font-bold font-mono text-blue-700 mt-2">
              {stats.uniqueItemCount} <span className="text-xs font-sans font-medium text-slate-500">Item Unik</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Bahan baku dan kemasan yang disuplai
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Pembelian Terakhir</span>
            <p className="text-base font-bold font-mono text-slate-900 mt-2">
              {supplier.purchases?.[0]
                ? formatDate(supplier.purchases[0].purchasedAt)
                : '-'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {supplier.purchases?.[0]
                ? `#${supplier.purchases[0].purchaseNumber} (${formatRupiah(supplier.purchases[0].totalAmount)})`
                : 'Belum ada transaksi'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER BAR ───────────────────────────────────────────── */}
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
            placeholder="Cari nomor PO atau nama barang..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filter Status & Accordion Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'CONFIRMED', label: 'Confirmed (Posting)' },
              { id: 'DRAFT', label: 'Draft' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Buka semua rincian barang"
            >
              Buka Semua
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Tutup semua rincian barang"
            >
              Tutup Semua
            </button>
          </div>
        </div>
      </div>

      {/* ─── TABEL RIWAYAT PEMBELIAN (COLLAPSIBLE ACCORDION) ────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Riwayat Pembelian Barang (Maks. 50 Transaksi)
            </h3>
            <p className="text-[11px] text-slate-500">
              Klik pada baris transaksi untuk melihat/menutup daftar barang yang dibeli.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {filteredPurchases.length} Transaksi PO
          </span>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              {supplier.purchases?.length === 0
                ? 'Belum Ada Transaksi Pembelian'
                : 'Tidak Ada Transaksi Sesuai Filter'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {supplier.purchases?.length === 0
                ? 'Buat pembelian barang pertama dari supplier ini untuk mencatat stok bahan baku dan histori PO.'
                : 'Coba ubah kata kunci pencarian atau ganti filter status di atas.'}
            </p>
            {supplier.purchases?.length === 0 && (
              <Link
                href={`/dashboard/inventory/purchases/create?supplierId=${supplier.id}`}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                + Buat Pembelian Pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-8 text-center"></th>
                  <th className="py-3 px-4">Tanggal PO</th>
                  <th className="py-3 px-4">Nomor Faktur / PO</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Jumlah Item</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4 text-right">Total Belanja</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((purchase) => {
                  const isExpanded = Boolean(expandedPOs[purchase.id]);
                  const itemCount = purchase.items?.length || 0;

                  return (
                    <Fragment key={purchase.id}>
                      {/* Baris Utama PO (Klik untuk toggle accordion) */}
                      <tr
                        onClick={() => togglePO(purchase.id)}
                        className={cn(
                          'transition-colors cursor-pointer group',
                          isExpanded ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'
                        )}
                      >
                        {/* Toggle Icon */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 group-hover:bg-slate-200/50 transition-all"
                            aria-label={isExpanded ? 'Tutup rincian' : 'Buka rincian'}
                          >
                            <svg
                              className={cn(
                                'w-4 h-4 transition-transform duration-200',
                                isExpanded && 'rotate-90 text-emerald-600'
                              )}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        </td>

                        {/* Tanggal PO */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                          <div>{formatDate(purchase.purchasedAt)}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(purchase.purchasedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Nomor PO */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {purchase.purchaseNumber}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              purchase.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            )}
                          >
                            {purchase.status === 'CONFIRMED' ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                CONFIRMED
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                DRAFT
                              </>
                            )}
                          </span>
                        </td>

                        {/* Jumlah Item */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-mono font-bold">{itemCount}</span> Barang
                            <span className="text-[10px] text-slate-400">({isExpanded ? 'Sembunyikan' : 'Klik rincian'})</span>
                          </span>
                        </td>

                        {/* Petugas */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {purchase.createdBy?.name || 'Admin'}
                        </td>

                        {/* Total Belanja */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-slate-900 text-sm">
                          {formatRupiah(purchase.totalAmount)}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/dashboard/inventory/purchases/${purchase.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            Detail PO &rarr;
                          </Link>
                        </td>
                      </tr>

                      {/* Baris Rincian Accordion (Daftar Barang yang dibeli) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="p-3 sm:px-6 sm:py-4">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                              <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                <span>Rincian Barang Pada Faktur #{purchase.purchaseNumber}</span>
                                <span className="font-mono text-slate-500">{itemCount} Macam Barang</span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      <th className="py-2.5 px-4 w-10">No</th>
                                      <th className="py-2.5 px-4">Nama Barang (Bahan Baku)</th>
                                      <th className="py-2.5 px-4">Kategori</th>
                                      <th className="py-2.5 px-4 text-center">Jumlah (Qty)</th>
                                      <th className="py-2.5 px-4">Satuan Beli</th>
                                      <th className="py-2.5 px-4 text-right">Harga Satuan</th>
                                      <th className="py-2.5 px-4 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {purchase.items?.map((item, idx) => (
                                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                                          {idx + 1}
                                        </td>
                                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                                          {item.inventoryItem?.name || 'Item Bahan Baku'}
                                        </td>
                                        <td className="py-2.5 px-4 text-slate-500">
                                          {item.inventoryItem?.category?.name || '-'}
                                        </td>
                                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">
                                          {item.quantity}
                                        </td>
                                        <td className="py-2.5 px-4 font-mono text-slate-600 text-[11px]">
                                          {item.purchaseUnit?.name || item.purchaseUnit?.code || item.inventoryItem?.baseUnit?.code || 'Unit'}
                                        </td>
                                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                                          {formatRupiah(item.unitPrice)}
                                        </td>
                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                          {formatRupiah(item.subtotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-50/80 border-t border-slate-200 font-bold text-xs">
                                      <td colSpan={6} className="py-2.5 px-4 text-right text-slate-700">
                                        Total Faktur #{purchase.purchaseNumber}:
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono text-emerald-700 text-sm">
                                        {formatRupiah(purchase.totalAmount)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
