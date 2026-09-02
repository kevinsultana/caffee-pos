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

    if (scope === 'PRODUCT' && !targetProductId) {
      toast.error('Pilih produk target untuk promosi berskala PRODUCT.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingPromo ? 'Memperbarui promosi...' : 'Membuat promosi...'
      );

      const payload = {
        name,
        code,
        description,
        status,
        priority: Number(priority),
        stackable,
        startAt,
        endAt: endAt || null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        scope,
        discountType,
        discountValue: Number(discountValue),
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        minimumPurchase: minimumPurchase ? Number(minimumPurchase) : null,
        targetProductId: scope === 'PRODUCT' ? targetProductId : null,
      };

      let res;
      if (editingPromo) {
        res = await updatePromotion(editingPromo.id, payload);
      } else {
        res = await createPromotion(payload);
      }

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.success(
          editingPromo
            ? 'Promosi berhasil diperbarui!'
            : 'Promosi baru berhasil dibuat!',
          { id: toastId }
        );
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(promo) {
    const Swal = (await import('sweetalert2')).default;

    if (promo.usageCount > 0 || promo._count?.orderPromotions > 0) {
      await Swal.fire({
        icon: 'error',
        title: 'Tidak Boleh Dihapus',
        html: `
          <div class="text-left text-sm text-stone-300 space-y-2">
            <p>Promosi <b>"${promo.name}"</b> telah digunakan dalam <b>${promo.usageCount}</b> transaksi penjualan.</p>
            <p class="text-xs text-stone-400">
              Sesuai aturan audit ERD, promosi yang memiliki riwayat transaksi tidak boleh dihapus agar struk dan snapshot finansial historis tetap utuh.
            </p>
            <p class="text-xs text-amber-300 font-semibold">
              Saran: Ubah status promosi menjadi <b>INACTIVE</b> untuk menghentikannya.
            </p>
          </div>
        `,
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Promosi?',
      text: `Apakah Anda yakin ingin menghapus promosi "${promo.name}"?`,
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
      const toastId = toast.loading('Menghapus promosi...');
      const res = await deletePromotion(promo.id);

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Promosi berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  const filteredPromotions = promotions.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Manajemen Promosi & Diskon</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Konfigurasi aturan diskon berbasis kode promo atau diskon otomatis dengan evaluasi kondisi ketat.
          </p>
        </div>
        <button
          id="btn-add-promotion"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Promosi
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama promosi atau kode promo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE (Aktif)</option>
          <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Nama Promosi</th>
                <th className="py-3 px-4">Kode Promo</th>
                <th className="py-3 px-4">Cakupan (Scope)</th>
                <th className="py-3 px-4">Skema Diskon</th>
                <th className="py-3 px-4">Syarat Minimum</th>
                <th className="py-3 px-4">Status & Kuota</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Memuat daftar promosi...
                  </td>
                </tr>
              ) : filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
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
                    <tr key={p.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50">{p.name}</div>
                        {p.description && (
                          <p className="text-[11px] text-stone-500 line-clamp-1">
                            {p.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.code ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            {p.code}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-500 italic">Otomatis (No Code)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {action?.scope === 'PRODUCT' ? (
                          <div>
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/50">
                              PRODUCT
                            </span>
                            {prodTarget && (
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                Target: {prodTarget}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-950/60 text-purple-400 border border-purple-800/50">
                            ORDER (Subtotal)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <span className="font-bold text-amber-300">
                          {action?.type === 'PERCENTAGE'
                            ? `${action.value}%`
                            : formatRupiah(action?.value || 0)}
                        </span>
                        {action?.maxDiscount && (
                          <span className="text-stone-500 block text-[10px]">
                            Maks. {formatRupiah(action.maxDiscount)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-stone-300">
                        {minPurch ? formatRupiah(minPurch) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {p.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-800 text-stone-400 border border-stone-700">
                              INACTIVE
                            </span>
                          )}
                          <p className="text-[10px] text-stone-500">
                            Terpakai: {p.usageCount} {p.usageLimit ? `/ ${p.usageLimit}` : 'kali'}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
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

      {/* ─── MODAL ADD / EDIT PROMOTION ──────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-amber-50">
              {editingPromo ? 'Edit Promosi' : 'Buat Promosi / Diskon Baru'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nama & Kode Promo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Nama Promosi
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: Diskon Grand Opening, Promo Kopi Sore"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Kode Promo (Voucher)
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: KOPIHEMAT20 (Opsional)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 uppercase"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Keterangan / Syarat Promosi
                </label>
                <input
                  type="text"
                  placeholder="contoh: Diskon 20% khusus pembelian Espresso Blend di atas Rp50rb"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Cakupan Scope: ORDER vs PRODUCT */}
              <div className="p-4 bg-stone-800/50 border border-stone-700/60 rounded-2xl space-y-3">
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest">
                  Cakupan Diskon (Discount Scope)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('ORDER')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      scope === 'ORDER'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                    )}
                  >
                    <p className="text-sm font-semibold">ORDER Scope</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Memotong subtotal seluruh pesanan belanja.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('PRODUCT')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      scope === 'PRODUCT'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                    )}
                  >
                    <p className="text-sm font-semibold">PRODUCT Scope</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Hanya memotong menu produk tertentu.
                    </p>
                  </button>
                </div>

                {scope === 'PRODUCT' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">
                      Pilih Menu Produk Target
                    </label>
                    <select
                      value={targetProductId}
                      onChange={(e) => setTargetProductId(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-stone-900 border border-amber-600/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    >
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} ({formatRupiah(prod.price)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Tipe & Nilai Diskon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Tipe Diskon
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FIXED_AMOUNT">Nominal Tetap (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Besar Diskon ({discountType === 'PERCENTAGE' ? '%' : 'Rp'})
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max={discountType === 'PERCENTAGE' ? 100 : undefined}
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Maks. Diskon (Rp, Opsional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="contoh: 25000"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Syarat & Batas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Min. Pembelian Subtotal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    placeholder="0"
                    value={minimumPurchase}
                    onChange={(e) => setMinimumPurchase(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Batas Kuota Pemakaian (Kali)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited jika kosong"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Periode & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Tanggal Berakhir (Opsional)
                  </label>
                  <input
                    type="date"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Status Promosi
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="ACTIVE">ACTIVE (Aktif)</option>
                    <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50 shadow-md shadow-amber-950"
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
