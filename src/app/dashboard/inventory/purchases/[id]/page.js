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
        <div class="text-left text-sm text-stone-300 space-y-2">
          <p>Anda akan memposting data pembelian <b>#${purchase.purchaseNumber}</b> ke sistem persediaan.</p>
          <div class="p-3 bg-stone-800 rounded-lg text-xs text-amber-300">
            ⚡ <b>Proses Transaksi Atomic:</b>
            <ul class="list-disc pl-4 mt-1 space-y-0.5">
              <li>Status PO berubah menjadi <b>CONFIRMED</b> (Permanen).</li>
              <li>Stok fisik bertambah otomatis ke saldo inventaris.</li>
              <li>Nilai HPP (Weighted Average Cost) dihitung ulang.</li>
              <li>Kartu stok historis (StockMovement) otomatis tercatat.</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Posting Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
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
        router.push('/dashboard/inventory/purchases');
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        Memuat detail pembelian...
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-8 text-center text-stone-400 space-y-3">
        <p>Data pembelian tidak ditemukan.</p>
        <Link
          href="/dashboard/inventory/purchases"
          className="inline-block px-4 py-2 bg-stone-800 text-stone-200 rounded-xl text-sm"
        >
          Kembali ke Daftar Pembelian
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-amber-50">
              #{purchase.purchaseNumber}
            </h1>
            {purchase.status === 'CONFIRMED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                CONFIRMED (Stok Terposting)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                DRAFT (Belum Diposting)
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Dibuat pada: {formatDateTime(purchase.createdAt)} oleh{' '}
            <span className="text-amber-300 font-medium">{purchase.createdBy?.name}</span>
          </p>
        </div>
        <Link
          href="/dashboard/inventory/purchases"
          className="px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors w-fit"
        >
          &larr; Daftar Pembelian
        </Link>
      </div>

      {/* Confirmation Alert Banner */}
      {purchase.status === 'DRAFT' ? (
        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-300">
              Faktur ini masih berstatus DRAFT
            </h3>
            <p className="text-xs text-stone-300">
              Stok fisik belum bertambah dan nilai HPP rata-rata belum dihitung. Klik tombol konfirmasi untuk memposting transaksi ke inventaris.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteDraft}
              disabled={isPending}
              className="px-3.5 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-colors disabled:opacity-50"
            >
              Hapus Draft
            </button>
            <button
              id="btn-confirm-purchase"
              onClick={handleConfirm}
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl shadow-md shadow-amber-950 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Posting Stok & Hitung WAC
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 flex items-center gap-3 text-xs text-emerald-300">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Transaksi ini telah dikonfirmasi dan terkunci (immutable). Stok fisik dan riwayat mutasi telah dicatat ke kartu stok.
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Supplier Info */}
        <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/40 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            Supplier / Vendor
          </p>
          <p className="text-lg font-bold text-amber-50">{purchase.supplier?.name}</p>
          <div className="text-xs text-stone-400 space-y-0.5">
            <p>Telepon: {purchase.supplier?.phone || '-'}</p>
            <p>Alamat: {purchase.supplier?.address || '-'}</p>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/40 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            Ringkasan Transaksi
          </p>
          <div className="text-xs text-stone-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-400">Tanggal Faktur:</span>
              <span className="font-medium">{formatDate(purchase.purchasedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Jumlah Macam Bahan:</span>
              <span className="font-medium">{purchase.items?.length || 0} item</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-stone-800">
              <span className="text-stone-400">Total Tagihan:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {formatRupiah(purchase.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden space-y-2">
        <div className="px-5 py-3 border-b border-stone-800 bg-stone-800/30">
          <h2 className="text-sm font-semibold text-stone-200">Rincian Barang yang Dipesan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Qty & Satuan Beli</th>
                <th className="py-3 px-4">Harga Beli / Satuan</th>
                <th className="py-3 px-4">Konversi Base Unit (Masuk Stok)</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {purchase.items?.map((item) => {
                const baseUnitCode = item.inventoryItem?.baseUnit?.code || '';

                return (
                  <tr key={item.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-amber-50">
                      {item.inventoryItem?.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {item.quantity} {item.purchaseUnit?.code}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-stone-300">
                      {formatRupiah(item.unitPrice)} / {item.purchaseUnit?.code}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-300">
                      <span className="font-mono font-semibold text-amber-300">
                        {item.baseQuantity} {baseUnitCode}
                      </span>{' '}
                      <span className="text-stone-500">
                        (@ {formatRupiah(item.baseUnitCost)}/{baseUnitCode})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-300 text-right">
                      {formatRupiah(item.subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-stone-800/60 border-t border-stone-800 font-semibold">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right text-stone-300 text-xs uppercase">
                  Grand Total Pembelian:
                </td>
                <td className="py-3 px-4 text-right font-mono text-base font-bold text-amber-400">
                  {formatRupiah(purchase.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
