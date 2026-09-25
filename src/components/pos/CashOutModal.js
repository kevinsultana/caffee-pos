'use client';

import { useState, useRef, useTransition } from 'react';
import toast from 'react-hot-toast';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { addCashMovement } from '@/app/actions/shift';
import { uploadSupabaseStorageFile } from '@/app/actions/storage';
import { formatRupiah, cn } from '@/lib/utils';

export const CASH_OUT_CATEGORIES = [
  {
    id: 'BAHAN_BAKU_DARURAT',
    label: 'Bahan Baku Darurat',
    subLabel: 'Es batu, susu, galon, gas LPG, bumbu darurat',
    icon: '🧊',
  },
  {
    id: 'KEPERLUAN_TOKO',
    label: 'Keperluan Toko',
    subLabel: 'Sapu, lakban, plastik sampah, tisu, sabun cuci',
    icon: '🧹',
  },
  {
    id: 'SETOR_OWNER',
    label: 'Tarik Tunai / Setor ke Owner',
    subLabel: 'Serah terima uang fisik kasir ke owner di tengah shift',
    icon: '💼',
  },
  {
    id: 'LAINNYA',
    label: 'Lain-lain',
    subLabel: 'Pengeluaran kas kecil kasir lainnya',
    icon: '📝',
  },
];

export default function CashOutModal({
  isOpen,
  onClose,
  onSuccess,
  shift,
  initialType = 'CASH_OUT',
}) {
  const [movementType, setMovementType] = useState(initialType);
  const [category, setCategory] = useState('BAHAN_BAKU_DARURAT');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const currentDrawerCash = shift ? Number(shift.expectedCash || 0) : 0;
  const isOverBalance = movementType === 'CASH_OUT' && numAmount > currentDrawerCash;

  // ── Handle file upload nota ────────────────────────────────────────────────
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

  // ── Handle Submit Mutasi Kas ───────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    if (numAmount <= 0) {
      toast.error('Nominal mutasi kas harus lebih dari Rp 0.');
      return;
    }

    if (movementType === 'CASH_OUT' && !category) {
      toast.error('Pilih kategori kas keluar.');
      return;
    }

    if (isOverBalance) {
      toast.error(
        `Nominal kas keluar (${formatRupiah(numAmount)}) melebihi estimasi saldo kas di laci (${formatRupiah(Math.max(0, currentDrawerCash))}).`
      );
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      toast.error('Keterangan / alasan mutasi kas wajib diisi minimal 3 karakter.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(
        movementType === 'CASH_IN' ? 'Mencatat kas masuk...' : 'Mencatat kas keluar...'
      );

      const res = await addCashMovement({
        shiftId: shift?.id,
        type: movementType,
        amount: numAmount,
        category: movementType === 'CASH_OUT' ? category : null,
        reason: reason.trim(),
        receiptUrl: receiptUrl || null,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success(
        movementType === 'CASH_IN'
          ? `Kas Masuk sebesar ${formatRupiah(numAmount)} berhasil dicatat!`
          : `Kas Keluar sebesar ${formatRupiah(numAmount)} berhasil dicatat!`,
        { id: toastId }
      );

      // Reset state
      setAmount(0);
      setReason('');
      setReceiptUrl('');
      setCategory('BAHAN_BAKU_DARURAT');

      onClose();
      if (onSuccess) onSuccess();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-xs border',
                movementType === 'CASH_OUT'
                  ? 'bg-rose-50 text-rose-600 border-rose-100'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              )}
            >
              {movementType === 'CASH_OUT' ? '💸' : '📥'}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {movementType === 'CASH_OUT' ? 'Kas Keluar Kasir (Cash Out)' : 'Kas Masuk Kasir (Cash In)'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pencatatan mutasi kas fisik laci selama shift berjalan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending || isUploadingReceipt}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Movement Type Toggle */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Jenis Pergerakan Kas
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setMovementType('CASH_OUT')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  movementType === 'CASH_OUT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <span>💸</span>
                <span>Kas Keluar (Cash Out)</span>
              </button>
              <button
                type="button"
                onClick={() => setMovementType('CASH_IN')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  movementType === 'CASH_IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <span>📥</span>
                <span>Kas Masuk (Cash In)</span>
              </button>
            </div>
          </div>

          {/* Current Drawer Cash Status */}
          {shift && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 text-[11px]">Saldo Kas Fisik Laci:</span>
              <span className="font-bold text-slate-900">{formatRupiah(currentDrawerCash)}</span>
            </div>
          )}

          {/* Pilihan Kategori (Khusus CASH_OUT) */}
          {movementType === 'CASH_OUT' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori Pengeluaran <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CASH_OUT_CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5',
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <span className="text-base shrink-0 mt-0.5">{cat.icon}</span>
                      <div className="min-w-0">
                        <p className={cn('text-xs font-bold leading-tight', isSelected ? 'text-rose-900' : 'text-slate-800')}>
                          {cat.label}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-normal">
                          {cat.subLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nominal Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Nominal Uang (Rp) <span className="text-rose-500">*</span>
              </label>
              {isOverBalance && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Melebihi saldo laci kasir!
                </span>
              )}
            </div>
            <CurrencyInput
              placeholder="0"
              value={amount}
              onChange={(val) => setAmount(val)}
              disabled={isPending}
              required
            />
            {/* Quick Amounts */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[10000, 20000, 50000, 100000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(numAmount + quick)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  +{formatRupiah(quick)}
                </button>
              ))}
              {numAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(0)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-auto"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Keterangan / Alasan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Keterangan / Alasan Keperluan <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Beli es batu kristal 2 kantong di warung sebelah..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              required
            />
          </div>

          {/* Lampirkan Foto Nota (Opsional) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lampirkan Foto Nota / Struk Belanja (Opsional)
            </label>

            {receiptUrl ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <img
                  src={receiptUrl}
                  alt="Nota belanja"
                  className="w-12 h-12 rounded-lg object-cover border border-emerald-300"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-800">Foto Nota Terlampir</p>
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-600 underline truncate block"
                  >
                    Lihat nota ukuran penuh
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors"
                  title="Hapus lampiran"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  disabled={isUploadingReceipt || isPending}
                  className="hidden"
                  id="receipt-file-upload"
                />
                <label
                  htmlFor="receipt-file-upload"
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/30 transition-all cursor-pointer',
                    isUploadingReceipt && 'opacity-50 pointer-events-none'
                  )}
                >
                  {isUploadingReceipt ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                      <span>Mengunggah foto...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      <span>Upload Foto Struk / Nota</span>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Peringatan Saldo Fisik Laci */}
          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
            <span className="text-amber-600 text-sm mt-0.5">⚠️</span>
            <span className="leading-relaxed">
              Pengeluaran ini memotong saldo fisik laci kasir secara langsung. Untuk belanja aset besar atau biaya bulanan usaha, gunakan menu khusus Catatan Pengeluaran Owner.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending || isUploadingReceipt}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || isUploadingReceipt || numAmount <= 0 || isOverBalance}
              className={cn(
                'px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50',
                movementType === 'CASH_OUT'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span>{movementType === 'CASH_OUT' ? 'Simpan Kas Keluar (-)' : 'Simpan Kas Masuk (+)'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
