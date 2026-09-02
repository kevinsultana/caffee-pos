'use client';

import { useState, useEffect, useTransition } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@/app/actions/customer';

export default function CustomersManagementPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const loadCustomers = async (q = searchQuery) => {
    setLoading(true);
    const res = await getCustomers({ query: q });
    if (res?.error) {
      toast.error(res.error);
    } else {
      setCustomers(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers(searchQuery);
  }, [searchQuery]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '' });
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Nama pelanggan wajib diisi.');
      return;
    }

    startTransition(async () => {
      let res;
      if (editingCustomer) {
        const toastId = toast.loading('Menyimpan perubahan...');
        res = await updateCustomer({
          id: editingCustomer.id,
          name: form.name,
          phone: form.phone,
          email: form.email,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success('Data pelanggan berhasil diperbarui!', { id: toastId });
      } else {
        const toastId = toast.loading('Mendaftarkan pelanggan...');
        res = await createCustomer({
          name: form.name,
          phone: form.phone,
          email: form.email,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success(`Pelanggan "${res.data.name}" berhasil didaftarkan!`, { id: toastId });
      }

      setModalOpen(false);
      loadCustomers();
    });
  };

  const handleDelete = async (c) => {
    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: 'Hapus Data Pelanggan?',
      text: `Apakah Anda yakin ingin menghapus pelanggan "${c.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus...');
        const res = await deleteCustomer(c.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Pelanggan berhasil dihapus.', { id: toastId });
          loadCustomers();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </span>
            Database Pelanggan (Member)
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Kelola data kontak pelanggan untuk riwayat pesanan dan integrasi layar kasir POS.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          + Tambah Pelanggan
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-stone-900/40 border border-stone-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Cari nama, nomor telepon, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <svg className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        <div className="text-xs text-stone-500 font-mono">
          Total: <strong className="text-amber-200">{customers.length}</strong> Pelanggan
        </div>
      </div>

      {/* Table */}
      <div className="bg-stone-900/70 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Nama Pelanggan</th>
                <th className="py-3.5 px-4 font-semibold">No. Telepon / WhatsApp</th>
                <th className="py-3.5 px-4 font-semibold">Email</th>
                <th className="py-3.5 px-4 font-semibold text-center">Total Transaksi</th>
                <th className="py-3.5 px-4 font-semibold">Tgl Terdaftar</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    Memuat data pelanggan...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    {searchQuery
                      ? 'Tidak ada pelanggan yang cocok dengan pencarian.'
                      : 'Belum ada data pelanggan terdaftar. Klik "+ Tambah Pelanggan" untuk membuat baru.'}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-amber-50">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-300">
                      {c.phone || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-stone-400">
                      {c.email || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/40 font-bold text-[11px]">
                        {c.orderCount} Pesanan
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(c)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-[11px] font-semibold transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/30 text-[11px] font-semibold transition-all"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL TAMBAH / EDIT CUSTOMER ───────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h2 className="text-base font-bold text-amber-50">
                {editingCustomer ? `Edit Pelanggan: ${editingCustomer.name}` : 'Daftarkan Pelanggan Baru'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rina Anggraini"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="rina@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
