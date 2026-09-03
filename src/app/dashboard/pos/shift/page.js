'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getCurrentShift,
  openShift,
  closeShift,
  addCashMovement,
} from '@/app/actions/shift';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';

export default function ShiftManagementPage() {
  const router = useRouter();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form Open Shift
  const [openingCash, setOpeningCash] = useState(200000);

  // Form Close Shift
  const [actualCash, setActualCash] = useState(0);

  // Modal Cash Movement
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState('CASH_IN');
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState('');

  async function loadShiftData() {
    setLoading(true);
    const res = await getCurrentShift();
    if (res.error) toast.error(res.error);
    else {
      setShift(res.data);
      if (res.data) {
        setActualCash(res.data.expectedCash || 0);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadShiftData();
  }, []);

  function handleOpenShift(e) {
    e.preventDefault();
    const cash = Number(openingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Modal awal kasir harus berupa angka positif.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Membuka shift kasir...');
      const res = await openShift({ openingCash: cash });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Shift kasir berhasil dibuka! Selamat melayani.', { id: toastId });
        await loadShiftData();
        router.push('/dashboard/pos');
      }
    });
  }

  async function handleCloseShift(e) {
    e.preventDefault();
    const Swal = (await import('sweetalert2')).default;

    const actual = Number(actualCash);
    const expected = Number(shift.expectedCash);
    const diff = actual - expected;

    const diffText =
      diff === 0
        ? '<span class="text-slate-700 font-bold">Pas (Tidak ada selisih)</span>'
        : diff > 0
        ? `<span class="text-emerald-700 font-bold">Surplus / Lebih: +${formatRupiah(diff)}</span>`
        : `<span class="text-rose-600 font-bold">Defisit / Kurang: -${formatRupiah(Math.abs(diff))}</span>`;

    const confirm = await Swal.fire({
      title: 'Tutup Shift Kasir?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2 font-sans">
          <p>Anda akan menutup sesi shift saat ini.</p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div class="flex justify-between text-slate-500">
              <span>Kas Diharapkan (Expected):</span>
              <span class="font-mono font-bold text-slate-900">${formatRupiah(expected)}</span>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Kas Fisik Aktual:</span>
              <span class="font-mono font-bold text-slate-900">${formatRupiah(actual)}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-200">
              <span>Selisih Rekonsiliasi:</span>
              <span class="font-mono">${diffText}</span>
            </div>
          </div>
          <p class="text-xs text-slate-400 italic">
            Laporan penutupan shift akan tercatat dan laci kasir dinonaktifkan hingga dibuka kembali.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tutup Shift',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menutup shift dan menghitung rekonsiliasi...');
      const res = await closeShift({
        actualCash: actual,
        notes: `Tutup shift kasir. Selisih: ${diff}`,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Shift kasir berhasil ditutup. Laporan tersimpan.', { id: toastId });
        loadShiftData();
      }
    });
  }

  function handleSaveMovement(e) {
    e.preventDefault();
    const amt = Number(movementAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Nominal mutasi kas harus lebih dari 0.');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Alasan mutasi kas wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Mencatat mutasi kas...');
      const res = await addCashMovement({
        type: movementType,
        amount: amt,
        reason: movementReason.trim(),
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          movementType === 'CASH_IN'
            ? 'Kas Masuk berhasil dicatat!'
            : 'Kas Keluar berhasil dicatat!',
          { id: toastId }
        );
        setMovementModalOpen(false);
        setMovementAmount(0);
        setMovementReason('');
        loadShiftData();
      }
    });
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat status shift kasir...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Shift Kasir (Cash Drawer)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Buka sesi shift kasir, catat modal awal, monitor arus kas laci, dan rekonsiliasi tutup shift.
          </p>
        </div>
        <Link
          href="/dashboard/pos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Layar Kasir (POS)
        </Link>
      </div>

      {/* ─── KONDISI 1: TIDAK ADA SHIFT AKTIF (BUKA SHIFT) ──────────────────── */}
      {!shift ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg mx-auto shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Shift Kasir Sedang Ditutup
            </h2>
            <p className="text-xs text-slate-500">
              Silakan masukkan modal awal kas kecil (kembalian) di laci kasir untuk memulai transaksi penjualan.
            </p>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Modal Awal Kasir (Cash Float) *
              </label>
              <CurrencyInput
                placeholder="200.000"
                value={openingCash}
                onChange={(val) => setOpeningCash(val)}
                disabled={isPending}
                required
              />
            </div>

            {/* Quick cash options */}
            <div className="flex gap-2">
              {[100000, 200000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningCash(amt)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-semibold transition-colors"
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isPending ? 'Membuka Shift...' : 'Buka Shift & Mulai Transaksi'}
            </button>
          </form>
        </div>
      ) : (
        /* ─── KONDISI 2: SHIFT AKTIF (MONITOR & TUTUP SHIFT) ──────────────── */
        <div className="space-y-6">
          {/* Active Shift Banner Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SHIFT AKTIF
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Mulai: {formatDateTime(shift.openedAt)}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  Petugas Kasir: {shift.user?.name || 'Kasir'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMovementModalOpen(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                + Catat Arus Kas
              </button>
            </div>
          </div>

          {/* KPI Laci Kas Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modal Awal Kasir</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatRupiah(shift.openingCash)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penjualan Tunai (Cash)</p>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-1">
                +{formatRupiah(shift.cashSales)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kas Masuk/Keluar</p>
              <p className="text-lg font-bold font-mono text-slate-700 mt-1">
                {formatRupiah(shift.totalCashIn - shift.totalCashOut)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Kas Seharusnya di Laci</p>
              <p className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatRupiah(shift.expectedCash)}
              </p>
            </div>
          </div>

          {/* Two Columns: Recent Movements & Close Shift Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Cash Movements List */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Arus Kas Masuk / Keluar Shift Ini
                </h3>
                <button
                  onClick={() => setMovementModalOpen(true)}
                  className="text-xs text-emerald-700 hover:underline font-semibold"
                >
                  + Tambah Mutasi
                </button>
              </div>

              <div className="space-y-2">
                {shift.cashMovements?.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">
                    Belum ada arus kas manual pada shift ini.
                  </p>
                ) : (
                  shift.cashMovements?.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              m.type === 'CASH_IN'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            )}
                          >
                            {m.type === 'CASH_IN' ? 'KAS MASUK' : 'KAS KELUAR'}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium mt-1">{m.reason}</p>
                      </div>
                      <p
                        className={cn(
                          'font-mono font-bold text-xs',
                          m.type === 'CASH_IN' ? 'text-emerald-700' : 'text-rose-600'
                        )}
                      >
                        {m.type === 'CASH_IN' ? '+' : '-'}{formatRupiah(m.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Close Shift Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Rekonsiliasi & Penutupan Shift
              </h3>
              <p className="text-xs text-slate-500">
                Hitung uang tunai fisik yang ada di laci kasir saat ini dan masukkan nominalnya untuk verifikasi selisih kas.
              </p>

              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Kas Fisik Riil di Laci (Actual Cash) *
                  </label>
                  <CurrencyInput
                    placeholder="0"
                    value={actualCash}
                    onChange={(val) => setActualCash(val)}
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Diff Preview */}
                {!isNaN(Number(actualCash)) && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 font-sans">Selisih Kas:</span>
                    <span
                      className={cn(
                        'font-bold',
                        Number(actualCash) - Number(shift.expectedCash) === 0
                          ? 'text-slate-700'
                          : Number(actualCash) - Number(shift.expectedCash) > 0
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                      )}
                    >
                      {Number(actualCash) - Number(shift.expectedCash) > 0 ? '+' : ''}
                      {formatRupiah(Number(actualCash) - Number(shift.expectedCash))}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menutup Shift...' : 'Tutup Shift Kasir'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ADD CASH MOVEMENT ─────────────────────────────────────────── */}
      {movementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Catat Arus Kas Manual
              </h3>
              <button
                onClick={() => setMovementModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Jenis Pergerakan Kas
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_IN')}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-bold transition-all',
                      movementType === 'CASH_IN'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    + Kas Masuk (In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_OUT')}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-bold transition-all',
                      movementType === 'CASH_OUT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    - Kas Keluar (Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nominal (Rp) *
                </label>
                <CurrencyInput
                  placeholder="0"
                  value={movementAmount}
                  onChange={(val) => setMovementAmount(val)}
                  disabled={isPending}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Keterangan / Alasan *
                </label>
                <textarea
                  rows="2"
                  placeholder="Contoh: Beli es batu kristal 2 bal, beli gas elpiji..."
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
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
                  {isPending ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
