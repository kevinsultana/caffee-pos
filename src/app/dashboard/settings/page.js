'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getStoreSettings,
  updateStoreSettings,
  uploadStoreLogo,
  removeStoreLogo,
  uploadReceiptLogo,
  removeReceiptLogo,
  uploadQrisImage,
  removeQrisImage,
} from '@/app/actions/settings';
import { cn } from '@/lib/utils';
import { useBluetooth, BLE_PROFILES, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';

// ── Sub-komponen: Toggle Switch ───────────────────────────────────────────────
function Toggle({ id, checked, onChange, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer',
        checked ? 'bg-emerald-600' : 'bg-slate-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 absolute top-0.5 left-0.5',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ── Sub-komponen: Rate Input ──────────────────────────────────────────────────
function RateInput({ id, label, value, onChange, disabled, suffix = '%', min = 0, max = 100, step = 0.01 }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="w-full pr-10 pl-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono font-bold">
          {suffix}
        </span>
      </div>
    </div>
  );
}

// ── Sub-komponen: Section Card ────────────────────────────────────────────────
function SettingsCard({ title, description, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Sub-komponen: Align Selector ──────────────────────────────────────────────
function AlignSelector({ id, value, onChange, disabled }) {
  const options = [
    {
      id: 'LEFT',
      label: 'Kiri',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h16.5" />
        </svg>
      ),
    },
    {
      id: 'CENTER',
      label: 'Tengah',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5m-13.5 5.25h16.5" />
        </svg>
      ),
    },
    {
      id: 'RIGHT',
      label: 'Kanan',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5m-16.5 5.25h16.5" />
        </svg>
      ),
    },
  ];

  return (
    <div id={id} className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50',
            value === opt.id
              ? 'bg-white text-emerald-700 shadow-2xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Sub-komponen: Live Receipt Preview Card ──────────────────────────────────
function ReceiptPreviewCard({
  storeName,
  logoUrl,
  receiptLogoUrl,
  printerWidth,
  receiptShowLogo,
  receiptShowStoreName = true,
  receiptHeader,
  receiptHeaderAlign,
  receiptHeaderBold,
  receiptFooter,
  receiptFooterAlign,
  receiptFooterBold,
  onTestPrint,
  isTestPrinting,
  btConnected,
  btDeviceName,
}) {
  const is80 = printerWidth === 80;
  const cols = is80 ? 48 : 32;
  const sep = '-'.repeat(cols);
  const activeLogo = receiptLogoUrl || logoUrl;

  const getAlignClass = (align) => {
    if (align === 'LEFT') return 'text-left';
    if (align === 'RIGHT') return 'text-right';
    return 'text-center';
  };

  return (
    <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col items-center shadow-2xs">
      <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview Struk
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
            {printerWidth}mm
          </span>
        </div>

        <button
          type="button"
          onClick={onTestPrint}
          disabled={!btConnected || isTestPrinting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title={btConnected ? 'Test print ke printer Bluetooth' : 'Printer belum terhubung'}
        >
          {isTestPrinting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Mencetak...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              <span>Test Print</span>
            </>
          )}
        </button>
      </div>

      {/* Container Kertas Struk Termal */}
      <div
        className={cn(
          'w-full bg-[#fcfcfa] text-stone-900 font-mono text-[11px] leading-tight px-4 py-6 rounded-md shadow-md border border-stone-200 transition-all relative',
          is80 ? 'max-w-85' : 'max-w-67.5'
        )}
      >
        {/* Paper Tear Effect Top */}
        <div className="absolute -top-1 left-0 right-0 h-1 overflow-hidden flex justify-between opacity-20 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="inline-block w-2 h-2 bg-stone-400 rotate-45 transform origin-bottom" />
          ))}
        </div>

        {/* 1. Logo Toko */}
        {receiptShowLogo && activeLogo && (
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLogo}
              alt="Logo Struk"
              className="max-h-12 max-w-30 object-contain filter grayscale contrast-125"
            />
          </div>
        )}

        {/* 2. Nama Toko */}
        {receiptShowStoreName && (
          <div className="text-center font-black text-sm uppercase tracking-wider text-black">
            {storeName || 'SCHAW CAFE'}
          </div>
        )}

        {/* 3. Sub-header Kustom */}
        {receiptHeader && receiptHeader.trim() ? (
          <div
            className={cn(
              'text-[10px] text-stone-700 whitespace-pre-line my-1',
              getAlignClass(receiptHeaderAlign),
              receiptHeaderBold && 'font-bold text-stone-950'
            )}
          >
            {receiptHeader}
          </div>
        ) : (
          <div className="text-center text-[10px] text-stone-500 my-0.5">
            Cabang MAIN
          </div>
        )}

        {/* Separator */}
        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">
          {sep}
        </div>

        {/* Meta Transaksi Mock */}
        <div className="text-[10px] space-y-0.5 text-stone-600">
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>24/09/2026 17:00</span>
          </div>
          <div className="flex justify-between">
            <span>No. Order:</span>
            <span className="font-semibold text-stone-900">#ORD-1029</span>
          </div>
          <div className="flex justify-between">
            <span>Antrean:</span>
            <span className="font-bold text-stone-900">A-01</span>
          </div>
          <div className="flex justify-between">
            <span>Pesanan:</span>
            <span>Dine In (Di Tempat)</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span>Kasir Utama</span>
          </div>
          <div className="flex justify-between">
            <span>Pelanggan:</span>
            <span>Budi Santoso</span>
          </div>
        </div>

        {/* Separator */}
        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">
          {sep}
        </div>

        {/* Items Mock */}
        <div className="space-y-1 text-[10px]">
          <div>
            <div className="font-semibold text-stone-900">Kopi Susu Gula Aren</div>
            <div className="flex justify-between text-stone-600">
              <span>1x Rp 18.000</span>
              <span className="font-semibold text-stone-900">Rp 18.000</span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-stone-900">Croissant Butter</div>
            <div className="flex justify-between text-stone-600">
              <span>1x Rp 22.000</span>
              <span className="font-semibold text-stone-900">Rp 22.000</span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">
          {sep}
        </div>

        {/* Financial Mock */}
        <div className="text-[10px] space-y-0.5 text-stone-600">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>Rp 40.000</span>
          </div>
          <div className="flex justify-between font-bold text-xs text-black pt-1 border-t border-dashed border-stone-300">
            <span>TOTAL:</span>
            <span>Rp 40.000</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span>Metode Bayar:</span>
            <span className="font-semibold text-stone-800">CASH</span>
          </div>
          <div className="flex justify-between">
            <span>Uang Diterima:</span>
            <span>Rp 50.000</span>
          </div>
          <div className="flex justify-between">
            <span>Kembalian:</span>
            <span>Rp 10.000</span>
          </div>
        </div>

        {/* Separator */}
        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">
          {sep}
        </div>

        {/* 4. Footer Kustom */}
        {receiptFooter && receiptFooter.trim() ? (
          <div
            className={cn(
              'text-[10px] whitespace-pre-line text-stone-700 my-1.5',
              getAlignClass(receiptFooterAlign),
              receiptFooterBold && 'font-bold text-stone-950'
            )}
          >
            {receiptFooter}
          </div>
        ) : (
          <div className="text-center text-[10px] text-stone-600 space-y-0.5 my-1.5">
            <div>Terima kasih atas kunjungan Anda!</div>
            <div className="text-[9px] text-stone-500">Simpan struk sebagai bukti pembayaran.</div>
          </div>
        )}

        {/* Paper Tear Effect Bottom */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 overflow-hidden flex justify-between opacity-20 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="inline-block w-2 h-2 bg-stone-400 rotate-45 transform origin-top" />
          ))}
        </div>
      </div>

      {/* Info Status Bluetooth */}
      <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full', btConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
        <span>
          {btConnected
            ? `Printer Bluetooth Siap (${btDeviceName})`
            : 'Printer belum terhubung'}
        </span>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [isUploadingReceiptLogo, setIsUploadingReceiptLogo] = useState(false);
  const fileInputRef = useRef(null);
  const qrisFileInputRef = useRef(null);
  const receiptLogoFileInputRef = useRef(null);

  // Form state
  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [qrisImageUrl, setQrisImageUrl] = useState(null);
  const [printerWidth, setPrinterWidth] = useState(58);

  // Kustomisasi Struk Kasir
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);
  const [receiptLogoUrl, setReceiptLogoUrl] = useState(null);
  const [receiptShowStoreName, setReceiptShowStoreName] = useState(true);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptHeaderAlign, setReceiptHeaderAlign] = useState('CENTER');
  const [receiptHeaderBold, setReceiptHeaderBold] = useState(false);
  const [receiptFooter, setReceiptFooter] = useState(
    'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.'
  );
  const [receiptFooterAlign, setReceiptFooterAlign] = useState('CENTER');
  const [receiptFooterBold, setReceiptFooterBold] = useState(false);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxBaseIncludesServiceCharge, setTaxBaseIncludesServiceCharge] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [cashRoundingEnabled, setCashRoundingEnabled] = useState(false);
  const [cashRoundingUnit, setCashRoundingUnit] = useState(0);
  const [maxActiveShifts, setMaxActiveShifts] = useState(1);

  // ── Bluetooth Printer — dari Global Context (persists across navigations) ─
  const {
    btStatus,
    btDeviceName,
    btServiceUuid,
    btErrorMsg,
    connect: handleBtConnect,
    disconnect: handleBtDisconnect,
    printBytes,
    setBtServiceUuid,
  } = useBluetooth();
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // Load initial settings
  const loadData = async () => {
    const result = await getStoreSettings();
    if (result.error) {
      toast.error(result.error);
      setIsLoading(false);
      return;
    }
    const { settings, storeName: name, logoUrl: logo, qrisImageUrl: qris } = result.data;
    setStoreName(name || '');
    setLogoUrl(logo || null);
    setQrisImageUrl(qris || settings?.qrisImageUrl || null);
    if (settings) {
      setPrinterWidth(settings.printerWidth || 58);
      setReceiptShowLogo(settings.receiptShowLogo ?? true);
      setReceiptLogoUrl(settings.receiptLogoUrl || null);
      setReceiptShowStoreName(settings.receiptShowStoreName ?? true);
      setReceiptHeader(settings.receiptHeader || '');
      setReceiptHeaderAlign(settings.receiptHeaderAlign || 'CENTER');
      setReceiptHeaderBold(Boolean(settings.receiptHeaderBold));
      setReceiptFooter(
        settings.receiptFooter ??
        'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.'
      );
      setReceiptFooterAlign(settings.receiptFooterAlign || 'CENTER');
      setReceiptFooterBold(Boolean(settings.receiptFooterBold));
      setTaxEnabled(settings.taxEnabled ?? false);
      setTaxRate(settings.taxRate ?? 0);
      setTaxBaseIncludesServiceCharge(settings.taxBaseIncludesServiceCharge ?? false);
      setServiceChargeEnabled(settings.serviceChargeEnabled ?? false);
      setServiceChargeRate(settings.serviceChargeRate ?? 0);
      setCashRoundingEnabled(settings.cashRoundingEnabled ?? false);
      setCashRoundingUnit(settings.cashRoundingUnit ?? 0);
      setMaxActiveShifts(settings.maxActiveShifts ?? 1);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Logo Upload
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setIsUploadingLogo(true);
    const toastId = toast.loading('Mengunggah logo toko ke Supabase Storage...');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);

      const res = await uploadStoreLogo(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(res.message || 'Logo berhasil diperbarui!', { id: toastId });
        setLogoUrl(res.logoUrl);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah logo toko.', { id: toastId });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Remove Logo
  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    const toastId = toast.loading('Menghapus logo toko...');

    const res = await removeStoreLogo();
    if (res.error) {
      toast.error(res.error, { id: toastId });
    } else {
      toast.success('Logo toko berhasil dihapus.', { id: toastId });
      setLogoUrl(null);
    }
    setIsUploadingLogo(false);
  };

  // Handle QRIS Upload
  const handleQrisChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setIsUploadingQris(true);
    const toastId = toast.loading('Mengunggah barcode QRIS toko ke Supabase Storage...');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      formData.append('qris', file);

      const res = await uploadQrisImage(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(res.message || 'Barcode QRIS berhasil diperbarui!', { id: toastId });
        setQrisImageUrl(res.qrisImageUrl);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah gambar QRIS toko.', { id: toastId });
    } finally {
      setIsUploadingQris(false);
      if (qrisFileInputRef.current) {
        qrisFileInputRef.current.value = '';
      }
    }
  };

  // Handle Remove QRIS
  const handleRemoveQris = async () => {
    setIsUploadingQris(true);
    const toastId = toast.loading('Menghapus gambar QRIS toko...');

    const res = await removeQrisImage();
    if (res.error) {
      toast.error(res.error, { id: toastId });
    } else {
      toast.success('Gambar QRIS toko berhasil dihapus.', { id: toastId });
      setQrisImageUrl(null);
    }
    setIsUploadingQris(false);
  };

  // Handle Receipt Logo Upload
  const handleReceiptLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setIsUploadingReceiptLogo(true);
    const toastId = toast.loading('Mengunggah logo khusus struk ke Supabase Storage...');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      formData.append('receiptLogo', file);

      const res = await uploadReceiptLogo(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(res.message || 'Logo struk berhasil diperbarui!', { id: toastId });
        setReceiptLogoUrl(res.receiptLogoUrl);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah logo struk.', { id: toastId });
    } finally {
      setIsUploadingReceiptLogo(false);
      if (receiptLogoFileInputRef.current) {
        receiptLogoFileInputRef.current.value = '';
      }
    }
  };

  // Handle Remove Receipt Logo
  const handleRemoveReceiptLogo = async () => {
    setIsUploadingReceiptLogo(true);
    const toastId = toast.loading('Menghapus logo khusus struk...');

    const res = await removeReceiptLogo();
    if (res.error) {
      toast.error(res.error, { id: toastId });
    } else {
      toast.success('Logo struk berhasil dihapus.', { id: toastId });
      setReceiptLogoUrl(null);
    }
    setIsUploadingReceiptLogo(false);
  };

  // Handle Test Print — menggunakan context printBytes
  const handleTestPrint = async () => {
    if (btStatus !== 'connected') {
      toast.error('Belum terhubung ke printer Bluetooth.');
      return;
    }
    setIsTestPrinting(true);
    const toastId = toast.loading('Mengirim data ke printer...');
    try {
      // Buat objek order dummy untuk test print
      const testOrder = {
        orderNumber: 'TEST-001',
        queueNumber: 'A-00',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        customerNameSnapshot: 'Test Print',
        createdBy: { name: 'Kasir' },
        source: 'POS',
        items: [
          {
            productNameSnapshot: 'KONEKSI BLUETOOTH',
            variantNameSnapshot: null,
            quantity: 1,
            unitPrice: 0,
            subtotal: 0,
            notes: 'OK',
            promotionDiscount: 0,
          },
        ],
        productSubtotal: 0,
        promotionDiscount: 0,
        serviceChargeAmount: 0,
        serviceChargeRate: 0,
        taxAmount: 0,
        taxRate: 0,
        roundingAmount: 0,
        cashPayable: 0,
        grandTotal: 0,
        payment: { method: 'CASH', cashReceived: 0, changeAmount: 0 },
      };
      const storeInfo = {
        name: storeName || 'SCHAW CAFE',
        logoUrl: logoUrl || null,
        receiptLogoUrl: receiptLogoUrl || null,
        receiptShowStoreName,
        printerWidth,
        code: 'MAIN',
        receiptShowLogo,
        receiptHeader,
        receiptHeaderAlign,
        receiptHeaderBold,
        receiptFooter,
        receiptFooterAlign,
        receiptFooterBold,
      };
      const bytes = await buildReceiptBytes(testOrder, storeInfo, 'CUSTOMER');
      await printBytes(bytes);
      toast.success('Struk test berhasil dicetak!', { id: toastId });
    } catch (err) {
      toast.error('Gagal mencetak: ' + (err.message || 'Cek koneksi Bluetooth.'), { id: toastId });
    } finally {
      setIsTestPrinting(false);
    }
  };

  // Handle Save Settings
  const handleSave = () => {
    if (!storeName.trim()) {
      toast.error('Nama kafe/usaha tidak boleh kosong.');
      return;
    }

    startTransition(async () => {
      const result = await updateStoreSettings({
        storeName: storeName.trim(),
        logoUrl,
        receiptLogoUrl,
        receiptShowStoreName,
        receiptShowLogo,
        receiptHeader,
        receiptHeaderAlign,
        receiptHeaderBold,
        receiptFooter,
        receiptFooterAlign,
        receiptFooterBold,
        printerWidth,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
        maxActiveShifts: Math.max(1, parseInt(maxActiveShifts, 10) || 1),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Pengaturan toko berhasil diperbarui!');
        loadData();
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat konfigurasi toko...
      </div>
    );
  }

  const isSaving = isPending || isUploadingLogo || isUploadingQris || isUploadingReceiptLogo;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Pengaturan Toko & POS
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Konfigurasi identitas kafe, logo struk, printer termal, aturan pajak (PB1), biaya layanan, dan pembulatan kas.
        </p>
      </div>

      {/* ─── IDENTITAS & LOGO KAFE ────────────────────────────────────────── */}
      <SettingsCard
        title="Identitas & Logo Toko"
        description="Nama dan logo usaha yang tertera pada header nota fisik, dashboard, dan cetak struk kasir."
      >
        {/* Input Nama Toko */}
        <div>
          <label htmlFor="input-store-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nama Kafe / Usaha *
          </label>
          <input
            id="input-store-name"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            disabled={isSaving}
            placeholder="contoh: SCHAW CAFE"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            required
          />
        </div>

        {/* Upload Logo Toko */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Logo Toko (Supabase Storage)
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Logo Preview */}
            <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo Toko"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-2">
                  <svg className="w-6 h-6 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="text-[10px] text-slate-400 block mt-1 font-medium">No Logo</span>
                </div>
              )}
            </div>

            {/* Action Buttons & Note */}
            <div className="space-y-2 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                id="file-store-logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                disabled={isSaving}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  {logoUrl ? 'Ganti Logo' : 'Pilih & Upload Logo'}
                </button>

                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                Format didukung: <strong>PNG, JPG, WEBP, SVG</strong> (Maksimal 5MB). Logo akan otomatis tersimpan di Supabase Storage bucket <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-[10px]">store-assets</code>.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ─── OPERASIONAL & LIMIT SHIFT KASIR ─────────────────────────────── */}
      <SettingsCard
        title="Operasional & Limit Shift Kasir"
        description="Atur batasan jumlah shift aktif yang boleh berjalan bersamaan di toko ini untuk mencegah double shift dan tumpang tindih kasir."
      >
        <div className="max-w-md space-y-3">
          <div>
            <label htmlFor="input-max-active-shifts" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Maksimal Shift Aktif Bersamaan *
            </label>
            <div className="flex items-center gap-3">
              <input
                id="input-max-active-shifts"
                type="number"
                min="1"
                max="50"
                value={maxActiveShifts}
                onChange={(e) => setMaxActiveShifts(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={isSaving}
                className="w-28 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center"
                required
              />
              <span className="text-xs text-slate-600 font-semibold">Shift Aktif</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Proteksi Anti Double-Shift
            </p>
            <p>
              Bila diatur <strong>1</strong> (default), hanya 1 sesi kasir yang diperbolehkan aktif pada satu waktu. Kasir lain tidak dapat membuka shift baru sebelum shift yang sedang berjalan ditutup.
            </p>
            <p className="text-[10px] text-slate-400">
              Ubah ke angka lebih besar (misal 2 atau 3) hanya jika toko Anda memiliki beberapa terminal mesin kasir fisik yang beroperasi serentak.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* ─── BARCODE & GAMBAR QRIS TOKO ─────────────────────────────────── */}
      <SettingsCard
        title="Barcode & Gambar QRIS Toko (Kasir POS)"
        description="Upload barcode QRIS usaha Anda (BCA, Mandiri, GoPay, DANA, OVO, ShopeePay, dll). Gambar ini akan langsung muncul di layar modal pembayaran kasir POS saat memilih metode bayar QRIS agar pelanggan dapat langsung melakukan pemindaian (scan)."
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* QRIS Preview */}
          <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-2xs">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisImageUrl}
                alt="Barcode QRIS Toko"
                className="w-full h-full object-contain p-2 bg-white"
              />
            ) : (
              <div className="text-center p-3">
                <svg className="w-8 h-8 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM16.5 13.5v1.5m0 3v1.5m3-3h1.5m-6 0h1.5m3-3h-3v3h3v-3z" />
                </svg>
                <span className="text-[10px] text-slate-400 block mt-1 font-medium">Belum Ada QRIS</span>
              </div>
            )}
          </div>

          {/* Action Buttons & Note */}
          <div className="space-y-2.5 flex-1">
            <input
              ref={qrisFileInputRef}
              type="file"
              id="file-store-qris"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleQrisChange}
              disabled={isSaving}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => qrisFileInputRef.current?.click()}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {qrisImageUrl ? 'Ganti Barcode QRIS' : 'Pilih & Upload Barcode QRIS'}
              </button>

              {qrisImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveQris}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hapus Barcode QRIS
                </button>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Terintegrasi langsung dengan Popup Pembayaran Kasir POS
              </p>
              <p>
                Gunakan gambar barcode QRIS dengan rasio persegi (1:1) dan resolusi tajam agar mudah dan cepat di-scan oleh kamera smartphone pelanggan di meja kasir.
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Format didukung: <strong>PNG, JPG, WEBP, SVG</strong> (Maksimal 5MB).
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ─── PENGATURAN PRINTER STRUK ─────────────────────────────────────── */}
      <SettingsCard
        title="Pengaturan Printer Struk Kasir"
        description="Pilih format lebar kertas printer termal saat kasir mencetak nota struk penjualan."
      >
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Ukuran Kertas Printer (Paper Width) *
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opsi 58mm */}
            <div
              onClick={() => setPrinterWidth(58)}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2',
                printerWidth === 58
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    printerWidth === 58 ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                  )}>
                    {printerWidth === 58 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs font-bold text-slate-900">58mm (Printer Kasir Kecil)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  32 Col
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pl-6">
                Lebar struk standar 58mm (32 karakter/baris). Cocok untuk printer Bluetooth mini portabel atau printer saku kasir.
              </p>
            </div>

            {/* Opsi 80mm */}
            <div
              onClick={() => setPrinterWidth(80)}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2',
                printerWidth === 80
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    printerWidth === 80 ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                  )}>
                    {printerWidth === 80 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs font-bold text-slate-900">80mm (Printer Struk Standar)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  48 Col
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pl-6">
                Lebar struk standar 80mm (48 karakter/baris). Cocok untuk printer kasir desktop, USB, Ethernet LAN / Auto-Cutter.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ─── KUSTOMISASI STRUK KASIR & LIVE PREVIEW ────────────────────────── */}
      <SettingsCard
        title="Kustomisasi Struk Kasir & Live Preview"
        description="Atur tampilan header, logo, teks tambahan, footer, perataan teks (alignment), serta format tebal (bold) pada nota struk fisik yang dicetak oleh kasir."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Kolom Kiri: Form Kustomisasi Header & Footer (7 Kolom) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. BAGIAN HEADER STRUK */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Header Struk (Bagian Atas)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Nama toko, logo, dan alamat/kontak usaha di bagian atas struk
                  </p>
                </div>
              </div>

              {/* Toggle Tampilkan Logo & Upload Logo Struk */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Tampilkan Logo di Struk</p>
                    <p className="text-[11px] text-slate-500">
                      Cetak gambar logo di bagian atas struk kasir
                    </p>
                  </div>
                  <Toggle
                    id="toggle-receipt-logo"
                    checked={receiptShowLogo}
                    onChange={setReceiptShowLogo}
                    disabled={isSaving}
                  />
                </div>

                {receiptShowLogo && (
                  <div className="pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {receiptLogoUrl || logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={receiptLogoUrl || logoUrl}
                            alt="Logo Struk"
                            className="w-full h-full object-contain p-1 filter grayscale contrast-125"
                          />
                        ) : (
                          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800">
                            {receiptLogoUrl ? 'Foto/Logo Khusus Struk' : logoUrl ? 'Menggunakan Logo Toko' : 'Belum Ada Foto Struk'}
                          </p>
                          {receiptLogoUrl && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                              Khusus Struk
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {receiptLogoUrl
                            ? 'Foto khusus struk aktif digunakan pada thermal printer.'
                            : logoUrl
                              ? 'Default menggunakan logo toko. Anda dapat mengunggah foto khusus receipt di sini.'
                              : 'Unggah gambar hitam-putih / kontras tinggi agar tajam pada printer thermal.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <input
                        ref={receiptLogoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleReceiptLogoChange}
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => receiptLogoFileInputRef.current?.click()}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingReceiptLogo ? 'Mengunggah...' : receiptLogoUrl ? 'Ganti Foto Struk' : 'Upload Foto Struk'}
                      </button>
                      {receiptLogoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveReceiptLogo}
                          disabled={isSaving}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                          title="Hapus foto khusus struk (kembali ke default)"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle Cetak Nama Kafe / Usaha (True/False) */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <p className="text-xs font-bold text-slate-800">Cetak Nama Kafe / Usaha</p>
                  <p className="text-[11px] text-slate-500">
                    Jika dinonaktifkan, teks nama kafe (&quot;{storeName || 'SCHAW CAFE'}&quot;) tidak akan dicetak.
                  </p>
                </div>
                <Toggle
                  id="toggle-receipt-show-store-name"
                  checked={receiptShowStoreName}
                  onChange={setReceiptShowStoreName}
                  disabled={isSaving}
                />
              </div>

              {/* Teks Sub-Header */}
              <div>
                <label
                  htmlFor="input-receipt-header"
                  className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
                >
                  Teks Header Tambahan (Sub-Header)
                </label>
                <textarea
                  id="input-receipt-header"
                  rows={3}
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  disabled={isSaving}
                  placeholder="Contoh: Jl. Sudirman No. 12, Jakarta&#10;Telp/WA: 0812-3456-7890&#10;Instagram: @schawcafe"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bisa multi-baris (gunakan Enter). Jika dikosongkan, default cabang &quot;Cabang MAIN&quot; akan digunakan.
                </p>
              </div>

              {/* Formatting Sub-Header: Align & Bold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Perataan (Alignment)
                  </label>
                  <AlignSelector
                    id="select-header-align"
                    value={receiptHeaderAlign}
                    onChange={setReceiptHeaderAlign}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-6">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Teks Tebal (Bold)</span>
                    <span className="text-[10px] text-slate-400">Gunakan font bold ESC/POS</span>
                  </div>
                  <Toggle
                    id="toggle-header-bold"
                    checked={receiptHeaderBold}
                    onChange={setReceiptHeaderBold}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* 2. BAGIAN FOOTER STRUK */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Footer Struk (Bagian Bawah)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pesan penutup, ucapan terima kasih, info wifi, atau akun sosmed
                  </p>
                </div>
              </div>

              {/* Teks Footer */}
              <div>
                <label
                  htmlFor="input-receipt-footer"
                  className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
                >
                  Teks Footer Struk
                </label>
                <textarea
                  id="input-receipt-footer"
                  rows={3}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  disabled={isSaving}
                  placeholder="Contoh: Terima kasih atas kunjungan Anda!&#10;Wifi: kopienak / pass: nikmat123&#10;Simpan struk sebagai bukti pembayaran yang sah."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bisa multi-baris (gunakan Enter). Bebas disesuaikan dengan kebutuhan promosi / info kafe Anda.
                </p>
              </div>

              {/* Formatting Footer: Align & Bold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Perataan (Alignment)
                  </label>
                  <AlignSelector
                    id="select-footer-align"
                    value={receiptFooterAlign}
                    onChange={setReceiptFooterAlign}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-6">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Teks Tebal (Bold)</span>
                    <span className="text-[10px] text-slate-400">Gunakan font bold ESC/POS</span>
                  </div>
                  <Toggle
                    id="toggle-footer-bold"
                    checked={receiptFooterBold}
                    onChange={setReceiptFooterBold}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Live Receipt Preview (5 Kolom) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6">
            <ReceiptPreviewCard
              storeName={storeName}
              logoUrl={logoUrl}
              receiptLogoUrl={receiptLogoUrl}
              printerWidth={printerWidth}
              receiptShowLogo={receiptShowLogo}
              receiptShowStoreName={receiptShowStoreName}
              receiptHeader={receiptHeader}
              receiptHeaderAlign={receiptHeaderAlign}
              receiptHeaderBold={receiptHeaderBold}
              receiptFooter={receiptFooter}
              receiptFooterAlign={receiptFooterAlign}
              receiptFooterBold={receiptFooterBold}
              onTestPrint={handleTestPrint}
              isTestPrinting={isTestPrinting}
              btConnected={btStatus === 'connected'}
              btDeviceName={btDeviceName}
            />
          </div>
        </div>
      </SettingsCard>

      {/* ─── BLUETOOTH PRINTER ────────────────────────────────────────────── */}
      <SettingsCard
        title="Koneksi Bluetooth Printer Termal"
        description="Hubungkan langsung printer thermal Bluetooth via Web Bluetooth API (BLE). Tersedia di Google Chrome & Microsoft Edge."
      >
        {/* Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {btStatus === 'connected' && (
              <>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  Terhubung ke <span className="font-bold">{btDeviceName}</span>
                </span>
              </>
            )}
            {btStatus === 'connecting' && (
              <>
                <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold text-blue-600">Menghubungkan...</span>
              </>
            )}
            {btStatus === 'reconnecting' && (
              <>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <svg className="w-3.5 h-3.5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold text-amber-600">Reconnecting otomatis...</span>
              </>
            )}
            {btStatus === 'disconnecting' && (
              <>
                <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold text-slate-500">Memutus koneksi...</span>
              </>
            )}
            {btStatus === 'error' && (
              <>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-xs font-semibold text-rose-600">Gagal Terhubung</span>
              </>
            )}
            {btStatus === 'unsupported' && (
              <>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-xs font-semibold text-amber-700">Browser Tidak Didukung</span>
              </>
            )}
            {btStatus === 'idle' && (
              <>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="text-xs font-semibold text-slate-500">Belum Terhubung</span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {btStatus !== 'connected' ? (
              <button
                id="btn-bt-connect"
                type="button"
                onClick={handleBtConnect}
                disabled={btStatus === 'connecting' || btStatus === 'disconnecting' || btStatus === 'reconnecting'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                Scan &amp; Hubungkan
              </button>
            ) : (
              <button
                id="btn-bt-disconnect"
                type="button"
                onClick={handleBtDisconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M9 9l6 6m0-6l-6 6" />
                </svg>
                Putuskan Koneksi
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {(btStatus === 'error' || btStatus === 'unsupported') && btErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{btErrorMsg}</span>
          </div>
        )}

        {/* Service UUID Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            BLE Service Profile (UUID)
          </label>
          <select
            id="select-bt-service-uuid"
            value={btServiceUuid}
            onChange={(e) => {
              setBtServiceUuid(e.target.value);
              // Jika sudah connected, disconnect dulu saat ganti profile
              if (btStatus === 'connected') {
                handleBtDisconnect();
              }
            }}
            disabled={btStatus === 'connecting' || btStatus === 'disconnecting'}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all cursor-pointer"
          >
            {BLE_PROFILES.map((p) => (
              <option key={p.serviceUuid} value={p.serviceUuid}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Jika <strong>Auto-Detect</strong> gagal, coba pilih profile yang sesuai merk printer Anda secara manual.
          </p>
        </div>

        {/* Test Print Button */}
        <div className="pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Test Print Struk</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cetak struk percobaan untuk memverifikasi koneksi dan format kertas printer.
              </p>
            </div>
            <button
              id="btn-bt-test-print"
              type="button"
              onClick={handleTestPrint}
              disabled={btStatus !== 'connected' || isTestPrinting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isTestPrinting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Mencetak...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                  </svg>
                  Cetak Struk Test
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/80 text-[11px] text-blue-700 space-y-1.5">
          <p className="font-semibold text-blue-800 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            Web Bluetooth API — Panduan Penggunaan
          </p>
          <ul className="space-y-1 pl-1 list-none">
            <li>✅ <strong>Didukung:</strong> Google Chrome &amp; Microsoft Edge (versi terbaru)</li>
            <li>❌ <strong>Tidak didukung:</strong> Firefox, Safari, dan browser lainnya</li>
            <li>🔒 <strong>HTTPS wajib</strong> di production — localhost tetap berfungsi</li>
            <li>📱 <strong>Printer BLE</strong> yang kompatibel: Xprinter, GOOJPRT, RONGTA, Cashino, dll.</li>
          </ul>
        </div>
      </SettingsCard>

      {/* ─── PAJAK RESTORAN (PB1) ─────────────────────────────────────────── */}
      <SettingsCard
        title="Pajak Restoran / PPN (PB1)"
        description="Aturan penghitungan pajak pertambahan nilai pada setiap pesanan kasir POS."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Pajak</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Pajak akan otomatis dihitung pada setiap checkout penjualan</p>
          </div>
          <Toggle
            id="toggle-tax-enabled"
            checked={taxEnabled}
            onChange={setTaxEnabled}
            disabled={isSaving}
          />
        </div>

        {taxEnabled && (
          <>
            <RateInput
              id="input-tax-rate"
              label="Tarif Pajak (%)"
              value={taxRate}
              onChange={setTaxRate}
              disabled={isSaving}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-900">Dasar Pengenaan Pajak Termasuk Service Charge</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Jika aktif: DPP Pajak = Subtotal + Service Charge (Cascading Tax)
                </p>
              </div>
              <Toggle
                id="toggle-tax-base-includes-sc"
                checked={taxBaseIncludesServiceCharge}
                onChange={setTaxBaseIncludesServiceCharge}
                disabled={isSaving}
              />
            </div>
          </>
        )}
      </SettingsCard>

      {/* ─── SERVICE CHARGE ───────────────────────────────────────────────── */}
      <SettingsCard
        title="Service Charge"
        description="Biaya layanan tambahan untuk operasional dine-in atau take-away."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Service Charge</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Biaya layanan akan ditambahkan ke subtotal tagihan</p>
          </div>
          <Toggle
            id="toggle-sc-enabled"
            checked={serviceChargeEnabled}
            onChange={setServiceChargeEnabled}
            disabled={isSaving}
          />
        </div>

        {serviceChargeEnabled && (
          <RateInput
            id="input-sc-rate"
            label="Tarif Service Charge (%)"
            value={serviceChargeRate}
            onChange={setServiceChargeRate}
            disabled={isSaving}
          />
        )}
      </SettingsCard>

      {/* ─── CASH ROUNDING ────────────────────────────────────────────────── */}
      <SettingsCard
        title="Pembulatan Kas Tunai (Cash Rounding)"
        description="Pembulatan nilai bayar tunai ke pecahan rupiah terdekat agar mempermudah uang kembalian kasir."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Pembulatan Kas</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Total tunai dibulatkan ke kelipatan pecahan yang ditentukan</p>
          </div>
          <Toggle
            id="toggle-rounding-enabled"
            checked={cashRoundingEnabled}
            onChange={setCashRoundingEnabled}
            disabled={isSaving}
          />
        </div>

        {cashRoundingEnabled && (
          <RateInput
            id="input-rounding-unit"
            label="Unit Pembulatan (Rp)"
            value={cashRoundingUnit}
            onChange={setCashRoundingUnit}
            disabled={isSaving}
            suffix="Rp"
            min={0}
            max={10000}
            step={500}
          />
        )}
      </SettingsCard>

      {/* ─── SAVE BUTTON ──────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          id="btn-save-settings"
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Menyimpan...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Simpan Pengaturan Toko
            </>
          )}
        </button>
      </div>
    </div>
  );
}
