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

    if (unit.isBase) {
      await Swal.fire({
        icon: 'error',
        title: 'Satuan Standar Sistem',
        text: `Satuan "${unit.code}" adalah satuan standar bawaan sistem dan tidak dapat dihapus.`,
        confirmButtonColor: '#e11d48',
        background: '#ffffff',
        color: '#0f172a',
      });
      return;
    }

    if (unit._count?.inventoryItems > 0 || unit._count?.purchaseConversions > 0) {
      await Swal.fire({
        icon: 'error',
        title: 'Tidak Dapat Dihapus',
        text: `Satuan "${unit.code}" masih digunakan pada ${unit._count.inventoryItems} barang inventaris atau konversi pembelian.`,
        confirmButtonColor: '#e11d48',
        background: '#ffffff',
        color: '#0f172a',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Satuan?',
      text: `Apakah Anda yakin ingin menghapus satuan "${unit.name}" (${unit.code})?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
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
        res = await updateInventoryCategory(editingCategory.id, { name: categoryName });
      } else {
        res = await createInventoryCategory({ name: categoryName });
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingCategory
            ? 'Kategori inventaris berhasil diperbarui!'
            : 'Kategori inventaris baru berhasil ditambahkan!',
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
        confirmButtonColor: '#e11d48',
        background: '#ffffff',
        color: '#0f172a',
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
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
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
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/inventory/items" className="hover:text-emerald-700 font-semibold transition-colors">
              &larr; Daftar Bahan Baku
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pengaturan Satuan & Kategori Bahan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola unit satuan bahan (g, kg, ml, L, pcs, dus) dan kategori bahan baku gudang.
          </p>
        </div>
      </div>

      {/* ─── TABS ─────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200">
        <button
          id="tab-units"
          onClick={() => setActiveTab('units')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 -mb-px transition-all',
            activeTab === 'units'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
            'flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 -mb-px transition-all',
            activeTab === 'categories'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Kategori Bahan ({categories.length})
        </button>
      </div>

      {/* ─── TAB 1: UNIT SATUAN ────────────────────────────────────────────── */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Satuan dasar digunakan untuk mencatat kuantitas bahan baku pada resep dan opname.
            </p>
            <button
              id="btn-add-unit"
              onClick={openCreateUnitModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Tambah Satuan
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Kode Satuan</th>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">Tipe Satuan</th>
                  <th className="py-3.5 px-4">Digunakan</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Memuat data satuan...
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Belum ada satuan. Klik &quot;Tambah Satuan&quot; untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {unit.code}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{unit.name}</td>
                      <td className="py-3.5 px-4">
                        {unit.isBase ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Base Default
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Kustom
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {unit._count?.inventoryItems || 0} bahan &bull; {unit._count?.purchaseConversions || 0} konversi
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditUnitModal(unit)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        {!unit.isBase && (
                          <button
                            onClick={() => handleDeleteUnit(unit)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
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

      {/* ─── TAB 2: KATEGORI BAHAN ─────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Kategori bahan baku gudang terpisah secara murni dari kategori produk menu POS.
            </p>
            <button
              id="btn-add-category"
              onClick={openCreateCategoryModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Tambah Kategori
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Kategori Bahan</th>
                  <th className="py-3.5 px-4">Jumlah Barang Inventaris</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      Memuat data kategori bahan...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      Belum ada kategori inventaris. Klik &quot;Tambah Kategori&quot; untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {cat.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {cat._count?.items || 0} Barang
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditCategoryModal(cat)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
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

      {/* ─── MODAL ADD/EDIT UNIT ────────────────────────────────────────────── */}
      {unitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingUnit ? 'Edit Nama Satuan' : 'Tambah Satuan Baru'}
              </h3>
              <button
                onClick={() => setUnitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kode Satuan (Simbol) *
                </label>
                <input
                  type="text"
                  placeholder="contoh: dus, karton, pack"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  disabled={isPending || Boolean(editingUnit)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Satuan *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Dus Besar (Isi 24)"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
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
                  {isPending ? 'Menyimpan...' : 'Simpan Satuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL ADD/EDIT CATEGORY ────────────────────────────────────────── */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Kategori Inventaris' : 'Tambah Kategori Inventaris'}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Kategori Bahan *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Biji Kopi, Produk Dairy, Kemasan & Cup"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
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
