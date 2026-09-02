'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '@/app/actions/supplier';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  async function loadData() {
    setLoading(true);
    const res = await getSuppliers();
    if (res.error) toast.error(res.error);
    else setSuppliers(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setAddress('');
    setModalOpen(true);
  }

  function openEditModal(sup) {
    setEditingSupplier(sup);
    setName(sup.name);
    setPhone(sup.phone || '');
    setAddress(sup.address || '');
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama supplier wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        editingSupplier ? 'Memperbarui supplier...' : 'Menambahkan supplier...'
      );

      const payload = { name, phone, address };
      let res;
      if (editingSupplier) {
        res = await updateSupplier(editingSupplier.id, payload);
      } else {
        res = await createSupplier(payload);
      }

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          editingSupplier
            ? 'Data supplier berhasil diperbarui!'
            : 'Supplier baru berhasil ditambahkan!',
          { id: toastId }
        );
        setModalOpen(false);
        loadData();
      }
    });
  }

  async function handleDelete(sup) {
    const Swal = (await import('sweetalert2')).default;

    if (sup._count?.purchases > 0) {
      await Swal.fire({
        icon: 'error',
        title: 'Tidak Dapat Dihapus',
        text: `Supplier "${sup.name}" memiliki ${sup._count.purchases} riwayat pembelian bahan. Data ini tidak dapat dihapus untuk menjaga audit pembukuan.`,
        confirmButtonColor: '#e11d48',
        background: '#ffffff',
        color: '#0f172a',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hapus Supplier?',
      text: `Apakah Anda yakin ingin menghapus data supplier "${sup.name}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus data...');
        const res = await deleteSupplier(sup.id);
        if (res.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Supplier berhasil dihapus.', { id: toastId });
          loadData();
        }
      });
    }
  }

  const filteredSuppliers = suppliers.filter((s) => {
    return (
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Data Supplier & Vendor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar distributor dan supplier penyedia bahan baku kopi, susu, sirup, dan kemasan kafe.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          + Tambah Supplier
        </button>
      </div>

      {/* ─── SEARCH ───────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama supplier atau nomor kontak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Nama Supplier</th>
                <th className="py-3.5 px-6">Kontak / Telepon</th>
                <th className="py-3.5 px-6">Alamat</th>
                <th className="py-3.5 px-6">Riwayat PO</th>
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Memuat data supplier...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {searchQuery
                      ? 'Tidak ada supplier yang cocok dengan pencarian.'
                      : 'Belum ada supplier terdaftar. Klik "+ Tambah Supplier" untuk memulai.'}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {sup.name}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">
                      {sup.phone || '-'}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {sup.address || '-'}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                        {sup._count?.purchases || 0} Pembelian
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(sup)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sup)}
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

      {/* ─── MODAL ADD/EDIT SUPPLIER ────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
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
                  Nama Supplier / Vendor *
                </label>
                <input
                  type="text"
                  placeholder="contoh: PT. Sukses Jaya Kopi, CV. Sumber Dairy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="contoh: 021-5551234, 08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alamat Kantor / Gudang
                </label>
                <textarea
                  rows="2"
                  placeholder="Alamat lengkap supplier..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                  {isPending ? 'Menyimpan...' : 'Simpan Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
