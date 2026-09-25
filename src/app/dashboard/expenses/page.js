'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import CurrencyInput from '@/components/ui/CurrencyInput';
import {
  getExpenseNotes,
  getExpenseSummary,
  createExpenseNote,
  updateExpenseNote,
  deleteExpenseNote,
} from '@/app/actions/expense';
import { formatRupiah, formatDate, cn } from '@/lib/utils';

function toISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'TODAY': {
      const d = toISODateString(now);
      return { startDate: d, endDate: d };
    }
    case 'YESTERDAY': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = toISODateString(y);
      return { startDate: d, endDate: d };
    }
    case 'LAST_7_DAYS': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { startDate: toISODateString(from), endDate: toISODateString(now) };
    }
    case 'THIS_MONTH': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: toISODateString(first), endDate: toISODateString(last) };
    }
    default:
      return { startDate: null, endDate: null };
  }
}

const DATE_PRESETS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: 'LAST_7_DAYS', label: '7 Hari Terakhir' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'CUSTOM', label: 'Kustom' },
  { id: 'ALL', label: 'Semua' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalAmount: 0, totalCount: 0, averageAmount: 0 });

  // Filter States
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    pcs: 1,
    date: toISODateString(new Date()),
    notes: '',
  });

  // Calculate live total in form
  const calculatedTotal = useMemo(() => {
    const p = Number(formData.price) || 0;
    const q = Number(formData.pcs) || 0;
    return p * q;
  }, [formData.price, formData.pcs]);

  // Fetch expenses and summary
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let startDate = null;
      let endDate = null;

      if (datePreset === 'CUSTOM') {
        startDate = customStartDate || null;
        endDate = customEndDate || null;
      } else {
        const range = buildDateRange(datePreset);
        startDate = range.startDate;
        endDate = range.endDate;
      }

      const [notesRes, summaryRes] = await Promise.all([
        getExpenseNotes({ startDate, endDate, search: searchQuery }),
        getExpenseSummary({ startDate, endDate }),
      ]);

      if (notesRes.success) {
        setExpenses(notesRes.data || []);
      } else {
        toast.error(notesRes.error || 'Gagal mengambil data pengeluaran.');
      }

      if (summaryRes.success) {
        setSummary(summaryRes.data || { totalAmount: 0, totalCount: 0, averageAmount: 0 });
      }
    } catch (err) {
      console.error('[ExpensesPage.loadData] Error:', err);
      toast.error('Terjadi kesalahan saat memuat data pengeluaran.');
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Modal Handlers
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      name: '',
      price: '',
      pcs: 1,
      date: toISODateString(new Date()),
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingExpense(item);
    const itemDate = item.date ? item.date.split('T')[0] : toISODateString(new Date());
    setFormData({
      name: item.name || '',
      price: item.price || '',
      pcs: item.pcs || 1,
      date: itemDate,
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Nama pengeluaran wajib diisi.');
      return;
    }

    const price = Number(formData.price);
    if (isNaN(price) || price < 0) {
      toast.error('Harga satuan harus valid dan tidak boleh minus.');
      return;
    }

    const pcs = parseInt(formData.pcs, 10);
    if (isNaN(pcs) || pcs < 1) {
      toast.error('Jumlah item (pcs) minimal 1.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(editingExpense ? 'Memperbarui data...' : 'Menyimpan pengeluaran...');

    try {
      let res;
      if (editingExpense) {
        res = await updateExpenseNote(editingExpense.id, {
          name: formData.name,
          price,
          pcs,
          date: formData.date,
          notes: formData.notes,
        });
      } else {
        res = await createExpenseNote({
          name: formData.name,
          price,
          pcs,
          date: formData.date,
          notes: formData.notes,
        });
      }

      if (res.success) {
        toast.success(
          editingExpense ? 'Catatan pengeluaran berhasil diperbarui!' : 'Catatan pengeluaran berhasil ditambahkan!',
          { id: toastId }
        );
        handleCloseModal();
        loadData();
      } else {
        toast.error(res.error || 'Gagal menyimpan catatan pengeluaran.', { id: toastId });
      }
    } catch (err) {
      console.error('[ExpensesPage.handleSubmit] Error:', err);
      toast.error('Terjadi kesalahan jaringan/sistem.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Handler with SweetAlert2
  const handleDelete = async (item) => {
    try {
      const Swal = (await import('sweetalert2')).default;
      const result = await Swal.fire({
        title: 'Hapus Pengeluaran?',
        html: `Apakah Anda yakin ingin menghapus catatan <strong>"${item.name}"</strong> senilai <strong>${formatRupiah(item.total)}</strong>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus Data',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        customClass: {
          popup: 'rounded-2xl shadow-xl',
          confirmButton: 'rounded-xl px-4 py-2 font-bold text-xs',
          cancelButton: 'rounded-xl px-4 py-2 font-bold text-xs',
        },
      });

      if (!result.isConfirmed) return;

      const toastId = toast.loading('Menghapus data pengeluaran...');
      const res = await deleteExpenseNote(item.id);

      if (res.success) {
        toast.success('Catatan pengeluaran berhasil dihapus.', { id: toastId });
        loadData();
      } else {
        toast.error(res.error || 'Gagal menghapus catatan pengeluaran.', { id: toastId });
      }
    } catch (err) {
      console.error('[ExpensesPage.handleDelete] Error:', err);
      toast.error('Gagal memproses penghapusan data.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Laporan &amp; Keuangan</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
            Catatan Pengeluaran
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catat dan pantau seluruh pengeluaran operasional toko / kafe secara mandiri dan transparan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <svg
              className={cn('w-4 h-4 text-slate-500', loading && 'animate-spin')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Muat Ulang
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Tambah Pengeluaran
          </button>
        </div>
      </div>

      {/* ─── STATISTIK CARDS (RINGKASAN) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Pengeluaran */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Pengeluaran</span>
            <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2 font-mono tracking-tight">
            {formatRupiah(summary.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Akumulasi pengeluaran pada periode terpilih</p>
        </div>

        {/* Card 2: Total Data / Transaksi */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Item / Transaksi</span>
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono tracking-tight">
            {summary.totalCount} <span className="text-sm font-semibold text-slate-500">catatan</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Banyaknya entri biaya yang tercatat</p>
        </div>

        {/* Card 3: Rata-rata Pengeluaran */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata per Catatan</span>
            <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono tracking-tight">
            {formatRupiah(summary.averageAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Rata-rata biaya per nota / transaksi</p>
        </div>
      </div>

      {/* ─── FILTER PERIODE & SEARCH BAR ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 shrink-0">Periode:</span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                datePreset === p.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Range Picker */}
        {datePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="pt-1 border-t border-slate-100">
          <div className="relative">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Cari berdasarkan nama pengeluaran atau kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ─── TABEL DATA PENGELUARAN ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Nama Pengeluaran</th>
                <th className="py-3.5 px-4 text-right">Harga Satuan</th>
                <th className="py-3.5 px-4 text-center">Qty (Pcs)</th>
                <th className="py-3.5 px-4 text-right">Subtotal / Total</th>
                <th className="py-3.5 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="w-7 h-7 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
                    <p className="text-xs font-semibold text-slate-500">Memuat catatan pengeluaran...</p>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Tidak Ada Data Pengeluaran</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {searchQuery
                        ? 'Tidak ada pengeluaran yang cocok dengan kata kunci pencarian.'
                        : 'Belum ada catatan pengeluaran pada periode ini. Klik "+ Tambah Pengeluaran" untuk mulai mencatat.'}
                    </p>
                  </td>
                </tr>
              ) : (
                expenses.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* No */}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px]">
                      {index + 1}
                    </td>

                    {/* Tanggal */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {formatDate(item.date)}
                    </td>

                    {/* Nama Pengeluaran & Notes */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.notes && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                          Catatan: {item.notes}
                        </div>
                      )}
                    </td>

                    {/* Harga Satuan */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatRupiah(item.price)}
                    </td>

                    {/* Qty (Pcs) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono">
                        {item.pcs} pcs
                      </span>
                    </td>

                    {/* Subtotal / Total */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap text-sm">
                      {formatRupiah(item.total)}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Pengeluaran"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          title="Hapus Pengeluaran"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
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

      {/* ─── MODAL TAMBAH / EDIT PENGELUARAN ─────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  {editingExpense ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingExpense ? 'Edit Catatan Pengeluaran' : 'Tambah Pengeluaran Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingExpense ? 'Perbarui rincian data pengeluaran' : 'Lengkapi data pengeluaran operasional toko'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nama Pengeluaran */}
              <div>
                <label htmlFor="expense-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="expense-name"
                  required
                  placeholder="Contoh: Beli Gas Elpiji 3kg, Biji Kopi Robusta, Es Batu..."
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                />
              </div>

              {/* Tanggal */}
              <div>
                <label htmlFor="expense-date" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tanggal Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  id="expense-date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                />
              </div>

              {/* Grid 2 Kolom: Harga Satuan & Qty (Pcs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Harga Satuan */}
                <div>
                  <label htmlFor="expense-price" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Harga Satuan / Biaya <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    id="expense-price"
                    name="price"
                    placeholder="0"
                    value={formData.price}
                    onChange={(val) => setFormData((prev) => ({ ...prev, price: val }))}
                    className="py-2.5 bg-slate-50 focus:ring-rose-500"
                    required
                  />
                </div>

                {/* Qty / Pcs */}
                <div>
                  <label htmlFor="expense-pcs" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jumlah Item (Pcs) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="expense-pcs"
                    min="1"
                    required
                    value={formData.pcs}
                    onChange={(e) => setFormData((prev) => ({ ...prev, pcs: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Live Preview Kalkulasi Total */}
              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-rose-700 block">Total Kalkulasi Otomatis</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatRupiah(Number(formData.price) || 0)} × {formData.pcs || 0} pcs
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-rose-600 font-mono block">
                    {formatRupiah(calculatedTotal)}
                  </span>
                </div>
              </div>

              {/* Catatan / Keterangan Opsional */}
              <div>
                <label htmlFor="expense-notes" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan Tambahan <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  id="expense-notes"
                  rows={2}
                  placeholder="Catatan kwitansi, vendor, atau keterangan lain..."
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all resize-none"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {editingExpense ? 'Simpan Perubahan' : 'Tambah Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
