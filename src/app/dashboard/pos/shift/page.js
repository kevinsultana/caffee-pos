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
  const [openingCash, setOpeningCash] = useState(100000);

  // Form Close Shift (Hanya Setor Semua)
  const [actualCash, setActualCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  // Active Store Shifts & Limit State
  const [activeStoreShifts, setActiveStoreShifts] = useState([]);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [maxActiveShifts, setMaxActiveShifts] = useState(1);

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
      const activeList = res.activeStoreShifts || [];
      const limitReached = !!res.isLimitReached;
      setActiveStoreShifts(activeList);
      setIsLimitReached(limitReached);
      setMaxActiveShifts(res.maxActiveShifts || 1);

      if (res.data) {
        setActualCash(res.data.expectedCash || 0);
        setCloseNotes('');
      } else if (limitReached) {
        const names = activeList.map((s) => s.userName).join(', ') || 'kasir lain';
        toast.error(
          `Shift sedang aktif oleh ${names}. Anda tidak bisa membuka shift baru sebelum shift tersebut ditutup!`,
          { id: 'active-shift-warning-toast', duration: 6000 }
        );
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadShiftData();
  }, []);

  function handleOpenShift(e) {
    e.preventDefault();
    if (isLimitReached) {
      const names = activeStoreShifts.map((s) => s.userName).join(', ') || 'kasir lain';
      toast.error(`Sudah ada kasir yang aktif (${names}). Tidak bisa membuka shift baru!`);
      return;
    }

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

    if (isNaN(actual) || actual < 0) {
      toast.error('Uang fisik di laci (Actual Cash) harus diisi dengan benar.');
      return;
    }

    if (diff !== 0 && !closeNotes.trim()) {
      toast.error(
        `Terdapat selisih kas ${diff > 0 ? 'lebih' : 'kurang'} sebesar ${formatRupiah(Math.abs(diff))}. Catatan penutupan wajib diisi untuk menjelaskan selisih!`
      );
      return;
    }

    const diffBadge =
      diff === 0
        ? '<span class="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Cocok / Pas (Rp 0)</span>'
        : diff > 0
          ? `<span class="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Lebih / Surplus: +${formatRupiah(diff)}</span>`
          : `<span class="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">Kurang / Defisit: -${formatRupiah(Math.abs(diff))}</span>`;

    const confirm = await Swal.fire({
      title: 'Tutup Shift & Setor Semua Kas?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-3 font-sans">
          <p class="text-slate-600">
            Apakah Anda yakin ingin menutup shift ini dan <strong>menyetor seluruh kas</strong> sebesar <strong class="text-emerald-700 font-mono text-sm">${formatRupiah(actual)}</strong>?
          </p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
            <div class="flex justify-between text-slate-500 font-sans">
              <span>Modal Awal:</span>
              <span class="font-bold text-slate-800 font-mono">${formatRupiah(shift.openingCash)}</span>
            </div>
            <div class="flex justify-between text-slate-500 font-sans">
              <span>Total Penjualan Tunai:</span>
              <span class="font-bold text-slate-800 font-mono">+${formatRupiah(shift.cashSales)}</span>
            </div>
            <div class="flex justify-between text-slate-500 font-sans">
              <span>Kas Masuk (In):</span>
              <span class="font-bold text-emerald-700 font-mono">+${formatRupiah(shift.cashIn)}</span>
            </div>
            <div class="flex justify-between text-slate-500 font-sans">
              <span>Kas Keluar (Out):</span>
              <span class="font-bold text-rose-600 font-mono">-${formatRupiah(shift.cashOut)}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-200 text-slate-700 font-sans font-semibold">
              <span>Total Kas Seharusnya:</span>
              <span class="font-bold text-slate-900 font-mono">${formatRupiah(expected)}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-200 text-emerald-800 font-sans font-bold">
              <span>Total Fisik Disetor (100%):</span>
              <span class="font-mono text-emerald-800 text-sm">${formatRupiah(actual)}</span>
            </div>
            <div class="flex justify-between items-center pt-1 border-t border-slate-200 font-sans">
              <span class="font-medium text-slate-600">Status Selisih:</span>
              <div>${diffBadge}</div>
            </div>
            ${closeNotes.trim()
          ? `
            <div class="pt-1.5 border-t border-slate-200 text-slate-600 font-sans text-[11px]">
              <span class="font-bold">Catatan Penutupan:</span> ${closeNotes.trim()}
            </div>`
          : ''
        }
          </div>
          <p class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg leading-relaxed">
            ℹ️ Seluruh uang fisik kasir akan dicatat sebagai uang setoran akhir. Kasir shift berikutnya wajib melakukan Buka Shift dan input modal awal baru.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tutup & Setor Semua',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
      customClass: {
        popup: 'rounded-2xl shadow-xl',
        confirmButton: 'rounded-xl px-4 py-2 font-bold text-xs',
        cancelButton: 'rounded-xl px-4 py-2 font-bold text-xs',
      },
    });

    if (!confirm.isConfirmed) return;

    startTransition(async () => {
      const toastId = toast.loading('Menutup shift dan menyetor seluruh kas...');
      const res = await closeShift({
        shiftId: shift.id,
        actualCash: actual,
        notes: closeNotes.trim(),
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          `Shift kasir berhasil ditutup! Total setoran ${formatRupiah(actual)} telah dicatat.`,
          { id: toastId }
        );
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
    <div className="space-y-6 max-w-7xl">
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
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pos/history"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Riwayat Transaksi
          </Link>
          <Link
            href="/dashboard/pos"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Layar Kasir (POS)
          </Link>
        </div>
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

          {/* Warning banner jika batas shift tercapai / ada kasir lain yang aktif */}
          {isLimitReached && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>⚠️ Ada Shift Kasir yang Sedang Aktif</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Saat ini kasir <strong>{activeStoreShifts.map((s) => s.userName).join(', ') || 'lain'}</strong> sedang aktif bertugas. Toko dibatasi maksimal <strong>{maxActiveShifts} shift</strong> aktif bersamaan. Anda tidak bisa membuka shift baru sebelum shift tersebut ditutup.
              </p>
              <div className="pt-1">
                <Link
                  href="/dashboard/pos/manage-shifts"
                  className="text-xs font-bold text-amber-900 underline hover:text-amber-950 inline-flex items-center gap-1 cursor-pointer"
                >
                  Buka Kelola Shift &rarr;
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleOpenShift} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Modal Awal Kasir (Cash Float) *
              </label>
              <CurrencyInput
                placeholder="100.000"
                value={openingCash}
                onChange={(val) => setOpeningCash(val)}
                disabled={isPending || isLimitReached}
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
                  disabled={isPending || isLimitReached}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isPending || isLimitReached}
              className={cn(
                'w-full py-3 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5',
                isLimitReached
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              )}
            >
              {isLimitReached
                ? 'Tidak Bisa Buka Shift (Ada Kasir Aktif)'
                : isPending
                  ? 'Membuka Shift...'
                  : 'Buka Shift & Mulai Transaksi'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Modal Awal Kasir</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatRupiah(shift.openingCash)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Kas laci saat buka</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Penjualan Tunai</p>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-1">
                +{formatRupiah(shift.cashSales)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Uang kas dari order</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Penjualan QRIS</p>
              <p className="text-lg font-bold font-mono text-blue-700 mt-1">
                {formatRupiah(shift.qrisSales)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Non-tunai (masuk rekening)</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mutasi Kas Laci</p>
              <p className={cn(
                'text-lg font-bold font-mono mt-1',
                (shift.cashIn || 0) - (shift.cashOut || 0) >= 0 ? 'text-slate-800' : 'text-rose-600'
              )}>
                {((shift.cashIn || 0) - (shift.cashOut || 0) >= 0 ? '+' : '') +
                  formatRupiah((shift.cashIn || 0) - (shift.cashOut || 0))}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                In: +{formatRupiah(shift.cashIn || 0)} / Out: -{formatRupiah(shift.cashOut || 0)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 shadow-2xs">
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Kas di Laci (Saldo Akhir)</p>
              <p className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatRupiah(shift.expectedCash)}
              </p>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Target hitung fisik laci</p>
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

            {/* Right: Close Shift Form (Hanya Pilihan Setor Semua) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tutup Shift &amp; Setor Semua Kas
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hitung uang tunai fisik di laci kasir. Seluruh kas fisik akan disetor penuh ke owner/brankas toko.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  Setor Penuh (100%)
                </span>
              </div>

              {/* Card Rincian Ringkasan Kalkulasi */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2 text-xs font-mono">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans mb-1">
                  Rincian Ringkasan Kalkulasi:
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span className="font-sans">Modal Awal:</span>
                    <span className="font-bold text-slate-800 font-mono">{formatRupiah(shift.openingCash)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span className="font-sans">Total Penjualan Tunai:</span>
                    <span className="font-bold text-emerald-700 font-mono">+{formatRupiah(shift.cashSales)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span className="font-sans">Kas Masuk (Cash In):</span>
                    <span className="font-bold text-emerald-700 font-mono">+{formatRupiah(shift.cashIn)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span className="font-sans">Kas Keluar (Cash Out):</span>
                    <span className="font-bold text-rose-600 font-mono">-{formatRupiah(shift.cashOut)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-slate-200 text-slate-800 font-bold">
                    <span className="font-sans">Total Kas Seharusnya:</span>
                    <span className="text-slate-900 font-mono">{formatRupiah(shift.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-slate-200 text-emerald-800 font-bold bg-emerald-50/60 px-2 rounded-lg">
                    <span className="font-sans">Total Fisik Disetor:</span>
                    <span className="font-mono text-emerald-800 text-xs">
                      {formatRupiah(Number(actualCash) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200">
                    <span className="font-sans font-semibold text-slate-600">Status Selisih:</span>
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-md text-[11px] font-bold border font-sans',
                        Number(actualCash) - Number(shift.expectedCash) === 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : Number(actualCash) - Number(shift.expectedCash) > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                      )}
                    >
                      {Number(actualCash) - Number(shift.expectedCash) === 0
                        ? 'Cocok (Rp 0)'
                        : (Number(actualCash) - Number(shift.expectedCash) > 0 ? 'Lebih +' : 'Kurang ') +
                        formatRupiah(Math.abs(Number(actualCash) - Number(shift.expectedCash)))}
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4">
                {/* 1. Uang Fisik di Laci (Actual Cash) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Uang Fisik di Laci (Actual Cash) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActualCash(shift.expectedCash || 0)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      Samakan dg Kas Seharusnya
                    </button>
                  </div>
                  <CurrencyInput
                    placeholder="0"
                    value={actualCash}
                    onChange={(val) => setActualCash(val)}
                    disabled={isPending}
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hitung seluruh lembar dan koin rupiah yang ada di dalam laci kasir saat ini.
                  </p>
                </div>

                {/* 2. Catatan Penutupan (Notes) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Catatan Penutupan{' '}
                    {Number(actualCash) - Number(shift.expectedCash) !== 0 ? (
                      <span className="text-rose-600 font-bold">(Wajib Diisi karena ada selisih) *</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(opsional)</span>
                    )}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      Number(actualCash) - Number(shift.expectedCash) !== 0
                        ? 'Wajib jelaskan penyebab selisih kas fisik...'
                        : 'Catatan tambahan jika ada...'
                    }
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    disabled={isPending}
                    className={cn(
                      'w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-slate-900 text-xs focus:outline-none transition-all resize-none',
                      Number(actualCash) - Number(shift.expectedCash) !== 0
                        ? 'border-amber-300 focus:ring-2 focus:ring-amber-500 bg-amber-50/20'
                        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                    )}
                  />
                </div>

                {/* Helper text info */}
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 flex gap-2.5 text-xs text-amber-900 leading-relaxed">
                  <span className="shrink-0 text-amber-600 mt-0.5">ℹ️</span>
                  <p className="text-[11px]">
                    <strong>Perhatian:</strong> Seluruh uang fisik kasir akan dicatat sebagai uang setoran akhir. Kasir shift berikutnya wajib melakukan Buka Shift dan input modal awal baru.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isPending && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isPending ? 'Menutup Shift...' : 'Tutup Shift & Setor Semua Kas'}
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
