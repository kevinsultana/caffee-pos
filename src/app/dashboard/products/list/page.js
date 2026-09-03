'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getProductCategories,
} from '@/app/actions/product';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function ProductsListPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [price, setPrice] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState('RECIPE');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [availability, setAvailability] = useState('AVAILABLE');
  const [discontinued, setDiscontinued] = useState(false);

  async function loadData() {
    setLoading(true);
    const [prodRes, catRes, invRes] = await Promise.all([
      getProducts(),
      getProductCategories(),
      getInventoryItems(),
    ]);

    if (prodRes.error) toast.error(prodRes.error);
    else setProducts(prodRes.data || []);

    if (catRes.error) toast.error(catRes.error);
    else setCategories(catRes.data || []);

    if (invRes.error) toast.error(invRes.error);
    else setInventoryItems(invRes.data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingProduct(null);
    setName('');
    setSku('');
    setImageUrl(null);
    setPrice(0);
    setCategoryId(categories[0]?.id || '');
    setType('RECIPE');
    setInventoryItemId('');
    setAvailability('AVAILABLE');
    setDiscontinued(false);
    setModalOpen(true);
  }

  function openEditModal(prod) {
    setEditingProduct(prod);
    setName(prod.name);
    setSku(prod.sku || '');
    setImageUrl(prod.imageUrl || null);
    setPrice(prod.price || 0);
    setCategoryId(prod.categoryId);
    setType(prod.type);
    setInventoryItemId(prod.inventoryItemId || '');
    setAvailability(prod.availability);
    setDiscontinued(Boolean(prod.discontinued));
    setModalOpen(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading('Mengunggah foto produk...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadProductImage(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Foto produk berhasil diunggah!', { id: toastId });
        setImageUrl(res.imageUrl);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah foto produk.', { id: toastId });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleRemoveImage() {
    setImageUrl(null);
  }

  function handleSave(e) {
    e.preventDefault();

    if (!name.trim() || !categoryId || !type) {
      toast.error('Nama Produk, Kategori, dan Tipe wajib diisi.');
      return;
    }

    if (type === 'DIRECT_STOCK' && !inventoryItemId) {
      toast.error('Produk DIRECT_STOCK wajib memilih barang inventaris pengurang stok.');
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      imageUrl: imageUrl || null,
      price: Number(price),
      categoryId,
      type,
      inventoryItemId: type === 'DIRECT_STOCK' ? inventoryItemId : null,
      availability,
      discontinued,
    };

    startTransition(async () => {
      let res;
      if (editingProduct) {
        res = await updateProduct(editingProduct.id, payload);
      } else {
        res = await createProduct(payload);
      }

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(editingProduct ? 'Produk berhasil diperbarui!' : 'Produk baru berhasil dibuat!');
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(prod) {
    const Swal = (await import('sweetalert2')).default;

    const result = await Swal.fire({
      title: 'Hapus Produk Menu?',
      text: `Menu "${prod.name}" akan dihapus. Jika menu sudah pernah ditransaksikan di POS, statusnya akan dialihkan ke "Dihentikan" (Discontinued) untuk melindungi riwayat laporan finansial.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus/Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (!result.isConfirmed) return;

    startTransition(async () => {
      const res = await deleteProduct(prod.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Produk berhasil diproses.');
        loadData();
      }
    });
  }

  // Filter products by category, type, and search
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchType = selectedType === 'ALL' || p.type === selectedType;
    const matchQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchType && matchQuery;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Daftar Menu Produk (POS)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola daftar menu jual kasir, resep racikan, varian ukuran/rasa, dan stok langsung.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/products/categories"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Kategori Menu
          </Link>
          <button
            id="btn-add-product"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Produk
          </button>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama menu, SKU, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <SearchableSelect
          options={[
            { value: 'ALL', label: `Semua Kategori (${categories.length})` },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={selectedCategory}
          onChange={(val) => setSelectedCategory(val || 'ALL')}
          className="w-full sm:w-56"
        />
        <SearchableSelect
          options={[
            { value: 'ALL', label: 'Semua Tipe Produk' },
            { value: 'RECIPE', label: 'RECIPE (Komposisi Resep)' },
            { value: 'DIRECT_STOCK', label: 'DIRECT_STOCK (Stok Langsung)' },
          ]}
          value={selectedType}
          onChange={(val) => setSelectedType(val || 'ALL')}
          className="w-full sm:w-56"
        />
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Menu Produk</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Tipe Pemotongan</th>
                <th className="py-3.5 px-4 text-right">Harga Jual</th>
                <th className="py-3.5 px-4">Ketersediaan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat daftar menu produk...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchQuery || selectedCategory !== 'ALL' || selectedType !== 'ALL'
                      ? 'Tidak ada produk menu yang cocok dengan filter.'
                      : 'Belum ada produk menu terdaftar. Klik "Tambah Produk" untuk membuat menu.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
                            {prod.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{prod.name}</div>
                            {prod.sku && (
                              <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                                SKU: {prod.sku}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {prod.category?.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {prod.type === 'RECIPE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Recipe
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Direct Stock
                            </span>
                            {prod.inventoryItem && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                Link: {prod.inventoryItem.name} ({prod.inventoryItem.balance?.quantity || 0} {prod.inventoryItem.baseUnit?.code})
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(prod.price)}
                      </td>
                      <td className="py-3.5 px-4">
                        {prod.availability === 'AVAILABLE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Tersedia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Habis
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {prod.discontinued ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Dihentikan
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/products/list/${prod.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          {prod.type === 'RECIPE' ? 'Resep & Varian' : 'Kelola Varian'} &rarr;
                        </Link>
                        <button
                          onClick={() => openEditModal(prod)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(prod)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors"
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

      {/* ─── MODAL ADD / EDIT PRODUCT ────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Produk Menu' : 'Tambah Produk Menu Baru'}
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
              {/* Foto Produk */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Foto Menu Produk (Opsional)
                </label>
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleImageUpload}
                    disabled={isPending || isUploadingImage}
                    className="hidden"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isPending || isUploadingImage}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                      >
                        {imageUrl ? 'Ganti Foto' : 'Pilih Foto'}
                      </button>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isPending || isUploadingImage}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Format PNG, JPG, WEBP maks 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Menu Produk *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Iced Caramel Latte, Espresso Single, Croissant Butter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* SKU & Harga Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    SKU / Barcode (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: SKU-CF-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Harga Jual (Rp) *
                  </label>
                  <CurrencyInput
                    placeholder="25.000"
                    value={price}
                    onChange={(val) => setPrice(val)}
                    disabled={isPending}
                    required
                  />
                </div>
              </div>

              {/* Kategori Menu */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kategori Menu Produk *
                </label>
                {categories.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    Belum ada kategori menu. Buat kategori terlebih dahulu di tab &quot;Kategori Menu&quot;.
                  </div>
                ) : (
                  <SearchableSelect
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={categoryId}
                    onChange={(val) => setCategoryId(val)}
                    disabled={isPending}
                    placeholder="Pilih Kategori Menu..."
                  />
                )}
              </div>

              {/* Tipe Produk: RECIPE vs DIRECT_STOCK */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Metode Pemotongan Stok Bahan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('RECIPE')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      type === 'RECIPE'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <p className="text-xs font-bold">RECIPE</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Stok dipotong berdasarkan komposisi resep racikan.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('DIRECT_STOCK')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      type === 'DIRECT_STOCK'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <p className="text-xs font-bold">DIRECT_STOCK</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Potong langsung 1 barang inventaris per 1 penjualan.
                    </p>
                  </button>
                </div>

                {/* Dropdown inventory item if DIRECT_STOCK */}
                {type === 'DIRECT_STOCK' && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                      Pilih Barang Inventaris Pemotong Stok
                    </label>
                    {inventoryItems.length === 0 ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                        Belum ada barang inventaris terdaftar. Tambahkan barang di modul Inventaris terlebih dahulu.
                      </div>
                    ) : (
                      <SearchableSelect
                        options={inventoryItems.map((inv) => ({
                          value: inv.id,
                          label: `${inv.name} (Kategori: ${inv.category?.name || '-'}, Stok: ${inv.balance?.quantity || 0} ${inv.baseUnit?.code || ''})`,
                        }))}
                        value={inventoryItemId}
                        onChange={(val) => setInventoryItemId(val)}
                        disabled={isPending}
                        placeholder="Pilih Barang Inventaris..."
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Status & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Ketersediaan Menu
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'AVAILABLE', label: 'AVAILABLE (Tersedia)' },
                      { value: 'OUT_OF_STOCK', label: 'OUT_OF_STOCK (Habis)' },
                    ]}
                    value={availability}
                    onChange={(val) => setAvailability(val || 'AVAILABLE')}
                    disabled={isPending}
                  />
                </div>
                <div className="flex items-center gap-2.5 pt-6">
                  <input
                    id="chk-discontinued"
                    type="checkbox"
                    checked={discontinued}
                    onChange={(e) => setDiscontinued(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="chk-discontinued" className="text-xs font-semibold text-slate-700">
                    Menu Dihentikan (Discontinued)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={
                    isPending ||
                    categories.length === 0 ||
                    (type === 'DIRECT_STOCK' && inventoryItems.length === 0)
                  }
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
