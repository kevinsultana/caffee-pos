'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getOpnameItems, recordStockOpname } from '@/app/actions/opname';
import { formatRupiah, cn } from '@/lib/utils';

export default function StockOpnamePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modal Adjustment State
  const [selectedItem, setSelectedItem] = useState(null);
  const [physicalQty, setPhysicalQty] = useState('');
  const [reason, setReason] = useState('Stock Opname Rutin');

  async function loadData() {
    setLoading(true);
    const res = await getOpnameItems();
    if (res.error) toast.error(res.error);
    else setItems(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAdjustModal(item) {
    setSelectedItem(item);
    setPhysicalQty(String(item.systemQuantity));
    setReason('Stock Opname Rutin');
  }

  async function handleSaveAdjustment(e) {
    e.preventDefault();
    if (!selectedItem) return;

    const numPhysical = Number(physicalQty);
    if (isNaN(numPhysical)) {
      toast.error('Masukkan kuantitas fisik yang valid.');
      return;
    }

    const diff = numPhysical - selectedItem.systemQuantity;
    const Swal = (await import('sweetalert2')).default;

    const diffBadge =
      diff === 0
        ? '<span class="text-stone-300 font-bold">Pas (Tidak ada selisih)</span>'
        : diff > 0
        ? `<span class="text-emerald-400 font-bold">Surplus (+${diff} ${selectedItem.baseUnitCode})</span>`
        : `<span class="text-red-400 font-bold">Defisit (${diff} ${selectedItem.baseUnitCode})</span>`;

    const confirm = await Swal.fire({
      title: 'Konfirmasi Stock Opname?',
      html: `
        <div class="text-left text-sm text-stone-300 space-y-2">
          <p>Anda akan melakukan penyesuaian stok untuk: <b>${selectedItem.name}</b></p>
          <div class="p-3 bg-stone-800 rounded-xl space-y-1 text-xs font-mono">
            <div class="flex justify-between text-stone-400">
              <span>Stok Sistem:</span>
              <span>${selectedItem.systemQuantity} ${selectedItem.baseUnitCode}</span>
            </div>
            <div class="flex justify-between text-stone-400">
              <span>Stok Fisik Aktual:</span>
              <span class="text-amber-300 font-bold">${numPhysical} ${selectedItem.baseUnitCode}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-stone-700">
              <span>Perubahan Stok:</span>
              <span>${diffBadge}</span>
            </div>
          </div>
          <p class="text-xs text-stone-400 italic">
            Perubahan akan dicatat ke kartu stok dengan tipe mutasi <b>ADJUSTMENT</b>.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Sesuaikan Stok',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menyesuaikan saldo inventaris...');
      const res = await recordStockOpname({
        inventoryItemId: selectedItem.id,
        physicalQuantity: numPhysical,
        reason: reason.trim() || 'Stock Opname Fisik',
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          `Stok "${selectedItem.name}" berhasil disesuaikan!`,
          { id: toastId }
        );
        setSelectedItem(null);
        loadData();
      }
    });
  }

  const filteredItems = items.filter((it) => {
    return (
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.sku && it.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      it.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Stock Opname & Penyesuaian Fisik</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Cocokkan saldo sistem persediaan dengan hasil penghitungan fisik nyata di gudang / bar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/movements"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            Kartu Mutasi Stok
          </Link>
          <Link
            href="/dashboard/inventory/items"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors flex items-center gap-1.5"
          >
            Daftar Bahan Baku
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Cari bahan baku berdasarkan nama, SKU, atau kategori..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3.5 px-4">Nama Bahan Baku</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Satuan Dasar</th>
                <th className="py-3.5 px-4">Stok Tercatat di Sistem</th>
                <th className="py-3.5 px-4">HPP / Unit (WAC)</th>
                <th className="py-3.5 px-4 text-right">Aksi Opname</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    Memuat daftar bahan inventaris...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    Tidak ada bahan baku ditemukan.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => {
                  const isNegative = it.systemQuantity < 0;
                  const isLow = it.minimumStock !== null && it.systemQuantity <= it.minimumStock;

                  return (
                    <tr key={it.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50">{it.name}</div>
                        {it.sku && (
                          <span className="text-[11px] font-mono text-stone-500">
                            SKU: {it.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-400">
                        {it.categoryName}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-amber-400/90 font-bold">
                        {it.baseUnitCode}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs',
                            isNegative
                              ? 'bg-red-950/60 text-red-400 border border-red-800/50'
                              : isLow
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                              : 'text-stone-200'
                          )}
                        >
                          {it.systemQuantity} {it.baseUnitCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-stone-300">
                        {formatRupiah(it.averageCost)}/{it.baseUnitCode}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(it)}
                          className="px-3.5 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 rounded-xl text-xs font-bold transition-all"
                        >
                          Hitung Fisik
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

      {/* ─── MODAL FORM OPNAME ──────────────────────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Form Penyesuaian Stok Fisik
              </span>
              <h3 className="text-lg font-bold text-amber-50 mt-0.5">
                {selectedItem.name}
              </h3>
              <p className="text-xs text-stone-400">
                Stok Sistem Saat Ini:{' '}
                <span className="font-mono font-bold text-stone-200">
                  {selectedItem.systemQuantity} {selectedItem.baseUnitCode}
                </span>
              </p>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest mb-1.5">
                  Kuantitas Fisik Riil ({selectedItem.baseUnitCode})
                </label>
                <input
                  type="number"
                  step="any"
                  value={physicalQty}
                  onChange={(e) => setPhysicalQty(e.target.value)}
                  disabled={isPending}
                  className="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Difference Preview */}
              <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-stone-400 font-medium">Estimasi Selisih:</span>
                <span
                  className={cn(
                    'font-mono font-bold text-sm',
                    Number(physicalQty) - selectedItem.systemQuantity === 0
                      ? 'text-stone-400'
                      : Number(physicalQty) - selectedItem.systemQuantity > 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  )}
                >
                  {Number(physicalQty) - selectedItem.systemQuantity > 0 ? '+' : ''}
                  {Number(physicalQty) - selectedItem.systemQuantity} {selectedItem.baseUnitCode}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Alasan / Keterangan Penyesuaian
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="contoh: Stock Opname Akhir Bulan, Tumpah/Bocor"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  disabled={isPending}
                  className="w-1/3 py-2.5 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
