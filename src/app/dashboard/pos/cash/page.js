'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getCurrentShift, addCashMovement } from '@/app/actions/shift';
import { uploadSupabaseStorageFile } from '@/app/actions/storage';
import { formatRupiah, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { CASH_OUT_CATEGORIES } from '@/components/pos/CashOutModal';
import { useRef } from 'react';

export default function PosCashMovementPage() {
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('CASH_OUT'); // 'CASH_IN' | 'CASH_OUT'
  const [category, setCategory] = useState('BAHAN_BAKU_DARURAT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef(null);

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

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto nota maksimal 5MB.');
      return;
    }

    setIsUploadingReceipt(true);
    const toastId = toast.loading('Mengunggah foto nota...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'store-assets');

      const res = await uploadSupabaseStorageFile(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        setReceiptUrl(res.file.publicUrl);
        toast.success('Foto nota berhasil dilampirkan!', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah foto nota.', { id: toastId });
    } finally {
      setIsUploadingReceipt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

    if (type === 'CASH_OUT' && !category) {
      toast.error('Kategori pengeluaran kas keluar wajib dipilih.');
      return;
    }

    const currentDrawerCash = shiftData ? Number(shiftData.expectedCash || 0) : 0;
    if (type === 'CASH_OUT' && numAmount > currentDrawerCash) {
      toast.error(
        `Nominal kas keluar (${formatRupiah(numAmount)}) melebihi estimasi saldo kas di laci (${formatRupiah(Math.max(0, currentDrawerCash))}).`
      );
      return;
    }

    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: type === 'CASH_IN' ? 'Catat Kas Masuk (Cash In)?' : 'Catat Kas Keluar (Cash Out)?',
      html: `
        <div class="text-xs space-y-2 text-left font-sans text-slate-700">
          <p><strong>Nominal:</strong> ${formatRupiah(numAmount)}</p>
          <p><strong>Alasan:</strong> ${reason.trim()}</p>
          <p class="text-slate-400 text-[11px]">* Transaksi ini akan langsung memengaruhi saldo kas di laci kasir.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: type === 'CASH_IN' ? '#059669' : '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Simpan Arus Kas',
      cancelButtonText: 'Batal',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Mencatat arus kas...');
        const res = await addCashMovement({
          shiftId: shiftData?.id,
          type,
          amount: numAmount,
          category: type === 'CASH_OUT' ? category : null,
          reason: reason.trim(),
          receiptUrl: receiptUrl || null,
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
        setReceiptUrl('');
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
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat status shift kasir...
      </div>
    );
  }

  if (!shiftData) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-900">Tidak Ada Shift Aktif</h2>
        <p className="text-xs text-slate-500">
          Anda harus membuka Shift Kasir terlebih dahulu di layar POS sebelum dapat mencatat arus kas masuk/keluar.
        </p>
        <Link
          href="/dashboard/pos"
          className="inline-flex px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
        >
          Buka Layar POS Kasir &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/pos" className="hover:text-emerald-700 font-semibold transition-colors">
              &larr; Kembali ke Layar Kasir (POS)
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Arus Kas Manual (Cash In / Out)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catat pengeluaran tunai darurat (beli es, gas, kantong kresek) atau penambahan modal kembalian.
          </p>
        </div>

        {/* Shift Badge Indicator */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-xs">
            <p className="font-bold text-slate-900">Shift #{shiftData.id.slice(-6).toUpperCase()}</p>
            <p className="text-slate-500 font-mono text-[10px]">
              Kas di Laci: <strong className="text-emerald-700">{formatRupiah(shiftData.expectedCash)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ─── GRID LAYOUT ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form Input Kas (1 Col) */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Formulir Arus Kas
          </h2>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setType('CASH_OUT')}
              className={cn(
                'py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                type === 'CASH_OUT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span className="text-sm font-extrabold">&darr;</span> Kas Keluar (Out)
            </button>

            <button
              type="button"
              onClick={() => setType('CASH_IN')}
              className={cn(
                'py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                type === 'CASH_IN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span className="text-sm font-extrabold">&uarr;</span> Kas Masuk (In)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pilihan Kategori (Khusus CASH_OUT) */}
            {type === 'CASH_OUT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori Pengeluaran *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CASH_OUT_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2',
                          isSelected
                            ? 'border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        )}
                      >
                        <span className="text-base shrink-0">{cat.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight">{cat.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cat.subLabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nominal Input */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Nominal Uang Kas (Rp) *
              </label>
              <CurrencyInput
                placeholder="0"
                value={amount}
                onChange={(val) => setAmount(val)}
                disabled={isPending}
                required
              />

              {/* Quick buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[10000, 20000, 50000, 100000, 200000, 500000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => addQuickAmount(v)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-mono font-semibold text-slate-700 transition-colors"
                  >
                    +{v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-semibold"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Keterangan / Alasan *
              </label>
              <textarea
                rows={2}
                placeholder={
                  type === 'CASH_OUT'
                    ? 'Contoh: Beli es batu kristal 2 bal di warung sebelah, beli lakban...'
                    : 'Contoh: Tambah uang kembalian dari brankas, setoran modal...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Lampiran Foto Nota (Opsional) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Lampiran Foto Nota (Opsional)
              </label>
              {receiptUrl ? (
                <div className="flex items-center gap-3 p-2 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <img src={receiptUrl} alt="Nota" className="w-10 h-10 rounded-lg object-cover border" />
                  <span className="text-xs text-emerald-800 font-semibold truncate flex-1">Foto nota terlampir</span>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl('')}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 text-xs"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    disabled={isUploadingReceipt || isPending}
                    className="hidden"
                    id="cash-receipt-file"
                  />
                  <label
                    htmlFor="cash-receipt-file"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 cursor-pointer"
                  >
                    {isUploadingReceipt ? 'Mengunggah...' : '📷 Upload Foto Nota / Struk'}
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'w-full py-2.5 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer',
                type === 'CASH_OUT'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
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

        {/* Tabel Riwayat Arus Kas Shift Ini (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Riwayat Arus Kas Shift Saat Ini
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shift dimulai: {new Date(shiftData.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; Kasir: {shiftData.user?.name}
                </p>
              </div>

              <button
                onClick={loadShift}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs cursor-pointer"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Tipe & Kategori</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                    <th className="py-3 px-4">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {shiftData.cashMovements?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-sans text-xs">
                        Belum ada pergerakan kas manual pada shift ini.
                      </td>
                    </tr>
                  ) : (
                    shiftData.cashMovements?.map((m) => {
                      const isOut = m.type === 'CASH_OUT';
                      const catObj = CASH_OUT_CATEGORIES.find((c) => c.id === m.category);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                          <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                            {new Date(m.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                  isOut
                                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                )}
                              >
                                {isOut ? 'CASH OUT' : 'CASH IN'}
                              </span>
                              {isOut && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <span>{catObj?.icon || '📝'}</span>
                                  <span>{catObj?.label || m.category || 'Lain-lain'}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className={cn(
                              'py-3 px-4 font-mono font-bold text-right text-xs',
                              isOut ? 'text-rose-600' : 'text-emerald-700'
                            )}
                          >
                            {isOut ? '-' : '+'}{formatRupiah(m.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-700 text-xs">
                            <div>
                              <p className="font-medium text-slate-800">{m.reason}</p>
                              {m.receiptUrl && (
                                <a
                                  href={m.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-emerald-600 underline font-semibold mt-0.5 inline-block"
                                >
                                  📎 Lihat Nota Belanja
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
