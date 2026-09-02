'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getProductCategories,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
} from '@/app/actions/product';

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');

  async function loadData() {
    setLoading(true);
    const res = await getProductCategories();
    if (res.error) toast.error(res.error);
    else setCategories(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingCategory(null);
    setName('');
    setModalOpen(true);
  }

  function openEditModal(category) {
    setEditingCategory(category);
    setName(category.name);
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama kategori produk wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingCategory ? 'Memperbarui kategori...' : 'Menambahkan kategori...'
      );

      let res;
      if (editingCategory) {
        res = await updateProductCategory(editingCategory.id, { name });
      } else {
        res = await createProductCategory({ name });
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingCategory
            ? 'Kategori produk berhasil diperbarui!'
            : 'Kategori produk baru berhasil ditambahkan!',
          { id: toastId }
        );
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(category) {
    const Swal = (await import('sweetalert2')).default;

    if (category._count?.products > 0) {
      await Swal.fire({
        icon: 'error',
        title: 'Tidak Dapat Dihapus',
        text: `Kategori "${category.name}" masih memiliki ${category._count.products} produk menu aktif. Pindahkan atau hapus produk di kategori ini terlebih dahulu.`,
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Kategori Produk?',
      text: `Apakah Anda yakin ingin menghapus kategori "${category.name}"?`,
      icon: 'question',
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
      const toastId = toast.loading('Menghapus kategori...');
      const res = await deleteProductCategory(category.id);
      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.success('Kategori berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Kategori Menu Produk</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Kategori khusus untuk pengelompokan menu penjualan di kasir POS (contoh: Coffee, Non-Coffee, Pastry, Snacks).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products/list"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Daftar Produk Menu
          </Link>
          <button
            id="btn-add-prod-cat"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Kategori
          </button>
        </div>
      </div>

      {/* Info Card: Isolation note */}
      <div className="p-4 bg-amber-950/20 border border-amber-800/30 rounded-2xl flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div className="text-xs text-stone-300">
          <span className="font-semibold text-amber-300">Prinsip Arsitektur POS:</span> Kategori Produk di modul ini terisolasi sepenuhnya dari Kategori Inventaris. Kategori ini hanya digunakan untuk mengelompokkan tampilan tombol dan tab kasir POS saat melayani pelanggan.
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <table className="w-full text-left text-sm text-stone-300">
          <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
            <tr>
              <th className="py-3 px-4">Nama Kategori Menu</th>
              <th className="py-3 px-4">Jumlah Menu Produk</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/60">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-stone-500">
                  Memuat kategori produk...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-stone-500">
                  Belum ada kategori menu. Klik &quot;Tambah Kategori&quot; untuk membuat yang pertama.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-stone-800/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-amber-50">{cat.name}</td>
                  <td className="py-3 px-4 text-xs text-stone-400">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700/60">
                      {cat._count?.products || 0} menu
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
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

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-50">
              {editingCategory ? 'Edit Kategori Menu' : 'Tambah Kategori Menu Baru'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Kategori Menu
                </label>
                <input
                  type="text"
                  placeholder="contoh: Signature Coffee, Manual Brew, Toast & Bakery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50 shadow-md shadow-amber-950"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
