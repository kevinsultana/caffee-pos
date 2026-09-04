'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPurchaseById, confirmPurchase, deletePurchase } from '@/app/actions/purchasing';
import { formatRupiah, formatDate, formatDateTime } from '@/lib/utils';

export default function PurchaseDetailPage({ params }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    setLoading(true);
    const res = await getPurchaseById(resolvedParams.id);
    if (res.error) {
      toast.error(res.error);
    } else {
      setPurchase(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  async function handleConfirm() {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Posting Stok & Hitung WAC?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2 font-sans">
          <p>Anda akan memposting data pembelian <b>#${purchase.purchaseNumber}</b> ke sistem persediaan.</p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800">
            ⚡ <b>Proses Transaksi Atomic:</b>
            <ul class="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
              <li>Status PO berubah menjadi <b>CONFIRMED</b> (Permanen & Immutable).</li>
              <li>Stok fisik bertambah otomatis ke saldo inventaris.</li>
              <li>Nilai HPP (Weighted Average Cost / WAC) dihitung ulang.</li>
              <li>Kartu stok historis (StockMovement) otomatis tercatat.</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Posting Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Memproses transaksi & memperbarui saldo stok...');
      const res = await confirmPurchase(purchase.id);

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success('Pembelian berhasil dikonfirmasi dan stok terposting!', { id: toastId });
        loadData();
      }
    });
  }

  async function handleDeleteDraft() {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Hapus Draft PO?',
      text: `Hapus permanen draft pembelian #${purchase.purchaseNumber}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
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
        toast.success('Draft berhasil dihapus.', { id: toastId });
        router.push('/dashboard/inventory/purchases');
      }
    });
  }

  if (loading || !purchase) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat detail transaksi pembelian...
      </div>
    );
  }

  const isDraft = purchase.status === 'DRAFT';

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/inventory/purchases" className="hover:text-emerald-700 font-semibold transition-colors">
              &larr; Riwayat Pembelian
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            #{purchase.purchaseNumber}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Transaksi pembelian kepada supplier <strong className="text-slate-800">{purchase.supplier?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDraft ? (
            <>
              <button
                onClick={handleDeleteDraft}
                disabled={isPending}
                className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Hapus Draft
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isPending ? 'Memproses...' : 'Konfirmasi & Posting Stok'}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              CONFIRMED (Stok & WAC Diposting)
            </span>
          )}
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Transaksi</p>
          <p className="text-base font-bold text-slate-900 mt-1">
            {isDraft ? 'DRAFT (Belum Posting)' : 'CONFIRMED'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal Beli</p>
          <p className="text-base font-bold text-slate-900 mt-1 font-mono">
            {formatDate(purchase.purchasedAt)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</p>
          <p className="text-base font-bold text-slate-900 mt-1 truncate">
            {purchase.supplier?.name}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tagihan</p>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatRupiah(purchase.totalAmount)}
          </p>
        </div>
      </div>

      {/* ─── ITEMS TABLE ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Rincian Barang Pembelian</h2>
          <span className="text-xs font-mono text-slate-500">{purchase.items?.length || 0} Bahan Baku</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Bahan Baku</th>
                <th className="py-3.5 px-4 text-right">Kuantitas Beli</th>
                <th className="py-3.5 px-4 text-right">Harga per Satuan</th>
                <th className="py-3.5 px-4 text-right">Konversi Satuan Dasar</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {purchase.items?.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                    {it.inventoryItem?.name}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {it.quantity} {it.purchaseUnit?.code}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700">
                    {formatRupiah(it.unitPrice)} / {it.purchaseUnit?.code}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-500">
                    {it.baseQuantity} {it.inventoryItem?.baseUnit?.code} ({formatRupiah(it.baseUnitCost)}/{it.inventoryItem?.baseUnit?.code})
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatRupiah(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan="4" className="py-4 px-4 font-bold text-slate-900 text-right uppercase text-xs">
                  Grand Total Pembelian:
                </td>
                <td className="py-4 px-4 text-right font-mono font-extrabold text-emerald-700 text-base">
                  {formatRupiah(purchase.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>Dibuat oleh: <strong className="text-slate-700">{purchase.createdBy?.name || 'Kasir'}</strong></span>
        <span>Waktu Dibuat: {formatDateTime(purchase.createdAt)}</span>
      </div>
    </div>
  );
}
