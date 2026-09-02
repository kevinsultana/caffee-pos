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
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
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
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menghapus supplier...');
      const res = await deleteSupplier(sup.id);
      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.success('Supplier berhasil dihapus.', { id: toastId });
        loadData();
      }
    });
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Daftar Supplier / Vendor</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Kelola data vendor penyedia biji kopi, susu, sirup, dan kemasan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/purchases"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Riwayat Pembelian
          </Link>
          <button
            id="btn-add-supplier"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-950 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Tambah Supplier
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Cari nama supplier, nomor telepon, atau alamat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <table className="w-full text-left text-sm text-stone-300">
          <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
            <tr>
              <th className="py-3 px-4">Nama Supplier</th>
              <th className="py-3 px-4">Kontak Telepon</th>
              <th className="py-3 px-4">Alamat</th>
              <th className="py-3 px-4">Transaksi PO</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  Memuat data supplier...
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  {searchQuery
                    ? 'Tidak ada supplier yang cocok dengan pencarian.'
                    : 'Belum ada supplier terdaftar. Klik "Tambah Supplier" untuk memulai.'}
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-stone-800/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-amber-50">{sup.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-stone-300">
                    {sup.phone || '-'}
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-400 max-w-xs truncate">
                    {sup.address || '-'}
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-400">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700/60">
                      {sup._count?.purchases || 0} PO
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(sup)}
                      className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sup)}
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
              {editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nama Supplier / Perusahaan
                </label>
                <input
                  type="text"
                  placeholder="contoh: PT Kopi Nusantara, CV Sumber Dairy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Alamat Lengkap / Catatan
                </label>
                <textarea
                  rows={3}
                  placeholder="contoh: Jl. Roastery No. 12, Jakarta Barat"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800/80 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
