'use client';

import { useState, useEffect, useTransition } from 'react';
import toast from 'react-hot-toast';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPurchaseHistory,
} from '@/app/actions/customer';
import { formatRupiah, formatDateTime } from '@/lib/utils';

export default function CustomersManagementPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Modal Add/Edit State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  });

  // Modal History State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('products'); // 'products' | 'orders'

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

  const openHistoryModal = async (c) => {
    setSelectedCustomer(c);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryTab('products');
    setHistoryData(null);

    const res = await getCustomerPurchaseHistory(c.id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setHistoryData(res.data);
    }
    setLoadingHistory(false);
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
      title: 'Hapus Pelanggan?',
      text: `Apakah Anda yakin ingin menghapus pelanggan "${c.name}"? Riwayat transaksi lampau tetap tersimpan di riwayat penjualan POS.`,
      icon: 'warning',
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
    <div className="space-y-6 max-w-7xl">

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Database Pelanggan (Member)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola database member kafe untuk pencatatan transaksi kasir POS, loyalitas, dan riwayat belanja pelanggan.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          + Member Baru
        </button>
      </div>

      {/* ─── SEARCH BAR ───────────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama pelanggan, nomor WhatsApp, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nama Pelanggan</th>
                <th className="py-3.5 px-4">No. WhatsApp / HP</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Total Transaksi</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Memuat data member pelanggan...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {searchQuery
                      ? 'Tidak ditemukan pelanggan yang cocok.'
                      : 'Belum ada pelanggan terdaftar. Klik "+ Member Baru" untuk menambahkan.'}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{c.name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {c.phone || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {c.email || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-slate-900 font-mono text-xs">
                          {formatRupiah(c.totalSpent || 0)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            {c.orderCount || 0} Transaksi
                          </span>
                          <button
                            onClick={() => openHistoryModal(c)}
                            className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold hover:underline flex items-center gap-0.5"
                            title="Lihat barang apa saja yang pernah dibeli"
                          >
                            Detail &rarr;
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openHistoryModal(c)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs"
                        title="Lihat riwayat pembelian dan barang yang pernah dibeli"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Riwayat Belanja
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
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

      {/* ─── MODAL ADD/EDIT CUSTOMER ────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCustomer ? 'Edit Data Member' : 'Daftarkan Member Baru'}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Kevin Sanjaya"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp / HP
                </label>
                <input
                  type="tel"
                  placeholder="contoh: 081234567890"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alamat Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="contoh: kevin@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  {isPending ? 'Menyimpan...' : 'Simpan Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DETAIL RIWAYAT BELANJA PELANGGAN ───────────────────────── */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base shadow-xs">
                  {selectedCustomer?.name ? selectedCustomer.name.slice(0, 2).toUpperCase() : 'CU'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {selectedCustomer?.name}
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Member POS
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                    {selectedCustomer?.phone && <span>📱 {selectedCustomer.phone}</span>}
                    {selectedCustomer?.email && <span>✉️ {selectedCustomer.email}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {loadingHistory ? (
                <div className="py-16 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
                  <p className="text-xs text-slate-500">Memuat riwayat transaksi dan daftar belanja pelanggan...</p>
                </div>
              ) : historyData ? (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Total Akumulasi Belanja
                      </span>
                      <span className="text-lg font-extrabold text-emerald-950 font-mono mt-1">
                        {formatRupiah(historyData.summary?.totalSpent || 0)}
                      </span>
                      <span className="text-[10px] text-emerald-600 mt-0.5">
                        dari pesanan yang berhasil dibayar
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex flex-col">
                      <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                        Frekuensi Transaksi
                      </span>
                      <span className="text-lg font-extrabold text-blue-950 font-mono mt-1">
                        {historyData.summary?.paidOrdersCount || 0} Kali
                      </span>
                      <span className="text-[10px] text-blue-600 mt-0.5">
                        dari {historyData.summary?.orderCount || 0} total pesanan dibuat
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex flex-col">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                        Total Porsi / Produk Dibeli
                      </span>
                      <span className="text-lg font-extrabold text-amber-950 font-mono mt-1">
                        {historyData.summary?.totalItemsPurchased || 0} Item
                      </span>
                      <span className="text-[10px] text-amber-600 mt-0.5">
                        {historyData.favoriteProducts?.length || 0} varian menu berbeda
                      </span>
                    </div>
                  </div>

                  {/* Tabs Navigation */}
                  <div className="flex border-b border-slate-200 space-x-4">
                    <button
                      onClick={() => setHistoryTab('products')}
                      className={`pb-2.5 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                        historyTab === 'products'
                          ? 'text-emerald-600 border-b-2 border-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Produk Pernah Dibeli
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
                        {historyData.favoriteProducts?.length || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => setHistoryTab('orders')}
                      className={`pb-2.5 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                        historyTab === 'orders'
                          ? 'text-emerald-600 border-b-2 border-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Riwayat Transaksi Pesanan
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
                        {historyData.orders?.length || 0}
                      </span>
                    </button>
                  </div>

                  {/* Tab 1: Ringkasan Produk yang Pernah Dibeli */}
                  {historyTab === 'products' && (
                    <div>
                      {(!historyData.favoriteProducts || historyData.favoriteProducts.length === 0) ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          Pelanggan ini belum pernah menyelesaikan pembelian produk.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="py-3 px-4 w-12">No</th>
                                <th className="py-3 px-4">Nama Produk / Menu</th>
                                <th className="py-3 px-4">Varian</th>
                                <th className="py-3 px-4 text-center">Total Kuantitas</th>
                                <th className="py-3 px-4 text-right">Total Belanja Menu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {historyData.favoriteProducts.map((p, idx) => (
                                <tr key={p.key || idx} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">{p.productName}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    {p.variantName ? (
                                      <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                        {p.variantName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">Reguler</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-slate-900 font-mono">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                      {p.totalQty}x
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                    {formatRupiah(p.totalSpent)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Riwayat Pesanan Berdasarkan Struk / Order */}
                  {historyTab === 'orders' && (
                    <div className="space-y-3">
                      {(!historyData.orders || historyData.orders.length === 0) ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          Belum ada transaksi yang tercatat untuk member ini.
                        </div>
                      ) : (
                        historyData.orders.map((order) => (
                          <div
                            key={order.id}
                            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition-all space-y-3 shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <span className="font-mono font-bold text-slate-900 text-xs mr-2">
                                  #{order.orderNumber}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {formatDateTime(order.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {order.paymentMethod || 'TUNAI/QRIS'}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    order.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : order.status === 'EXPIRED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {order.status === 'PAID' ? 'LUNAS' : order.status}
                                </span>
                                <span className="font-mono font-bold text-emerald-700 text-xs ml-1">
                                  {formatRupiah(order.grandTotal)}
                                </span>
                              </div>
                            </div>

                            {/* Item list in this order */}
                            <div className="space-y-1.5 pt-1">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/70"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-700 w-6">
                                      {item.quantity}x
                                    </span>
                                    <span className="font-medium text-slate-900">
                                      {item.productName}
                                      {item.variantName && (
                                        <span className="text-slate-500 font-normal ml-1">
                                          ({item.variantName})
                                        </span>
                                      )}
                                    </span>
                                    {item.notes && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded italic">
                                        &ldquo;{item.notes}&rdquo;
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-slate-700 font-medium">
                                    {formatRupiah(item.subtotal)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
