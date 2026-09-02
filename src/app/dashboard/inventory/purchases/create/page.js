'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createPurchase } from '@/app/actions/purchasing';
import { getSuppliers } from '@/app/actions/supplier';
import { getInventoryItems, getUnits } from '@/app/actions/inventory';
import { formatRupiah } from '@/lib/utils';

export default function CreatePurchasePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Dynamic rows of items
  const [items, setItems] = useState([
    {
      inventoryItemId: '',
      purchaseUnitId: '',
      conversionFactor: 1,
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    },
  ]);

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      const [supRes, invRes, unitRes] = await Promise.all([
        getSuppliers(),
        getInventoryItems(),
        getUnits(),
      ]);

      if (supRes.data?.length > 0) {
        setSuppliers(supRes.data);
        setSupplierId(supRes.data[0].id);
      }
      if (invRes.data) setInventoryItems(invRes.data);
      if (unitRes.data) setUnits(unitRes.data);

      setLoading(false);
    }
    loadMasterData();
  }, []);

  function handleItemChange(index, field, value) {
    const newItems = [...items];
    const row = { ...newItems[index], [field]: value };

    // When an inventory item is picked, auto-populate default purchaseUnit to baseUnit
    if (field === 'inventoryItemId') {
      const selectedItem = inventoryItems.find((inv) => inv.id === value);
      if (selectedItem) {
        row.purchaseUnitId = selectedItem.baseUnitId;
        row.conversionFactor = 1;
      }
    }

    // Auto-calculate conversion factor helper if kg -> g or L -> ml
    if (field === 'purchaseUnitId') {
      const selectedItem = inventoryItems.find(
        (inv) => inv.id === row.inventoryItemId
      );
      const selectedUnit = units.find((u) => u.id === value);

      if (selectedItem && selectedUnit) {
        const baseCode = selectedItem.baseUnit?.code?.toLowerCase();
        const purchaseCode = selectedUnit.code?.toLowerCase();

        if (purchaseCode === 'kg' && baseCode === 'g') {
          row.conversionFactor = 1000;
        } else if (purchaseCode === 'l' && baseCode === 'ml') {
          row.conversionFactor = 1000;
        } else if (purchaseCode === baseCode) {
          row.conversionFactor = 1;
        }
      }
    }

    const qty = Number(row.quantity) || 0;
    const price = Number(row.unitPrice) || 0;
    row.subtotal = Math.round(qty * price * 100) / 100;

    newItems[index] = row;
    setItems(newItems);
  }

  function addRow() {
    setItems([
      ...items,
      {
        inventoryItemId: '',
        purchaseUnitId: '',
        conversionFactor: 1,
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
  }

  function removeRow(index) {
    if (items.length === 1) {
      toast.error('Minimal harus ada 1 barang dalam transaksi pembelian.');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  }

  const grandTotal = items.reduce(
    (sum, row) => sum + (Number(row.subtotal) || 0),
    0
  );

  function handleSubmit(e) {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Silakan pilih supplier terlebih dahulu.');
      return;
    }

    // Validate rows
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.inventoryItemId) {
        toast.error(`Baris ke-${i + 1}: Silakan pilih barang inventaris.`);
        return;
      }
      if (!it.purchaseUnitId) {
        toast.error(`Baris ke-${i + 1}: Silakan tentukan satuan beli.`);
        return;
      }
      if (Number(it.quantity) <= 0) {
        toast.error(`Baris ke-${i + 1}: Kuantitas beli harus lebih dari 0.`);
        return;
      }
      if (Number(it.unitPrice) < 0) {
        toast.error(`Baris ke-${i + 1}: Harga beli tidak boleh bernilai negatif.`);
        return;
      }
    }

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan draft pembelian...');
      const res = await createPurchase({
        supplierId,
        purchasedAt,
        items,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success('Draft pembelian berhasil dibuat!', { id: toastId });
        router.push(`/dashboard/inventory/purchases/${res.data.id}`);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        Memuat form pembelian...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Catat Pembelian Baru</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Buat pesanan pembelian baru (Purchase Order) dalam status DRAFT.
          </p>
        </div>
        <Link
          href="/dashboard/inventory/purchases"
          className="px-4 py-2 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
        >
          Kembali
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top Details Card */}
        <div className="p-6 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-4">
          <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
            Informasi Faktur & Supplier
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Pilih Supplier / Vendor
              </label>
              {suppliers.length === 0 ? (
                <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-300">
                  Belum ada supplier terdaftar.{' '}
                  <Link href="/dashboard/inventory/suppliers" className="underline font-semibold">
                    Tambah Supplier Terlebih Dahulu
                  </Link>
                </div>
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Tanggal Pembelian
              </label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                disabled={isPending}
                className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                required
              />
            </div>
          </div>
        </div>

        {/* Dynamic Items Card */}
        <div className="p-6 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
              Daftar Barang yang Dibeli
            </h2>
            <button
              type="button"
              onClick={addRow}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-xl text-xs font-semibold border border-stone-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Tambah Baris
            </button>
          </div>

          <div className="space-y-3">
            {items.map((row, index) => {
              const selectedItem = inventoryItems.find((inv) => inv.id === row.inventoryItemId);
              const baseUnitCode = selectedItem?.baseUnit?.code || '';

              return (
                <div
                  key={index}
                  className="p-4 bg-stone-950/60 border border-stone-800 rounded-2xl space-y-3 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center"
                >
                  {/* Select Inventory Item */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                      Barang Bahan #{index + 1}
                    </label>
                    <select
                      value={row.inventoryItemId}
                      onChange={(e) =>
                        handleItemChange(index, 'inventoryItemId', e.target.value)
                      }
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      required
                    >
                      <option value="" disabled>
                        -- Pilih Bahan Baku --
                      </option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} (Base: {inv.baseUnit?.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity & Purchase Unit */}
                  <div className="sm:col-span-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                        Qty Beli
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={row.quantity}
                        onChange={(e) =>
                          handleItemChange(index, 'quantity', e.target.value)
                        }
                        disabled={isPending}
                        className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                        Satuan Beli
                      </label>
                      <select
                        value={row.purchaseUnitId}
                        onChange={(e) =>
                          handleItemChange(index, 'purchaseUnitId', e.target.value)
                        }
                        disabled={isPending}
                        className="w-full px-2.5 py-2 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        required
                      >
                        <option value="" disabled>
                          Pilih Satuan
                        </option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Price per unit */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                      Harga / Satuan (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={row.unitPrice}
                      onChange={(e) =>
                        handleItemChange(index, 'unitPrice', e.target.value)
                      }
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                      required
                    />
                  </div>

                  {/* Subtotal & Conversion Preview */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                      Subtotal
                    </label>
                    <div className="font-mono text-xs font-bold text-amber-300 py-1.5">
                      {formatRupiah(row.subtotal)}
                    </div>
                    {baseUnitCode && (
                      <p className="text-[10px] text-stone-500">
                        Masuk: {row.quantity * row.conversionFactor} {baseUnitCode}
                      </p>
                    )}
                  </div>

                  {/* Delete row button */}
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={isPending || items.length === 1}
                      className="p-2 text-stone-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors disabled:opacity-30"
                      title="Hapus baris"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total & Action Bar */}
        <div className="p-6 rounded-2xl border border-stone-800/80 bg-stone-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs text-stone-400">Total Nilai Pembelian:</p>
            <p className="text-2xl font-bold font-mono text-amber-400">
              {formatRupiah(grandTotal)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/inventory/purchases"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            >
              Batal
            </Link>
            <button
              id="btn-submit-purchase"
              type="submit"
              disabled={isPending || suppliers.length === 0 || inventoryItems.length === 0}
              className="px-6 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
            >
              {isPending ? 'Menyimpan Draft...' : 'Simpan sebagai Draft PO'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
