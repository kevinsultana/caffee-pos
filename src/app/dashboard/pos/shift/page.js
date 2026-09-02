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
        ? '<span class="text-emerald-400 font-bold">Pas (Tidak ada selisih)</span>'
        : diff > 0
        ? `<span class="text-emerald-400 font-bold">Surplus / Lebih: +${formatRupiah(diff)}</span>`
        : `<span class="text-red-400 font-bold">Defisit / Kurang: -${formatRupiah(Math.abs(diff))}</span>`;

    const confirm = await Swal.fire({
      title: 'Tutup Shift Kasir?',
      html: `
        <div class="text-left text-sm text-stone-300 space-y-2">
          <p>Anda akan menutup sesi shift saat ini.</p>
          <div class="p-3 bg-stone-800 rounded-xl space-y-1 text-xs">
            <div class="flex justify-between text-stone-400">
              <span>Kas Diharapkan (Expected):</span>
              <span class="font-mono font-bold text-amber-300">${formatRupiah(expected)}</span>
            </div>
            <div class="flex justify-between text-stone-400">
              <span>Kas Fisik Aktual:</span>
              <span class="font-mono font-bold text-stone-100">${formatRupiah(actual)}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-stone-700">
              <span>Status Selisih:</span>
              <span>${diffText}</span>
            </div>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tutup Shift',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menutup shift kasir...');
      const res = await closeShift({ actualCash: actual });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Shift kasir berhasil ditutup.', { id: toastId });
        loadShiftData();
      }
    });
  }

  function handleSaveMovement(e) {
    e.preventDefault();
    if (Number(movementAmount) <= 0 || !movementReason.trim()) {
      toast.error('Jumlah dan alasan mutasi kas wajib diisi.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Mencatat pergerakan kas...');
      const res = await addCashMovement({
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Mutasi kas berhasil dicatat!', { id: toastId });
        setMovementModalOpen(false);
        setMovementAmount(0);
        setMovementReason('');
        loadShiftData();
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        Memeriksa status shift kasir...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ─── KONDISI 1: BELUM BUKA SHIFT ────────────────────────────────────── */}
      {!shift ? (
        <div className="max-w-xl mx-auto space-y-6 py-8">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-3xl bg-amber-950/40 border border-amber-800/40 text-amber-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Buka Shift Kasir Baru</h1>
            <p className="text-sm text-stone-400 max-w-md mx-auto">
              Sesuai aturan operasional Schaw Cafe, kasir harus membuka shift dan memasukkan modal awal sebelum dapat melayani transaksi penjualan di POS.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-stone-800/80 bg-stone-900/60 shadow-xl space-y-5">
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest mb-1.5">
                  Modal Awal Kasir / Opening Cash (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="200000"
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <p className="text-[11px] text-stone-400">Pilihan Cepat Nominal:</p>
                <div className="grid grid-cols-4 gap-2">
                  {[100000, 200000, 300000, 500000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setOpeningCash(nominal)}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        Number(openingCash) === nominal
                          ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800/60 border-stone-700 text-stone-300 hover:bg-stone-800'
                      )}
                    >
                      {formatRupiah(nominal)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                {isPending ? 'Membuka Shift...' : 'Buka Shift & Masuk Layar POS'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ─── KONDISI 2: SHIFT SEDANG AKTIF (OPEN) ─────────────────────────── */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-amber-50">Status Shift Kasir Aktif</h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  SHIFT OPEN
                </span>
              </div>
              <p className="text-sm text-stone-400 mt-0.5">
                Kasir: <span className="text-amber-300 font-semibold">{shift.user?.name}</span> &middot; Dibuka sejak: {formatDateTime(shift.openedAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMovementModalOpen(true)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Kas Masuk / Keluar
              </button>
              <Link
                href="/dashboard/pos"
                className="px-5 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-950 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                Layar Kasir (POS)
              </Link>
            </div>
          </div>

          {/* Cards Grid Financial Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Modal Awal */}
            <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-1">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Modal Awal (Opening)
              </p>
              <p className="text-xl font-bold font-mono text-stone-100">
                {formatRupiah(shift.openingCash)}
              </p>
              <p className="text-[11px] text-stone-500">Kas tunai awal laci</p>
            </div>

            {/* Penjualan Tunai */}
            <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-1">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Penjualan Tunai (Cash)
              </p>
              <p className="text-xl font-bold font-mono text-emerald-400">
                +{formatRupiah(shift.cashSales)}
              </p>
              <p className="text-[11px] text-stone-500">Uang fisik masuk</p>
            </div>

            {/* Penjualan QRIS */}
            <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-1">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Penjualan QRIS
              </p>
              <p className="text-xl font-bold font-mono text-blue-400">
                {formatRupiah(shift.qrisSales)}
              </p>
              <p className="text-[11px] text-blue-300/80">Non-kas (Rekening Bank)</p>
            </div>

            {/* Kas Masuk / Keluar */}
            <div className="p-5 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-1">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Mutasi Kas (In/Out)
              </p>
              <div className="text-sm font-mono space-y-0.5">
                <span className="text-emerald-400">+{formatRupiah(shift.cashIn)}</span> &middot;{' '}
                <span className="text-red-400">-{formatRupiah(shift.cashOut)}</span>
              </div>
              <p className="text-[11px] text-stone-500">Pengeluaran/penerimaan kas</p>
            </div>
          </div>

          {/* Expected Cash Highlight & Close Shift Form */}
          <div className="p-6 rounded-2xl border border-amber-900/40 bg-linear-to-br from-stone-900 via-stone-900/90 to-amber-950/20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Total Kas Fisik yang Diharapkan (Expected Cash)
                </p>
                <p className="text-3xl font-extrabold font-mono text-amber-300 mt-1">
                  {formatRupiah(shift.expectedCash)}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Rumus: Modal Awal ({formatRupiah(shift.openingCash)}) + Penjualan Tunai ({formatRupiah(shift.cashSales)}) + Kas In ({formatRupiah(shift.cashIn)}) - Kas Out ({formatRupiah(shift.cashOut)})
                </p>
              </div>
            </div>

            {/* Close Shift Box */}
            <div className="pt-6 border-t border-stone-800/80">
              <h2 className="text-sm font-bold text-stone-200 uppercase tracking-wider mb-4">
                Form Tutup Shift Kasir
              </h2>
              <form onSubmit={handleCloseShift} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest mb-1.5">
                      Hitung Kas Fisik Aktual di Laci (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      disabled={isPending}
                      className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 mb-2">
                      Selisih:{' '}
                      <span
                        className={cn(
                          'font-mono font-bold',
                          Number(actualCash) - shift.expectedCash >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        )}
                      >
                        {formatRupiah(Number(actualCash) - shift.expectedCash)}
                      </span>
                    </p>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full py-3 bg-linear-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-bold shadow-md shadow-red-950 transition-all disabled:opacity-50"
                    >
                      {isPending ? 'Menutup Shift...' : 'Tutup Shift Sekarang'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CASH MOVEMENT ────────────────────────────────────────────── */}
      {movementModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-50">
              Catat Mutasi Kas Fisik Laci
            </h3>
            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Tipe Pergerakan Kas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_IN')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold border transition-colors',
                      movementType === 'CASH_IN'
                        ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400'
                    )}
                  >
                    KAS MASUK (Cash In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_OUT')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold border transition-colors',
                      movementType === 'CASH_OUT'
                        ? 'bg-red-950/60 border-red-600 text-red-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400'
                    )}
                  >
                    KAS KELUAR (Cash Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Jumlah Nominal (Rp)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  placeholder="50000"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Alasan / Keterangan Mutasi
                </label>
                <textarea
                  rows={2}
                  placeholder="contoh: Beli es batu darurat, Tambahan uang kembalian dari brankas"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
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
