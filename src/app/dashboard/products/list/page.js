'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCategories,
} from '@/app/actions/product';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, cn } from '@/lib/utils';

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
    setPrice(prod.price || 0);
    setCategoryId(prod.categoryId);
    setType(prod.type);
    setInventoryItemId(prod.inventoryItemId || '');
    setAvailability(prod.availability);
    setDiscontinued(Boolean(prod.discontinued));
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();

    if (!name.trim() || !categoryId || !type) {
      toast.error('Nama Produk, Kategori, dan Tipe wajib diisi.');
      return;
    }

    if (type === 'DIRECT_STOCK' && !inventoryItemId) {
      toast.error('Produk DIRECT_STOCK wajib memilih barang inventaris pemotong stok.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingProduct ? 'Memperbarui produk...' : 'Menambahkan produk...'
      );

      const payload = {
        name,
        sku,
        price: Number(price),
        type,
        categoryId,
        availability,
        discontinued,
        inventoryItemId: type === 'DIRECT_STOCK' ? inventoryItemId : null,
      };

      let res;
      if (editingProduct) {
        res = await updateProduct(editingProduct.id, payload);
      } else {
        res = await createProduct(payload);
      }

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.success(
          editingProduct
            ? 'Produk berhasil diperbarui!'
            : 'Produk baru berhasil ditambahkan!',
          { id: toastId }
        );
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(prod) {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Hapus Produk?',
      text: `Apakah Anda yakin ingin menghapus produk "${prod.name}"?`,
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
      const toastId = toast.loading('Menghapus produk...');
      const res = await deleteProduct(prod.id);

      if (res.error) {
        toast.dismiss(toastId);
        await Swal.fire({
          icon: 'error',
          title: 'Tidak Dapat Dihapus',
          text: res.error,
          confirmButtonColor: '#b45309',
          background: '#1c1917',
          color: '#fef3c7',
        });
      } else {
        toast.success('Produk berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  // Filtered List
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.category?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory =
      selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchType = selectedType === 'ALL' || p.type === selectedType;

    return matchSearch && matchCategory && matchType;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Daftar Produk Menu (POS)</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Daftar menu jual yang dapat dipesan oleh kasir. Mendukung tipe Resep (Recipe) dan Stok Langsung (Direct Stock).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products/categories"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Kategori Menu
          </Link>
          <button
            id="btn-add-product"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama menu, SKU, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="ALL">Semua Kategori ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="ALL">Semua Tipe Produk</option>
          <option value="RECIPE">RECIPE (Pakai Resep)</option>
          <option value="DIRECT_STOCK">DIRECT_STOCK (Stok Langsung)</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Menu Produk</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Tipe Pemotongan</th>
                <th className="py-3 px-4">Harga Jual</th>
                <th className="py-3 px-4">Ketersediaan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Memuat daftar menu produk...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    {searchQuery || selectedCategory !== 'ALL' || selectedType !== 'ALL'
                      ? 'Tidak ada produk menu yang cocok dengan filter.'
                      : 'Belum ada produk menu terdaftar. Klik "Tambah Produk" untuk membuat menu.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  return (
                    <tr key={prod.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50">{prod.name}</div>
                        {prod.sku && (
                          <div className="font-mono text-[11px] text-stone-400">
                            SKU: {prod.sku}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-stone-800 text-stone-300 border border-stone-700/60">
                          {prod.category?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {prod.type === 'RECIPE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Recipe
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950/60 text-blue-300 border border-blue-800/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              Direct Stock
                            </span>
                            {prod.inventoryItem && (
                              <p className="text-[11px] text-stone-400">
                                Link: {prod.inventoryItem.name} ({prod.inventoryItem.balance?.quantity || 0} {prod.inventoryItem.baseUnit?.code})
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {formatRupiah(prod.price)}
                      </td>
                      <td className="py-3 px-4">
                        {prod.availability === 'AVAILABLE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Tersedia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Habis
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {prod.discontinued ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-400 border border-stone-700">
                            Dihentikan
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/30 text-emerald-300 border border-emerald-800/30">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/products/list/${prod.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          {prod.type === 'RECIPE' ? 'Resep & Varian' : 'Kelola Varian'} &rarr;
                        </Link>
                        <button
                          onClick={() => openEditModal(prod)}
                          className="px-2.5 py-1 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(prod)}
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

      {/* ─── MODAL ADD / EDIT PRODUCT ────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-amber-50">
              {editingProduct ? 'Edit Produk Menu' : 'Tambah Produk Menu Baru'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Menu Produk
                </label>
                <input
                  type="text"
                  placeholder="contoh: Iced Caramel Latte, Espresso Single, Croissant Butter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              {/* SKU & Harga Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    SKU / Barcode (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: SKU-CF-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="25000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
              </div>

              {/* Kategori Menu */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Kategori Menu Produk
                </label>
                {categories.length === 0 ? (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300">
                    Belum ada kategori menu. Buat kategori terlebih dahulu di tab &quot;Kategori Menu&quot;.
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  >
                    <option value="" disabled>
                      Pilih Kategori Menu
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tipe Produk: RECIPE vs DIRECT_STOCK */}
              <div className="p-4 bg-stone-800/50 border border-stone-700/60 rounded-2xl space-y-3">
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest">
                  Metode Pemotongan Stok Bahan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('RECIPE')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      type === 'RECIPE'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                    )}
                  >
                    <p className="text-sm font-semibold">RECIPE</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Stok dipotong berdasarkan komposisi resep racikan.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('DIRECT_STOCK')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      type === 'DIRECT_STOCK'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                    )}
                  >
                    <p className="text-sm font-semibold">DIRECT_STOCK</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Potong langsung 1 barang inventaris per 1 penjualan.
                    </p>
                  </button>
                </div>

                {/* Dropdown inventory item if DIRECT_STOCK */}
                {type === 'DIRECT_STOCK' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">
                      Pilih Barang Inventaris Pemotong Stok
                    </label>
                    {inventoryItems.length === 0 ? (
                      <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-300">
                        Belum ada barang inventaris terdaftar. Tambahkan barang di modul Inventaris terlebih dahulu.
                      </div>
                    ) : (
                      <select
                        value={inventoryItemId}
                        onChange={(e) => setInventoryItemId(e.target.value)}
                        disabled={isPending}
                        className="w-full px-3.5 py-2.5 bg-stone-900 border border-amber-600/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      >
                        <option value="" disabled>
                          -- Pilih Barang Inventaris --
                        </option>
                        {inventoryItems.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (Kategori: {inv.category?.name}, Stok: {inv.balance?.quantity || 0} {inv.baseUnit?.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Status & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                    Ketersediaan Menu
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="AVAILABLE">AVAILABLE (Tersedia)</option>
                    <option value="OUT_OF_STOCK">OUT_OF_STOCK (Habis)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    id="chk-discontinued"
                    type="checkbox"
                    checked={discontinued}
                    onChange={(e) => setDiscontinued(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-stone-700 text-amber-600 focus:ring-amber-500 bg-stone-800"
                  />
                  <label htmlFor="chk-discontinued" className="text-sm font-medium text-stone-300">
                    Menu Dihentikan (Discontinued)
                  </label>
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
                  disabled={
                    isPending ||
                    categories.length === 0 ||
                    (type === 'DIRECT_STOCK' && inventoryItems.length === 0)
                  }
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50 shadow-md shadow-amber-950"
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
