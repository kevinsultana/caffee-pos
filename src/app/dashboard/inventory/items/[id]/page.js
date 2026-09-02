'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import {
  getInventoryItemDetail,
  createUnitConversion,
  deleteUnitConversion,
  getUnits,
} from '@/app/actions/inventory';
import { formatRupiah } from '@/lib/utils';

export default function InventoryItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params?.id;

  const [item, setItem] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form Conversion State
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [conversionFactor, setConversionFactor] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [itemRes, unitRes] = await Promise.all([
      getInventoryItemDetail(itemId),
      getUnits(),
    ]);

    if (itemRes?.error) {
      toast.error(itemRes.error);
      router.push('/dashboard/inventory/items');
      return;
    }

    setItem(itemRes.data);
    const availableUnits = (unitRes.data || []).filter(
      (u) => u.id !== itemRes.data.baseUnitId
    );
    setUnits(availableUnits);
    if (availableUnits.length > 0) {
      setSelectedUnitId(availableUnits[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (itemId) {
      loadData();
    }
  }, [itemId]);

  const handleAddConversion = (e) => {
    e.preventDefault();

    if (!selectedUnitId) {
      toast.error('Pilih satuan beli terlebih dahulu.');
      return;
    }

    const factor = parseFloat(conversionFactor);
    if (isNaN(factor) || factor <= 0) {
      toast.error('Faktor konversi harus berupa angka positif lebih dari 0.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan aturan konversi...');
      const res = await createUnitConversion({
        inventoryItemId: item.id,
        purchaseUnitId: selectedUnitId,
        conversionFactor: factor,
      });

      if (res?.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success('Aturan konversi satuan berhasil ditambahkan!', { id: toastId });
      setConversionFactor('');
      loadData();
    });
  };

  const handleDeleteConversion = async (conv) => {
    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: 'Hapus Konversi Satuan?',
      text: `Apakah Anda yakin ingin menghapus aturan konversi 1 ${conv.purchaseUnitCode} = ${conv.conversionFactor} ${item.baseUnitCode}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus...');
        const res = await deleteUnitConversion(conv.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Konversi satuan berhasil dihapus.', { id: toastId });
          loadData();
        }
      });
    }
  };

  if (loading || !item) {
    return (
      <div className="p-8 text-center text-stone-500 text-xs">
        Memuat detail bahan baku inventaris...
      </div>
    );
  }

  const selectedUnitObj = units.find((u) => u.id === selectedUnitId);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/dashboard/inventory/items" className="hover:text-amber-400 transition-colors">
              &larr; Daftar Bahan Baku
            </Link>
            <span>/</span>
            <span className="text-amber-200">{item.categoryName}</span>
          </div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </span>
            {item.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
            Base Unit: {item.baseUnitCode} ({item.baseUnitName})
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Sisa Stok Fisik</p>
          <p className="text-xl font-bold font-mono text-amber-100 mt-1">
            {item.currentQuantity} <span className="text-xs text-stone-400 font-sans">{item.baseUnitCode}</span>
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Harga Pokok Rata-rata (WAC)</p>
          <p className="text-xl font-bold font-mono text-amber-300 mt-1">
            {formatRupiah(item.averageCost)} <span className="text-[10px] text-stone-500 font-sans">/ {item.baseUnitCode}</span>
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Total Nilai Stok (Aset)</p>
          <p className="text-xl font-bold font-mono text-emerald-300 mt-1">
            {formatRupiah(item.stockValue)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Batas Stok Minimum</p>
          <p className="text-xl font-bold font-mono text-rose-300 mt-1">
            {item.minimumStock} {item.baseUnitCode}
          </p>
        </div>
      </div>

      {/* ─── MODUL KONVERSI SATUAN PEMBELIAN ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List of Conversions (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-stone-900/70 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-amber-50">
                Daftar Konversi Satuan Beli (Purchase Units)
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Aturan konversi ini memungkinkan staf membeli dalam kemasan besar (seperti Dus, Karton, Kaleng) dan sistem otomatis mengonversinya ke Base Unit (<strong className="text-amber-200">{item.baseUnitCode}</strong>) untuk resep dan HPP.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Satuan Beli</th>
                    <th className="py-3 px-4 font-semibold">Formula Konversi</th>
                    <th className="py-3 px-4 font-semibold">Estimasi Harga Beli / Satuan Beli</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {item.conversions?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-500 font-sans text-xs">
                        Belum ada aturan konversi satuan. Pembelian saat ini hanya dalam Base Unit ({item.baseUnitCode}).
                      </td>
                    </tr>
                  ) : (
                    item.conversions.map((conv) => {
                      const estimatedUnitCost = conv.conversionFactor * item.averageCost;

                      return (
                        <tr key={conv.id} className="hover:bg-stone-800/30 transition-colors font-sans">
                          <td className="py-3 px-4">
                            <span className="font-bold text-amber-50 font-mono">{conv.purchaseUnitCode}</span>
                            <span className="text-[11px] text-stone-500 block">{conv.purchaseUnitName}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-300">
                            1 {conv.purchaseUnitCode} = {conv.conversionFactor} {item.baseUnitCode}
                          </td>
                          <td className="py-3 px-4 font-mono text-stone-300">
                            ~ {formatRupiah(estimatedUnitCost)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteConversion(conv)}
                              className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                            >
                              Hapus
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
        </div>

        {/* Form Tambah Konversi Baru (1 Col) */}
        <div className="space-y-4">
          <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-amber-50">
              + Tambah Konversi Satuan
            </h2>

            {units.length === 0 ? (
              <p className="text-xs text-stone-500">
                Semua unit satuan di sistem telah ditambahkan sebagai konversi atau merupakan Base Unit.
              </p>
            ) : (
              <form onSubmit={handleAddConversion} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Satuan Beli (Purchase Unit) *
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Faktor Pengali (Isi dalam {item.baseUnitCode}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      placeholder="Contoh: 40"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      disabled={isPending}
                      className="w-full pl-3 pr-14 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-stone-400 font-mono">
                      {item.baseUnitCode}
                    </span>
                  </div>
                </div>

                {selectedUnitObj && conversionFactor && parseFloat(conversionFactor) > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                    Formula: <strong>1 {selectedUnitObj.code}</strong> = <strong>{conversionFactor} {item.baseUnitCode}</strong>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan Konversi...' : 'Simpan Aturan Konversi'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ─── RIWAYAT MUTASI STOK TERBARU ──────────────────────────────────────── */}
      <div className="bg-stone-900/70 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-amber-50">
          Riwayat Pergerakan Stok Terbaru (20 Mutasi Terakhir)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu</th>
                <th className="py-3 px-4 font-semibold">Tipe Mutasi</th>
                <th className="py-3 px-4 font-semibold">Perubahan Qty</th>
                <th className="py-3 px-4 font-semibold">Sisa Stok</th>
                <th className="py-3 px-4 font-semibold">Biaya Satuan</th>
                <th className="py-3 px-4 font-semibold">Keterangan / Referensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {item.stockMovements?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500 font-sans text-xs">
                    Belum ada riwayat mutasi stok tercatat untuk bahan ini.
                  </td>
                </tr>
              ) : (
                item.stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-800/30 transition-colors font-sans">
                    <td className="py-3 px-4 font-mono text-[11px] text-stone-400">
                      {new Date(m.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {item.baseUnitCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-200">
                      {m.newQuantity} {item.baseUnitCode}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-400">
                      {formatRupiah(m.costPerUnit)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-stone-500">
                      {m.referenceNumber || m.reason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
