'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPurchases, confirmPurchase, deletePurchase } from '@/app/actions/purchasing';
import { formatRupiah, formatDate, cn } from '@/lib/utils';

export default function PurchasesListPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
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

  const filteredPurchases = purchases.filter((p) => {
    const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchQuery =
      !searchQuery.trim() ||
      p.purchaseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchQuery;
  });

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
        <Link
          id="btn-create-po"
          href="/dashboard/inventory/purchases/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          + Buat Pembelian Baru
        </Link>
      </div>

      {/* ─── FILTERS & SEARCH ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
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
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Semua Status</option>
          <option value="DRAFT">DRAFT (Belum Konfirmasi)</option>
          <option value="CONFIRMED">CONFIRMED (Stok & WAC Diposting)</option>
        </select>
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
                    {searchQuery || selectedStatus !== 'ALL'
                      ? 'Tidak ada pembelian yang cocok dengan filter.'
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
