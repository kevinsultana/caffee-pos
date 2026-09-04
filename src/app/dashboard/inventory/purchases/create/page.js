'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createPurchase } from '@/app/actions/purchasing';
import { getSuppliers, createSupplier } from '@/app/actions/supplier';
import { getInventoryItems, getUnits } from '@/app/actions/inventory';
import { formatRupiah, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';

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

  // Modal Pendaftaran Supplier Baru
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  async function handleSaveNewSupplier(e) {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      toast.error('Nama supplier wajib diisi.');
      return;
    }

    setSavingSupplier(true);
    const toastId = toast.loading('Menyimpan supplier baru...');
    const res = await createSupplier({
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim(),
      address: newSupplierAddress.trim(),
    });

    setSavingSupplier(false);

    if (res?.error) {
      toast.error(res.error, { id: toastId });
      return;
    }

    toast.success(`Supplier "${res.data.name}" berhasil didaftarkan!`, { id: toastId });

    // Tambahkan ke daftar options supplier jika belum ada
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === res.data.id);
      if (exists) return prev;
      return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Otomatis pilih supplier baru ini
    setSupplierId(res.data.id);

    // Tutup modal dan reset input
    setSupplierModalOpen(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierAddress('');
  }

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

  function addItemRow() {
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

  function removeItemRow(index) {
    if (items.length <= 1) {
      toast.error('Minimal harus ada 1 barang dalam pesanan pembelian.');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  }

  const grandTotal = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Pilih supplier terlebih dahulu.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.inventoryItemId) {
        toast.error(`Baris ke-${i + 1}: Pilih bahan baku.`);
        return;
      }
      if (!it.purchaseUnitId) {
        toast.error(`Baris ke-${i + 1}: Pilih satuan beli.`);
        return;
      }
      if (isNaN(Number(it.quantity)) || Number(it.quantity) <= 0) {
        toast.error(`Baris ke-${i + 1}: Kuantitas harus lebih dari 0.`);
        return;
      }
      if (isNaN(Number(it.unitPrice)) || Number(it.unitPrice) < 0) {
        toast.error(`Baris ke-${i + 1}: Harga satuan tidak valid.`);
        return;
      }
    }

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan pesanan pembelian (PO)...');
      const res = await createPurchase({
        supplierId,
        purchasedAt,
        items,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success(`Draft PO #${res.data.purchaseNumber} berhasil dibuat!`, {
          id: toastId,
        });
        router.push(`/dashboard/inventory/purchases/${res.data.id}`);
      }
    });
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat formulir pembuatan pembelian...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/dashboard/inventory/purchases" className="hover:text-emerald-700 font-semibold transition-colors">
            &larr; Riwayat Pembelian
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Buat Pembelian Bahan Baru (PO)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pencatatan faktur pengadaan bahan baku dari supplier. Tersimpan sebagai Draft sebelum diposting.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── SUPPLIER & DATE CARD ────────────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Informasi Supplier & Faktur</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pilih Supplier / Vendor *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewSupplierName('');
                    setNewSupplierPhone('');
                    setNewSupplierAddress('');
                    setSupplierModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  + Tambah Supplier Baru
                </button>
              </div>

              <SearchableSelect
                isCreatable={true}
                onCreateOption={(inputVal) => {
                  setNewSupplierName(inputVal || '');
                  setNewSupplierPhone('');
                  setNewSupplierAddress('');
                  setSupplierModalOpen(true);
                }}
                formatCreateLabel={(inputVal) => `+ Daftarkan supplier baru "${inputVal}"`}
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.phone ? ` (${s.phone})` : ''}`,
                }))}
                value={supplierId}
                onChange={(val) => setSupplierId(val)}
                disabled={isPending}
                placeholder="Cari atau ketik nama supplier baru..."
                noOptionsMessage={({ inputValue }) =>
                  inputValue
                    ? `Tekan Enter untuk mendaftarkan "${inputValue}"`
                    : 'Belum ada supplier terdaftar'
                }
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ketik nama supplier baru lalu tekan Enter, atau klik tombol di atas untuk mendaftarkan langsung.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Tanggal Faktur / Pembelian *
              </label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
        </div>

        {/* ─── ITEMS LIST CARD ─────────────────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daftar Bahan Baku Dibeli *</h2>
              <p className="text-xs text-slate-500">
                Pilih bahan dan satuan beli yang digunakan pada nota/faktur supplier.
              </p>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              + Tambah Baris Bahan
            </button>
          </div>

          <div className="space-y-3">
            {items.map((row, idx) => {
              const selectedItem = inventoryItems.find(
                (inv) => inv.id === row.inventoryItemId
              );
              const selectedUnit = units.find(
                (u) => u.id === row.purchaseUnitId
              );

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-end gap-3"
                >
                  {/* Select Inventory Item */}
                  <div className="flex-1 w-full md:w-auto">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                      Bahan Baku #{idx + 1}
                    </label>
                    <SearchableSelect
                      options={inventoryItems.map((inv) => ({
                        value: inv.id,
                        label: `${inv.name} (${inv.category?.name || 'Bahan'}) — Base: ${inv.baseUnit?.code || ''}`,
                      }))}
                      value={row.inventoryItemId}
                      onChange={(val) => handleItemChange(idx, 'inventoryItemId', val)}
                      disabled={isPending}
                      placeholder="Pilih Bahan Baku..."
                    />
                  </div>

                  {/* Purchase Unit */}
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                      Satuan Beli
                    </label>
                    <SearchableSelect
                      options={units.map((u) => ({
                        value: u.id,
                        label: `${u.code} (${u.name})`,
                      }))}
                      value={row.purchaseUnitId}
                      onChange={(val) => handleItemChange(idx, 'purchaseUnitId', val)}
                      disabled={isPending}
                      placeholder="Satuan..."
                    />
                  </div>

                  {/* Quantity */}
                  <div className="w-full md:w-24">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                      Kuantitas
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={row.quantity}
                      onChange={(e) =>
                        handleItemChange(idx, 'quantity', e.target.value)
                      }
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Price per Unit */}
                  <div className="w-full md:w-36">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <CurrencyInput
                      placeholder="0"
                      value={row.unitPrice}
                      onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                      disabled={isPending}
                      required
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="w-full md:w-32 text-right font-mono">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">
                      Subtotal
                    </label>
                    <p className="text-xs font-bold text-emerald-700 py-2">
                      {formatRupiah(row.subtotal)}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <div className="pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
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

          {/* Grand Total Footer */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
            <div>
              <span className="text-xs text-emerald-900 font-sans">Total Nilai Faktur Pembelian:</span>
              <p className="text-xl font-extrabold text-emerald-700">
                {formatRupiah(grandTotal)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/inventory/purchases"
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={isPending || !supplierId}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {isPending ? 'Menyimpan PO...' : 'Simpan Draft Pembelian'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ─── MODAL POPUP TAMBAH SUPPLIER BARU ─────────────────────────────── */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Daftarkan Supplier Baru</h3>
                  <p className="text-xs text-slate-500">
                    Tersimpan langsung ke database dan otomatis terpilih.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNewSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nama Supplier / Vendor *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: PT Kopi Harapan / Toko Sumber Jaya"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 0812-3456-7890"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Jl. Sudirman No. 12, Jakarta"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  disabled={savingSupplier}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingSupplier ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan & Pilih Supplier'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
