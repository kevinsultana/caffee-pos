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
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/SearchableSelect';

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
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus aturan konversi...');
        const res = await deleteUnitConversion(conv.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Aturan konversi berhasil dihapus.', { id: toastId });
          loadData();
        }
      });
    }
  };

  if (loading || !item) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat detail bahan baku...
      </div>
    );
  }

  const selectedUnitObj = units.find((u) => u.id === selectedUnitId);

  return (
    <div className="space-y-6 max-w-7xl">
      <Toaster position="top-right" />

      {/* Breadcrumb & Title */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/dashboard/inventory/items" className="hover:text-emerald-700 font-semibold transition-colors">
            &larr; Daftar Bahan Baku
          </Link>
          <span>/</span>
          <span className="text-slate-700">{item.categoryName}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </span>
          {item.name}
        </h1>
      </div>

      {/* KPI Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Satuan Dasar (Base Unit)</p>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {item.baseUnitName} ({item.baseUnitCode})
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Stok Saat Ini</p>
          <p
            className={cn(
              'text-xl font-bold font-mono mt-1',
              item.currentQuantity < 0 ? 'text-rose-600' : 'text-slate-900'
            )}
          >
            {item.currentQuantity.toLocaleString('id-ID')} {item.baseUnitCode}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Biaya Rata-rata (WAC)</p>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatRupiah(item.averageCost)} / {item.baseUnitCode}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Nilai Valuasi Aset</p>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatRupiah(item.stockValue)}
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: UNIT CONVERSION MANAGEMENT ──────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Aturan Konversi Satuan Pembelian (Supplier)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Definisikan satuan grosir/beli (seperti Dus, Karton, Pack, Karung) agar otomatis dikonversi ke satuan dasar saat transaksi penerimaan barang.
          </p>
        </div>

        {/* Add Conversion Form */}
        <form
          onSubmit={handleAddConversion}
          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Satuan Beli (Purchase Unit)
            </label>
            <SearchableSelect
              options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))}
              value={selectedUnitId}
              onChange={(val) => setSelectedUnitId(val)}
              disabled={isPending || units.length === 0}
              placeholder="Pilih Satuan Beli..."
            />
          </div>

          <div className="w-full sm:w-56">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Faktor Konversi (Isi per Satuan Beli)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.000001"
                placeholder="contoh: 24 (1 Dus = 24 pcs)"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(e.target.value)}
                disabled={isPending}
                className="w-full pl-3 pr-12 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono">
                {item.baseUnitCode}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || units.length === 0}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : '+ Tambah Aturan'}
          </button>
        </form>

        {/* Conversion Formula Preview */}
        {selectedUnitObj && conversionFactor && parseFloat(conversionFactor) > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-800">
            💡 Formula:{' '}
            <strong>
              1 {selectedUnitObj.name} ({selectedUnitObj.code}) = {conversionFactor}{' '}
              {item.baseUnitName} ({item.baseUnitCode})
            </strong>
          </div>
        )}

        {/* Conversions Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Satuan Pembelian</th>
                <th className="py-3 px-4 font-semibold">Faktor Konversi</th>
                <th className="py-3 px-4 font-semibold">Rumus Konversi Sistem</th>
                <th className="py-3 px-4 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {item.conversions?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    Belum ada aturan konversi satuan beli. Pembelian akan menggunakan satuan dasar ({item.baseUnitCode}).
                  </td>
                </tr>
              ) : (
                item.conversions.map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {conv.purchaseUnitName} ({conv.purchaseUnitCode})
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {conv.conversionFactor} {item.baseUnitCode}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700">
                      1 {conv.purchaseUnitCode} = {conv.conversionFactor} {item.baseUnitCode}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteConversion(conv)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECTION 2: RECENT STOCK MOVEMENTS ───────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Kartu Stok Mutasi Terakhir
            </h2>
            <p className="text-xs text-slate-500">
              Riwayat 10 transaksi mutasi masuk, keluar, penjualan, dan penyesuaian opname terakhir.
            </p>
          </div>
          <Link
            href="/dashboard/inventory/movements"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Lihat Semua Mutasi &rarr;
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu Mutasi</th>
                <th className="py-3 px-4 font-semibold">Tipe Pergerakan</th>
                <th className="py-3 px-4 font-semibold">Referensi & Alasan</th>
                <th className="py-3 px-4 text-right font-semibold">Perubahan Qty</th>
                <th className="py-3 px-4 text-right font-semibold">Biaya Satuan (WAC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(() => {
                const movementsList = item.movements || item.stockMovements || [];
                if (movementsList.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-sans">
                        Belum ada riwayat mutasi stok untuk bahan baku ini.
                      </td>
                    </tr>
                  );
                }

                return movementsList.map((m) => {
                  const isPositive = Number(m.quantityDelta) > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            m.type === 'PURCHASE' && 'bg-blue-50 text-blue-800 border-blue-200',
                            m.type === 'SALE' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            m.type === 'ADJUSTMENT' && 'bg-purple-50 text-purple-800 border-purple-200',
                            m.type === 'WASTE' && 'bg-rose-50 text-rose-800 border-rose-200',
                            m.type === 'OPENING_STOCK' && 'bg-amber-50 text-amber-800 border-amber-200'
                          )}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="font-semibold text-slate-800">{m.referenceType || '-'}</span>
                        {m.reason && (
                          <span className="text-slate-400 block text-[10px]">
                            Alasan: {m.reason}
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-bold text-xs',
                          isPositive ? 'text-emerald-700' : 'text-rose-600'
                        )}
                      >
                        {isPositive ? `+${m.quantityDelta}` : m.quantityDelta} {item.baseUnitCode}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-900 font-semibold">
                        {formatRupiah(m.unitCost)}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
