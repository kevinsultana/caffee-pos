'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { getCurrentShift, addCashMovement } from '@/app/actions/shift';
import { formatRupiah, cn } from '@/lib/utils';

export default function PosCashMovementPage() {
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('CASH_OUT'); // 'CASH_IN' | 'CASH_OUT'
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const loadShift = async () => {
    setLoading(true);
    const res = await getCurrentShift();
    if (res?.error) {
      toast.error(res.error);
    } else {
      setShiftData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadShift();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Masukkan nominal kas yang valid.');
      return;
    }

    if (!reason.trim()) {
      toast.error('Alasan / keterangan arus kas wajib diisi.');
      return;
    }

    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: type === 'CASH_IN' ? 'Catat Kas Masuk (Cash In)?' : 'Catat Kas Keluar (Cash Out)?',
      html: `
        <div class="text-xs space-y-2 text-left">
          <p><strong>Nominal:</strong> ${formatRupiah(numAmount)}</p>
          <p><strong>Alasan:</strong> ${reason.trim()}</p>
          <p class="text-stone-400 text-[11px]">* Transaksi ini akan langsung memengaruhi perhitungan Expected Cash laci kasir.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      confirmButtonText: 'Ya, Simpan Arus Kas',
      cancelButtonText: 'Batal',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Mencatat arus kas...');
        const res = await addCashMovement({
          type,
          amount: numAmount,
          reason: reason.trim(),
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success(
          `${type === 'CASH_IN' ? 'Kas Masuk' : 'Kas Keluar'} sebesar ${formatRupiah(numAmount)} berhasil dicatat!`,
          { id: toastId }
        );
        setAmount('');
        setReason('');
        loadShift();
      });
    }
  };

  const addQuickAmount = (val) => {
    const curr = parseFloat(amount) || 0;
    setAmount((curr + val).toString());
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-stone-500 text-xs">
        Memuat status shift kasir...
      </div>
    );
  }

  if (!shiftData) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          Anda belum membuka shift kasir hari ini. Silakan buka shift terlebih dahulu untuk mencatat arus kas manual.
        </div>
        <Link
          href="/dashboard/pos/shift"
          className="inline-flex px-5 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950"
        >
          Buka Shift Kasir Sekarang &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/dashboard/pos" className="hover:text-amber-400 transition-colors">
              &larr; Layar Kasir POS
            </Link>
            <span>/</span>
            <Link href="/dashboard/pos/shift" className="hover:text-amber-400 transition-colors">
              Shift Kasir
            </Link>
          </div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Arus Kas Manual (Cash In / Cash Out)
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Catat kas masuk tambahan (modal) atau kas keluar operasional toko (beli es batu, gas, galon, dll.).
          </p>
        </div>

        <Link
          href="/dashboard/pos"
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-semibold border border-stone-700 transition-all flex items-center gap-2"
        >
          Kembali ke Kasir
        </Link>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Modal Awal Kasir</p>
          <p className="text-base font-bold font-mono text-stone-200 mt-1">
            {formatRupiah(shiftData.openingCash)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Penjualan Tunai (Cash)</p>
          <p className="text-base font-bold font-mono text-amber-300 mt-1">
            {formatRupiah(shiftData.cashSales)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-emerald-900/30">
          <p className="text-[11px] font-semibold text-emerald-400">Total Kas Masuk (+)</p>
          <p className="text-base font-bold font-mono text-emerald-300 mt-1">
            + {formatRupiah(shiftData.cashIn)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-rose-900/30">
          <p className="text-[11px] font-semibold text-rose-400">Total Kas Keluar (-)</p>
          <p className="text-base font-bold font-mono text-rose-300 mt-1">
            - {formatRupiah(shiftData.cashOut)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[11px] font-semibold text-amber-400">Expected Cash Laci</p>
          <p className="text-lg font-extrabold font-mono text-amber-200 mt-1">
            {formatRupiah(shiftData.expectedCash)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Input Arus Kas (1 Col) */}
        <div className="space-y-4">
          <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h2 className="text-sm font-bold text-amber-50">Form Catat Kas Manual</h2>

            {/* Type Selector (CASH_IN vs CASH_OUT) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-950/80 border border-stone-800">
              <button
                type="button"
                onClick={() => setType('CASH_OUT')}
                className={cn(
                  'py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  type === 'CASH_OUT'
                    ? 'bg-rose-900/60 text-rose-300 border border-rose-800/60 shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                )}
              >
                <span className="text-sm font-extrabold">&darr;</span> Kas Keluar (Out)
              </button>

              <button
                type="button"
                onClick={() => setType('CASH_IN')}
                className={cn(
                  'py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  type === 'CASH_IN'
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                )}
              >
                <span className="text-sm font-extrabold">&uarr;</span> Kas Masuk (In)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nominal Input */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Nominal Uang Kas (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-stone-400 font-mono font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isPending}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                {/* Quick denomination buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[10000, 20000, 50000, 100000, 200000, 500000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => addQuickAmount(v)}
                      className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[10px] font-mono font-semibold text-stone-300 hover:text-white transition-colors"
                    >
                      +{v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="px-2 py-1 rounded-lg bg-rose-950/40 text-rose-300 text-[10px] font-semibold"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Reason / Alasan */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Keterangan / Alasan *
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    type === 'CASH_OUT'
                      ? 'Contoh: Beli es batu kristal 2 bal, beli gas elpiji 3kg, beli plastik take-away...'
                      : 'Contoh: Tambah uang kembalian dari brankas, setoran modal...'
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'w-full py-3 text-white rounded-xl text-xs font-bold shadow-lg transition-all disabled:opacity-50',
                  type === 'CASH_OUT'
                    ? 'bg-linear-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 shadow-rose-950'
                    : 'bg-linear-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-950'
                )}
              >
                {isPending
                  ? 'Menyimpan Arus Kas...'
                  : type === 'CASH_OUT'
                  ? 'Simpan Kas Keluar (-)'
                  : 'Simpan Kas Masuk (+)'}
              </button>
            </form>
          </div>
        </div>

        {/* Tabel Riwayat Arus Kas Shift Ini (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-stone-900/70 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-amber-50">
                  Riwayat Arus Kas Shift Saat Ini
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Shift dimulai: {new Date(shiftData.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; Kasir: {shiftData.user?.name}
                </p>
              </div>

              <button
                onClick={loadShift}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Waktu</th>
                    <th className="py-3 px-4 font-semibold">Tipe</th>
                    <th className="py-3 px-4 font-semibold">Nominal</th>
                    <th className="py-3 px-4 font-semibold">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono">
                  {shiftData.cashMovements?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-500 font-sans text-xs">
                        Belum ada catatan kas masuk/keluar manual pada shift ini.
                      </td>
                    </tr>
                  ) : (
                    shiftData.cashMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-stone-800/30 transition-colors font-sans">
                        <td className="py-3 px-4 font-mono text-stone-400 text-[11px]">
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                              m.type === 'CASH_IN'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            )}
                          >
                            {m.type === 'CASH_IN' ? '+ CASH IN' : '- CASH OUT'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={m.type === 'CASH_IN' ? 'text-emerald-300' : 'text-rose-300'}>
                            {m.type === 'CASH_IN' ? '+' : '-'} {formatRupiah(m.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-300 font-sans text-xs">
                          {m.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
