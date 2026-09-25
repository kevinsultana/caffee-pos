'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPurchaseById, updatePurchase } from '@/app/actions/purchasing';
import { getSuppliers, createSupplier } from '@/app/actions/supplier';
import { getInventoryItems, getUnits } from '@/app/actions/inventory';
import { formatRupiah, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function EditPurchasePage({ params }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [purchase, setPurchase] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');

  // Modal Pendaftaran Supplier Baru
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Dynamic rows of items
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      const [purchaseRes, supRes, invRes, unitRes] = await Promise.all([
        getPurchaseById(resolvedParams.id),
        getSuppliers(),
        getInventoryItems(),
        getUnits(),
      ]);

      if (purchaseRes.error) {
        toast.error(purchaseRes.error);
        router.push('/dashboard/inventory/purchases');
        return;
      }

      const p = purchaseRes.data;
      if (p.status !== 'DRAFT') {
        toast.error('Pembelian berstatus CONFIRMED tidak dapat diedit karena stok sudah diposting.');
        router.push(`/dashboard/inventory/purchases/${p.id}`);
        return;
      }

      setPurchase(p);
      setSupplierId(p.supplierId || '');
      setPurchasedAt(
        p.purchasedAt
          ? new Date(p.purchasedAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );

      if (p.items?.length > 0) {
        setItems(
          p.items.map((it) => {
            const qty = Number(it.quantity) || 1;
            const factor = it.baseQuantity && qty > 0 ? Number(it.baseQuantity) / qty : 1;
            const subtotalVal = Number(it.subtotal) || 0;
            return {
              inventoryItemId: it.inventoryItemId,
              purchaseUnitId: it.purchaseUnitId,
              conversionFactor: factor,
              quantity: qty,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: subtotalVal,   // pre-fill totalPrice dari data existing
              subtotal: subtotalVal,
            };
          })
        );
      } else {
        setItems([
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

      if (supRes.data) setSuppliers(supRes.data);
      if (invRes.data) setInventoryItems(invRes.data);
      if (unitRes.data) setUnits(unitRes.data);

      setLoading(false);
    }

    loadMasterData();
  }, [resolvedParams.id, router]);

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

    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === res.data.id);
      if (exists) return prev;
      return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
    });

    setSupplierId(res.data.id);
    setSupplierModalOpen(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierAddress('');
  }

  function getUnitOptionsForItem(item) {
    if (!item) return [];
    const list = [];
    if (item.baseUnit) {
      list.push({
        value: item.baseUnitId,
        code: item.baseUnit.code,
        name: item.baseUnit.name,
        factor: 1,
        label: `${item.baseUnit.code} (${item.baseUnit.name}) — Satuan Dasar`,
      });
    }
    if (item.conversions && Array.isArray(item.conversions)) {
      item.conversions.forEach((c) => {
        if (c.purchaseUnit) {
          list.push({
            value: c.purchaseUnitId,
            code: c.purchaseUnit.code,
            name: c.purchaseUnit.name,
            factor: Number(c.conversionFactor),
            label: `${c.purchaseUnit.code} (${c.purchaseUnit.name}) — 1 ${c.purchaseUnit.code} = ${c.conversionFactor} ${item.baseUnit?.code || ''}`,
          });
        }
      });
    }
    return list;
  }

  function handleItemChange(index, field, value) {
    const newItems = [...items];
    const row = { ...newItems[index], [field]: value };

    // Saat bahan baku dipilih:
    if (field === 'inventoryItemId') {
      const selectedItem = inventoryItems.find((inv) => inv.id === value);
      row.inventoryItemId = value;
      if (selectedItem) {
        row.purchaseUnitId = selectedItem.baseUnitId;
        row.conversionFactor = 1;
      } else {
        row.purchaseUnitId = '';
        row.conversionFactor = 1;
      }
    }

    // Saat satuan beli diganti:
    if (field === 'purchaseUnitId') {
      const selectedItem = inventoryItems.find(
        (inv) => inv.id === row.inventoryItemId
      );
      const unitOptions = getUnitOptionsForItem(selectedItem);
      const chosenUnit = unitOptions.find((u) => u.value === value);

      row.purchaseUnitId = value;
      if (chosenUnit) {
        row.conversionFactor = chosenUnit.factor;
      } else {
        row.conversionFactor = 1;
      }
    }

    // ── Input totalPrice user menentukan subtotal pasti & unitPrice presisi ──
    const qty = Number(row.quantity) || 0;
    const total = Math.round(Number(row.totalPrice) || 0);

    row.subtotal = total;
    row.unitPrice = qty > 0 ? total / qty : 0;

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
        totalPrice: 0,
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
      const toastId = toast.loading('Memperbarui draft pembelian (PO)...');
      const res = await updatePurchase({
        id: resolvedParams.id,
        supplierId,
        purchasedAt,
        items,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success(`Draft PO #${purchase.purchaseNumber} berhasil diperbarui!`, {
          id: toastId,
        });
        router.push(`/dashboard/inventory/purchases/${purchase.id}`);
      }
    });
  }

  if (loading || !purchase) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat formulir edit draft pembelian...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link
              href={`/dashboard/inventory/purchases/${purchase.id}`}
              className="hover:text-emerald-700 font-semibold transition-colors"
            >
              &larr; Detail #{purchase.purchaseNumber}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Edit Draft Pembelian #{purchase.purchaseNumber}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Anda dapat mengubah supplier, tanggal faktur, atau rincian bahan selagi status masih DRAFT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/inventory/purchases/${purchase.id}`}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Batal
          </Link>
        </div>
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
          <div>
            <h2 className="text-sm font-bold text-slate-900">Daftar Bahan Baku Dibeli *</h2>
            <p className="text-xs text-slate-500">
              Ubah kuantitas, harga, atau tambahkan bahan baku baru pada draft ini.
            </p>
          </div>

          <div className="space-y-3">
            {items.map((row, idx) => {
              const selectedItem = inventoryItems.find(
                (inv) => inv.id === row.inventoryItemId
              );
              const unitOptions = getUnitOptionsForItem(selectedItem);
              const chosenUnit = unitOptions.find(
                (u) => u.value === row.purchaseUnitId
              );
              const selectedUnitCode = chosenUnit?.code || selectedItem?.baseUnit?.code || '';
              const baseUnitCode = selectedItem?.baseUnit?.code || '';
              const qty = Number(row.quantity) || 0;
              const total = Number(row.totalPrice) || 0;
              const factor = Number(row.conversionFactor) || 1;
              const baseQuantity = qty * factor;
              const pricePerPkg = qty > 0 ? total / qty : 0;
              const estHpp = baseQuantity > 0 ? total / baseQuantity : 0;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3"
                >
                  <div className="flex flex-col md:flex-row items-end gap-3">
                    {/* Select Inventory Item */}
                    <div className="flex-1 w-full md:w-auto">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Bahan Baku #{idx + 1}
                      </label>
                      <SearchableSelect
                        options={inventoryItems.map((inv) => ({
                          value: inv.id,
                          label: `${inv.name} (${inv.category?.name || 'Bahan'}) — Base: ${inv.baseUnit?.code || ''}${inv.conversions?.length ? ` (${inv.conversions.length} konversi)` : ''}`,
                        }))}
                        value={row.inventoryItemId}
                        onChange={(val) => handleItemChange(idx, 'inventoryItemId', val)}
                        disabled={isPending}
                        placeholder="Pilih Bahan Baku..."
                      />
                    </div>

                    {/* Purchase Unit */}
                    <div className="w-full md:w-56">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Satuan Beli
                      </label>
                      <SearchableSelect
                        options={unitOptions}
                        value={row.purchaseUnitId}
                        onChange={(val) => handleItemChange(idx, 'purchaseUnitId', val)}
                        disabled={isPending || !selectedItem || unitOptions.length <= 1}
                        placeholder={!selectedItem ? 'Pilih bahan dulu...' : 'Pilih satuan...'}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="w-full md:w-28">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Kuantitas ({selectedUnitCode || 'Kemasan'})
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

                    {/* Harga Total (INPUT — user mengetik total harga baris ini) */}
                    <div className="w-full md:w-40">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Harga Total / Subtotal (Rp)
                      </label>
                      <CurrencyInput
                        placeholder="0"
                        value={row.totalPrice}
                        onChange={(val) => handleItemChange(idx, 'totalPrice', val)}
                        disabled={isPending}
                        required
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="pt-2 md:pt-0">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus baris"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Helper Preview Info */}
                  {selectedItem && (
                    <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        <span className="text-slate-500 font-normal">Harga per Kemasan:</span>
                        <strong className="font-bold">
                          {formatRupiah(pricePerPkg)}
                        </strong>
                        {selectedUnitCode && (
                          <span className="text-slate-500 font-normal">/ {selectedUnitCode}</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 font-medium">
                        <span className="text-slate-500 font-normal">Stok Masuk:</span>
                        <strong className="font-bold font-mono">
                          {baseQuantity.toLocaleString('id-ID')} {baseUnitCode}
                        </strong>
                        {factor > 1 && (
                          <span className="text-sky-600 text-[10px] font-normal">
                            ({qty} &times; {factor})
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                        <span className="text-slate-500 font-normal">Estimasi HPP:</span>
                        <strong className="font-bold">
                          {estHpp > 0 && estHpp < 1
                            ? `Rp ${estHpp.toFixed(2)}`
                            : `~${formatRupiah(Math.round(estHpp * 100) / 100)}`}
                        </strong>
                        {baseUnitCode && (
                          <span className="text-slate-500 font-normal">/ {baseUnitCode}</span>
                        )}
                      </span>
                      {unitOptions.length <= 1 && (
                        <span className="text-[10px] text-slate-400 italic">
                          (Satuan dasar tanpa konversi)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Tombol Tambah Baris — di antara tabel dan total ── */}
          <div className="flex justify-start pt-1">
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 hover:border-emerald-400 rounded-xl text-xs font-bold transition-all shadow-2xs group"
            >
              <span className="w-5 h-5 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm transition-colors">+</span>
              Tambah Baris Bahan
            </button>
          </div>

          {/* Grand Total Footer */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
            <div>
              <span className="text-xs text-emerald-900 font-sans">Total Nilai Faktur Pembelian:</span>
              <p className="text-xl font-extrabold text-emerald-700">
                {formatRupiah(grandTotal)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/inventory/purchases/${purchase.id}`}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs font-sans transition-colors"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs font-sans shadow-xs transition-all disabled:opacity-50"
              >
                {isPending ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Draft'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ─── MODAL PENDAFTARAN SUPPLIER BARU ───────────────────────────────── */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Daftarkan Supplier Baru
              </h3>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveNewSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Supplier / Vendor *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: PT Sumber Pangan Makmur"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  disabled={savingSupplier}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  disabled={savingSupplier}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  placeholder="Alamat kantor / gudang supplier..."
                  rows={2}
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  disabled={savingSupplier}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  disabled={savingSupplier}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {savingSupplier ? 'Menyimpan...' : 'Simpan & Pilih'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
