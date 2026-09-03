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
        ? '<span class="text-slate-700 font-bold">Pas (Tidak ada selisih)</span>'
        : diff > 0
        ? `<span class="text-emerald-700 font-bold">Surplus (+${diff} ${selectedItem.baseUnitCode})</span>`
        : `<span class="text-rose-600 font-bold">Defisit (${diff} ${selectedItem.baseUnitCode})</span>`;

    const confirm = await Swal.fire({
      title: 'Konfirmasi Stock Opname?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2 font-sans">
          <p>Anda akan melakukan penyesuaian stok untuk: <strong class="text-slate-900">${selectedItem.name}</strong></p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-xs">
            <div class="flex justify-between text-slate-500">
              <span>Stok Sistem:</span>
              <span>${selectedItem.systemQuantity} ${selectedItem.baseUnitCode}</span>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Stok Fisik Aktual:</span>
              <span class="text-slate-900 font-bold">${numPhysical} ${selectedItem.baseUnitCode}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-200">
              <span>Perubahan Stok:</span>
              <span>${diffBadge}</span>
            </div>
          </div>
          <p class="text-xs text-slate-400 italic">
            Perubahan akan dicatat ke kartu stok dengan tipe mutasi <b>ADJUSTMENT</b>.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Sesuaikan Stok',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
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
          `Penyesuaian stok "${res.data.itemName}" berhasil disimpan!`,
          { id: toastId }
        );
        setSelectedItem(null);
        loadData();
      }
    });
  }

  const filteredItems = items.filter((it) => {
    return (
      !searchQuery.trim() ||
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Stock Opname & Rekonsiliasi Fisik
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Penyesuaian kuantitas fisik riil di gudang dengan catatan saldo sistem untuk memperbarui kartu stok secara akurat.
          </p>
        </div>
        <Link
          href="/dashboard/inventory/movements"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors self-start sm:self-auto"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
          </svg>
          Buku Mutasi Stok
        </Link>
      </div>

      {/* ─── SEARCH ───────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama bahan baku untuk stock opname..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nama Bahan Baku</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4 text-right">Stok Sistem Saat Ini</th>
                <th className="py-3.5 px-4 text-right">Biaya Rata-rata (WAC)</th>
                <th className="py-3.5 px-4">Status Saldo</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Memuat daftar bahan untuk stock opname...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ada bahan baku yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => {
                  const qty = it.systemQuantity;
                  const isNegative = qty < 0;

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {it.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {it.categoryName}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-3.5 px-4 font-mono font-bold text-right text-xs',
                          isNegative ? 'text-rose-600' : 'text-slate-900'
                        )}
                      >
                        {qty.toLocaleString('id-ID')} {it.baseUnitCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-right">
                        {formatRupiah(it.averageCost)} / {it.baseUnitCode}
                      </td>
                      <td className="py-3.5 px-4">
                        {isNegative ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Defisit (Minus)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(it)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
                        >
                          Input Hitung Fisik &rarr;
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

      {/* ─── MODAL INPUT OPNAME FISIK ────────────────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Input Stock Opname Fisik
                </h3>
                <p className="text-xs text-slate-500">{selectedItem.name}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Saldo Tercatat di Sistem:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedItem.systemQuantity} {selectedItem.baseUnitCode}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Biaya Rata-rata (WAC):</span>
                  <span className="font-mono">{formatRupiah(selectedItem.averageCost)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Jumlah Fisik Riil Hasil Hitung *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={physicalQty}
                    onChange={(e) => setPhysicalQty(e.target.value)}
                    disabled={isPending}
                    className="w-full pl-3 pr-14 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                    {selectedItem.baseUnitCode}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alasan / Keterangan Penyesuaian
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Live Difference Preview */}
              {!isNaN(Number(physicalQty)) && (
                <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-mono bg-slate-50 border-slate-200">
                  <span className="text-slate-600 font-sans">Selisih Stok:</span>
                  <span
                    className={cn(
                      'font-bold',
                      Number(physicalQty) - selectedItem.systemQuantity > 0
                        ? 'text-emerald-700'
                        : Number(physicalQty) - selectedItem.systemQuantity < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    )}
                  >
                    {Number(physicalQty) - selectedItem.systemQuantity > 0 ? '+' : ''}
                    {Number(physicalQty) - selectedItem.systemQuantity} {selectedItem.baseUnitCode}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs"
                >
                  {isPending ? 'Memproses...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
