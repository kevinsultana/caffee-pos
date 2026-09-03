'use client';

import { useState, useEffect, useTransition } from 'react';
import toast from 'react-hot-toast';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '@/app/actions/promotion';
import { getProducts } from '@/app/actions/product';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [priority, setPriority] = useState(0);
  const [stackable, setStackable] = useState(false);
  const [startAt, setStartAt] = useState(new Date().toISOString().split('T')[0]);
  const [endAt, setEndAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [scope, setScope] = useState('ORDER');
  const [discountType, setDiscountType] = useState('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState(10);
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minimumPurchase, setMinimumPurchase] = useState('');
  const [targetProductId, setTargetProductId] = useState('');

  async function loadData() {
    setLoading(true);
    const [promoRes, prodRes] = await Promise.all([
      getPromotions(),
      getProducts(),
    ]);

    if (promoRes.error) toast.error(promoRes.error);
    else setPromotions(promoRes.data || []);

    if (prodRes.data) setProducts(prodRes.data);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingPromo(null);
    setName('');
    setCode('');
    setDescription('');
    setStatus('ACTIVE');
    setPriority(0);
    setStackable(false);
    setStartAt(new Date().toISOString().split('T')[0]);
    setEndAt('');
    setUsageLimit('');
    setScope('ORDER');
    setDiscountType('PERCENTAGE');
    setDiscountValue(10);
    setMaxDiscount('');
    setMinimumPurchase('');
    setTargetProductId(products[0]?.id || '');
    setModalOpen(true);
  }

  function openEditModal(promo) {
    setEditingPromo(promo);
    setName(promo.name);
    setCode(promo.code || '');
    setDescription(promo.description || '');
    setStatus(promo.status);
    setPriority(promo.priority || 0);
    setStackable(Boolean(promo.stackable));
    setStartAt(promo.startAt ? new Date(promo.startAt).toISOString().split('T')[0] : '');
    setEndAt(promo.endAt ? new Date(promo.endAt).toISOString().split('T')[0] : '');
    setUsageLimit(promo.usageLimit || '');

    const action = promo.discountAction;
    setScope(action?.scope || 'ORDER');
    setDiscountType(action?.type || 'PERCENTAGE');
    setDiscountValue(action?.value || 0);
    setMaxDiscount(action?.maxDiscount || '');

    const minCond = promo.conditionGroup?.conditions?.find(
      (c) => c.type === 'MINIMUM_PURCHASE'
    );
    setMinimumPurchase(minCond?.minimumPurchase || '');

    const prodCond = promo.conditionGroup?.conditions?.find(
      (c) => c.type === 'PRODUCT'
    );
    setTargetProductId(prodCond?.productId || products[0]?.id || '');

    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nama promosi wajib diisi.');
      return;
    }

    if (Number(discountValue) <= 0) {
      toast.error('Nilai diskon harus lebih dari 0.');
      return;
    }

    if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
      toast.error('Diskon persentase tidak boleh melebihi 100%.');
      return;
    }

    if (scope === 'PRODUCT' && !targetProductId) {
      toast.error('Pilih target produk menu untuk promosi tipe PRODUCT.');
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim() ? code.trim().toUpperCase() : null,
      description: description.trim() || null,
      status,
      priority: Number(priority) || 0,
      stackable,
      startAt: startAt || null,
      endAt: endAt || null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      scope,
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      minimumPurchase: minimumPurchase ? Number(minimumPurchase) : null,
      targetProductId: scope === 'PRODUCT' ? targetProductId : null,
    };

    startTransition(async () => {
      let res;
      if (editingPromo) {
        res = await updatePromotion(editingPromo.id, payload);
      } else {
        res = await createPromotion(payload);
      }

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(editingPromo ? 'Promosi berhasil diperbarui!' : 'Promosi baru berhasil dibuat!');
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(promo) {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Hapus Promosi?',
      text: `Apakah Anda yakin ingin menghapus promosi "${promo.name}"? Jika promosi sudah pernah digunakan di transaksi kasir, promosi akan dinonaktifkan secara otomatis.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus/Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const res = await deletePromotion(promo.id);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(res.message || 'Promosi berhasil dihapus.');
          loadData();
        }
      });
    }
  }

  const filteredPromotions = promotions.filter((p) => {
    const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchQuery;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Promosi & Skema Diskon
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Aturan diskon terkendali (Voucher Kode Promo, Diskon Menu, dan Diskon Minimum Belanja).
          </p>
        </div>
        <button
          id="btn-add-promotion"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Promosi
        </button>
      </div>

      {/* ─── FILTERS & SEARCH ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama promosi atau kode promo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE (Aktif)</option>
          <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
        </select>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nama Promosi</th>
                <th className="py-3.5 px-4">Kode Promo</th>
                <th className="py-3.5 px-4">Cakupan (Scope)</th>
                <th className="py-3.5 px-4 text-right">Skema Diskon</th>
                <th className="py-3.5 px-4 text-right">Syarat Minimum</th>
                <th className="py-3.5 px-4">Status & Kuota</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat daftar promosi...
                  </td>
                </tr>
              ) : filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchQuery || selectedStatus !== 'ALL'
                      ? 'Tidak ada promosi yang cocok dengan filter.'
                      : 'Belum ada promosi. Klik "Tambah Promosi" untuk membuat diskon baru.'}
                  </td>
                </tr>
              ) : (
                filteredPromotions.map((p) => {
                  const action = p.discountAction;
                  const minPurch = p.conditionGroup?.conditions?.find(
                    (c) => c.type === 'MINIMUM_PURCHASE'
                  )?.minimumPurchase;
                  const prodTarget = p.conditionGroup?.conditions?.find(
                    (c) => c.type === 'PRODUCT'
                  )?.product?.name;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {p.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.code ? (
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {p.code}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Otomatis (No Code)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {action?.scope === 'PRODUCT' ? (
                          <div>
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              PRODUCT
                            </span>
                            {prodTarget && (
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-30">
                                Target: {prodTarget}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            ORDER (Subtotal)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-right">
                        <span className="font-bold text-slate-900">
                          {action?.type === 'PERCENTAGE'
                            ? `${action.value}%`
                            : formatRupiah(action?.value || 0)}
                        </span>
                        {action?.maxDiscount && (
                          <span className="text-slate-400 block text-[10px]">
                            Maks: {formatRupiah(action.maxDiscount)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-700 text-right">
                        {minPurch ? formatRupiah(minPurch) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {p.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              INACTIVE
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono">
                            Terpakai: {p.usageCount} {p.usageLimit ? `/ ${p.usageLimit}` : 'kali'}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
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

      {/* ─── MODAL ADD/EDIT PROMOTION ────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingPromo ? 'Edit Promosi & Diskon' : 'Tambah Promosi Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Promosi *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Diskon Grand Opening 20%, Promo Kopi Susu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Kode Promo (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: SCHAW20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Jika dikosongkan, promo berlaku otomatis jika syarat terpenuhi.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Status Promosi
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE (Aktif)</option>
                    <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
                  </select>
                </div>
              </div>

              {/* Skema Diskon & Scope */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cakupan & Nilai Diskon
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Cakupan (Scope)</label>
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="ORDER">ORDER (Seluruh Tagihan)</option>
                      <option value="PRODUCT">PRODUCT (Menu Tertentu)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Tipe Diskon</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="PERCENTAGE">PERCENTAGE (%)</option>
                      <option value="FIXED_AMOUNT">FIXED AMOUNT (Rp Potongan)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">
                      {discountType === 'PERCENTAGE' ? 'Nilai Diskon (%) *' : 'Nominal Potongan (Rp) *'}
                    </label>
                    {discountType === 'PERCENTAGE' ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          placeholder="10"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono font-bold">%</span>
                      </div>
                    ) : (
                      <CurrencyInput
                        placeholder="10.000"
                        value={discountValue}
                        onChange={(val) => setDiscountValue(val)}
                        required
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">
                      Maksimal Diskon (Rp, Opsional)
                    </label>
                    <CurrencyInput
                      placeholder="contoh: 20.000"
                      value={maxDiscount}
                      onChange={(val) => setMaxDiscount(val)}
                    />
                  </div>
                </div>

                {scope === 'PRODUCT' && (
                  <div className="pt-2">
                    <label className="block text-[10px] text-emerald-800 font-bold mb-1">
                      Pilih Menu Target Diskon *
                    </label>
                    <select
                      value={targetProductId}
                      onChange={(e) => setTargetProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-500 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatRupiah(p.price)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Syarat & Batasan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Minimal Belanja (Rp, Opsional)
                  </label>
                  <CurrencyInput
                    placeholder="contoh: 50.000"
                    value={minimumPurchase}
                    onChange={(val) => setMinimumPurchase(val)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Batas Kuota Pemakaian (Kali)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="contoh: 100 (Kosong = Tak Terbatas)"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  {isPending ? 'Menyimpan...' : 'Simpan Promosi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
