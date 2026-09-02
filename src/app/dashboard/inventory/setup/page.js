'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
} from '@/app/actions/inventory';
import { cn } from '@/lib/utils';

export default function InventorySetupPage() {
  const [activeTab, setActiveTab] = useState('units'); // 'units' | 'categories'
  const [isPending, startTransition] = useTransition();

  // Data states
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states - Units
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');

  // Modal states - Categories
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');

  async function loadData() {
    setLoading(true);
    const [unitsRes, categoriesRes] = await Promise.all([
      getUnits(),
      getInventoryCategories(),
    ]);

    if (unitsRes.error) toast.error(unitsRes.error);
    else setUnits(unitsRes.data || []);

    if (categoriesRes.error) toast.error(categoriesRes.error);
    else setCategories(categoriesRes.data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // UNIT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  function openCreateUnitModal() {
    setEditingUnit(null);
    setUnitCode('');
    setUnitName('');
    setUnitModalOpen(true);
  }

  function openEditUnitModal(unit) {
    setEditingUnit(unit);
    setUnitCode(unit.code);
    setUnitName(unit.name);
    setUnitModalOpen(true);
  }

  function handleSaveUnit(e) {
    e.preventDefault();
    if (!unitCode.trim() || !unitName.trim()) {
      toast.error('Kode dan Nama satuan wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingUnit ? 'Memperbarui satuan...' : 'Menambahkan satuan...'
      );

      let res;
      if (editingUnit) {
        res = await updateUnit(editingUnit.id, { name: unitName });
      } else {
        res = await createUnit({ code: unitCode, name: unitName });
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingUnit
            ? 'Satuan berhasil diperbarui!'
            : 'Satuan baru berhasil ditambahkan!',
          { id: toastId }
        );
        setUnitModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDeleteUnit(unit) {
    const Swal = (await import('sweetalert2')).default;

    if (unit.isSystem) {
      await Swal.fire({
        icon: 'warning',
        title: 'Aksi Ditolak',
        text: `Satuan "${unit.code}" adalah satuan standar sistem dan tidak boleh dihapus.`,
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Satuan?',
      text: `Apakah Anda yakin ingin menghapus satuan "${unit.name} (${unit.code})"?`,
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
      const toastId = toast.loading('Menghapus satuan...');
      const res = await deleteUnit(unit.id);
      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.success('Satuan berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  function openCreateCategoryModal() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryModalOpen(true);
  }

  function handleSaveCategory(e) {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error('Nama kategori inventaris wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingCategory ? 'Memperbarui kategori...' : 'Menambahkan kategori...'
      );

      let res;
      if (editingCategory) {
        res = await updateInventoryCategory(editingCategory.id, {
          name: categoryName,
        });
      } else {
        res = await createInventoryCategory({ name: categoryName });
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingCategory
            ? 'Kategori berhasil diperbarui!'
            : 'Kategori baru berhasil ditambahkan!',
          { id: toastId }
        );
        setCategoryModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDeleteCategory(category) {
    const Swal = (await import('sweetalert2')).default;

    if (category._count?.items > 0) {
      await Swal.fire({
        icon: 'error',
        title: 'Tidak Dapat Dihapus',
        text: `Kategori "${category.name}" masih memiliki ${category._count.items} barang inventaris terkait. Pindahkan atau hapus barang terkait terlebih dahulu.`,
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Kategori?',
      text: `Apakah Anda yakin ingin menghapus kategori inventaris "${category.name}"?`,
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
      const res = await deleteInventoryCategory(category.id);
      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.success('Kategori berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Pengaturan Inventaris</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Kelola unit satuan bahan (g, kg, ml, L, pcs) dan kategori bahan baku.
          </p>
        </div>
        <Link
          href="/dashboard/inventory/items"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Daftar Stok Bahan
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-800">
        <button
          id="tab-units"
          onClick={() => setActiveTab('units')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all',
            activeTab === 'units'
              ? 'border-amber-500 text-amber-400 bg-amber-950/20'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
          </svg>
          Unit Satuan ({units.length})
        </button>
        <button
          id="tab-categories"
          onClick={() => setActiveTab('categories')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all',
            activeTab === 'categories'
              ? 'border-amber-500 text-amber-400 bg-amber-950/20'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Kategori Bahan ({categories.length})
        </button>
      </div>

      {/* Tab 1: Unit Satuan */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Satuan dasar digunakan untuk mencatat kuantitas bahan baku pada resep dan opname.
            </p>
            <button
              id="btn-add-unit"
              onClick={openCreateUnitModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Tambah Satuan
            </button>
          </div>

          <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
            <table className="w-full text-left text-sm text-stone-300">
              <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Kode Satuan</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Digunakan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-stone-500">
                      Memuat data satuan...
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-stone-500">
                      Belum ada satuan. Klik &quot;Tambah Satuan&quot; untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {unit.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-amber-50">{unit.name}</td>
                      <td className="py-3 px-4">
                        {unit.isSystem ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40">
                            Sistem
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-300 border border-stone-700">
                            Kustom
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-400">
                        {unit._count?.baseInventoryItems || 0} barang
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditUnitModal(unit)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        {!unit.isSystem && (
                          <button
                            onClick={() => handleDeleteUnit(unit)}
                            className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Kategori Inventaris */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Kategori untuk mengelompokkan bahan mentah (contoh: Coffee Beans, Dairy, Syrup, Packaging).
            </p>
            <button
              id="btn-add-inv-cat"
              onClick={openCreateCategoryModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Tambah Kategori
            </button>
          </div>

          <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
            <table className="w-full text-left text-sm text-stone-300">
              <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Jumlah Barang Terdaftar</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-stone-500">
                      Memuat data kategori...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-stone-500">
                      Belum ada kategori inventaris. Tambahkan kategori baru sekarang.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-amber-50">{cat.name}</td>
                      <td className="py-3 px-4 text-xs text-stone-400">
                        {cat._count?.items || 0} barang
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditCategoryModal(cat)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
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
        </div>
      )}

      {/* ─── MODAL UNIT ──────────────────────────────────────────────────────── */}
      {unitModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-50">
              {editingUnit ? 'Edit Nama Satuan' : 'Tambah Unit Satuan'}
            </h3>
            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Kode Satuan (Singkatan)
                </label>
                <input
                  type="text"
                  placeholder="contoh: pack, botol, sachet"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  disabled={Boolean(editingUnit) || isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
                  required
                />
                {editingUnit && (
                  <p className="text-xs text-stone-500 mt-1">
                    Kode satuan tidak dapat diubah setelah dibuat.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Lengkap Satuan
                </label>
                <input
                  type="text"
                  placeholder="contoh: Kemasan Pack 500g"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL KATEGORI ─────────────────────────────────────────────────── */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-50">
              {editingCategory ? 'Edit Kategori Inventaris' : 'Tambah Kategori Inventaris'}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  placeholder="contoh: Coffee Beans, Dairy & Milk, Packaging"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
