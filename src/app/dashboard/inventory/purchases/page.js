'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPurchases, confirmPurchase, deletePurchase } from '@/app/actions/purchasing';
import { formatRupiah, formatDate } from '@/lib/utils';

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
        <div class="text-left text-sm text-stone-300 space-y-2">
          <p>Anda akan mengonfirmasi PO <b>#${purchase.purchaseNumber}</b>.</p>
          <div class="p-3 bg-stone-800 rounded-lg text-xs text-amber-300">
            ⚠️ <b>Efek Tindakan (Permanen & Atomic):</b>
            <ul class="list-disc pl-4 mt-1 space-y-0.5">
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
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
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
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
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
    const matchSearch =
      p.purchaseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.createdBy?.name && p.createdBy.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Pembelian Bahan (Purchasing)</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Pencatatan faktur pembelian dari supplier dan pembaruan otomatis stok & HPP (Weighted Average Cost).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/movements"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            Kartu Stok
          </Link>
          <Link
            href="/dashboard/inventory/suppliers"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Supplier
          </Link>
          <Link
            id="btn-create-purchase"
            href="/dashboard/inventory/purchases/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Catat Pembelian Baru
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nomor PO, nama supplier, atau petugas pembuat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="ALL">Semua Status</option>
          <option value="DRAFT">DRAFT (Belum Posting)</option>
          <option value="CONFIRMED">CONFIRMED (Stok Terposting)</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">No. Pembelian (PO)</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Tgl Pembelian</th>
                <th className="py-3 px-4">Item & Qty</th>
                <th className="py-3 px-4">Total Biaya</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Memuat daftar transaksi pembelian...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    {searchQuery || selectedStatus !== 'ALL'
                      ? 'Tidak ada transaksi yang cocok dengan filter.'
                      : 'Belum ada data pembelian. Klik "Catat Pembelian Baru" untuk memulai.'}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/inventory/purchases/${p.id}`}
                          className="font-mono font-bold text-amber-400 hover:text-amber-300 hover:underline"
                        >
                          #{p.purchaseNumber}
                        </Link>
                        <p className="text-[11px] text-stone-500">
                          Oleh: {p.createdBy?.name || 'Staff'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-amber-50">{p.supplier?.name}</span>
                        {p.supplier?.phone && (
                          <p className="text-[11px] text-stone-500">{p.supplier.phone}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-300">
                        {formatDate(p.purchasedAt)}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-300">
                        {p.items?.length || 0} macam bahan
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {formatRupiah(p.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        {p.status === 'CONFIRMED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            CONFIRMED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            DRAFT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/dashboard/inventory/purchases/${p.id}`}
                          className="px-2.5 py-1 text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors inline-block"
                        >
                          Lihat Detail
                        </Link>

                        {p.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleConfirm(p)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Posting Stok
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(p)}
                              disabled={isPending}
                              className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50"
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
