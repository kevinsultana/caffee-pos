'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryCategories,
  getUnits,
} from '@/app/actions/inventory';
import { cn } from '@/lib/utils';

export default function InventoryItemsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [minimumStock, setMinimumStock] = useState(0);

  async function loadData() {
    setLoading(true);
    const [itemsRes, catRes, unitRes] = await Promise.all([
      getInventoryItems(),
      getInventoryCategories(),
      getUnits(),
    ]);

    if (itemsRes.error) toast.error(itemsRes.error);
    else setItems(itemsRes.data || []);

    if (catRes.error) toast.error(catRes.error);
    else setCategories(catRes.data || []);

    if (unitRes.error) toast.error(unitRes.error);
    else setUnits(unitRes.data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingItem(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setBaseUnitId(units[0]?.id || '');
    setMinimumStock(0);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(item.categoryId);
    setBaseUnitId(item.baseUnitId);
    setMinimumStock(item.minimumStock || 0);
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim() || !categoryId || !baseUnitId) {
      toast.error('Nama, Kategori, dan Unit Satuan wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingItem ? 'Menyimpan perubahan...' : 'Menambahkan bahan...'
      );

      let res;
      if (editingItem) {
        res = await updateInventoryItem(editingItem.id, {
          name,
          categoryId,
          baseUnitId,
          minimumStock: Number(minimumStock),
        });
      } else {
        res = await createInventoryItem({
          name,
          categoryId,
          baseUnitId,
          minimumStock: Number(minimumStock),
        });
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingItem
            ? 'Bahan baku berhasil diperbarui!'
            : 'Bahan baku baru berhasil ditambahkan!',
          { id: toastId }
        );
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(item) {
    const Swal = (await import('sweetalert2')).default;

    const confirm = await Swal.fire({
      title: 'Hapus Bahan Baku?',
      text: `Apakah Anda yakin ingin menghapus "${item.name}"? Aksi ini akan memeriksa apakah bahan digunakan di resep atau produk.`,
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
      const toastId = toast.loading('Menghapus bahan baku...');
      const res = await deleteInventoryItem(item.id);

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
        toast.success('Bahan baku berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  // Filtered List
  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory =
      selectedCategory === 'ALL' || item.categoryId === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Daftar Stok Bahan Baku (Inventaris)</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Daftar fisik bahan baku yang digunakan untuk resep menu atau pemotongan stok langsung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/setup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.11v-1.093c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Unit & Kategori
          </Link>
          <button
            id="btn-add-item"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Bahan
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
            placeholder="Cari nama bahan atau kategori..."
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
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Satuan Dasar</th>
                <th className="py-3 px-4">Stok Saat Ini</th>
                <th className="py-3 px-4">Batas Minimum</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Memuat daftar bahan baku...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    {searchQuery || selectedCategory !== 'ALL'
                      ? 'Tidak ada bahan yang cocok dengan pencarian.'
                      : 'Belum ada bahan baku terdaftar. Klik "Tambah Bahan" untuk memulai.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const qty = Number(item.balance?.quantity || 0);
                  const min = Number(item.minimumStock || 0);
                  const isLow = qty <= min && min > 0;

                  return (
                    <tr key={item.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50">{item.name}</div>
                        {item.product && (
                          <span className="text-[11px] text-amber-400/80">
                            Linked: Direct Stock ({item.product.name})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-stone-800 text-stone-300 border border-stone-700/60">
                          {item.category?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-amber-300">
                        {item.baseUnit?.code} ({item.baseUnit?.name})
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-stone-100">
                        {qty.toLocaleString('id-ID')} {item.baseUnit?.code}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-stone-400">
                        {min.toLocaleString('id-ID')} {item.baseUnit?.code}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            Stok Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/dashboard/inventory/items/${item.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          Konversi Satuan &rarr;
                        </Link>
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
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

      {/* ─── MODAL ADD / EDIT INVENTORY ITEM ─────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-50">
              {editingItem ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              {/* Nama Bahan */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Bahan Baku
                </label>
                <input
                  type="text"
                  placeholder="contoh: Biji Kopi Espresso Blend, Susu UHT 1L, Cup 16oz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              {/* Kategori Inventaris */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Kategori Bahan
                </label>
                {categories.length === 0 ? (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300">
                    Belum ada kategori inventaris. Silakan buat di tab Setup terlebih dahulu.
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
                      Pilih Kategori
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Base Unit */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Satuan Dasar (Base Unit)
                </label>
                {units.length === 0 ? (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300">
                    Belum ada satuan. Silakan buat di tab Setup terlebih dahulu.
                  </div>
                ) : (
                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  >
                    <option value="" disabled>
                      Pilih Satuan Dasar
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Minimum Stock */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Batas Minimum Stok (Peringatan Reorder)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3">
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
                  disabled={isPending || categories.length === 0 || units.length === 0}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50 shadow-md shadow-amber-950"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Bahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
