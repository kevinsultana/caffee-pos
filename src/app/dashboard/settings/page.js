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
import { useBluetooth, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';

// ── Tab Sub-Components ────────────────────────────────────────────────────────
import StoreIdentityTab from './_components/StoreIdentityTab';
import PrinterReceiptTab from './_components/PrinterReceiptTab';
import SystemPreferencesTab from './_components/SystemPreferencesTab';
import SecurityTab from './_components/SecurityTab';

// ── Tab Navigation Config ─────────────────────────────────────────────────────
const TABS = [
  {
    id: 'identity',
    label: 'Identitas Toko',
    shortLabel: 'Identitas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
    description: 'Nama, logo, alamat, kontak & QRIS',
  },
  {
    id: 'printer',
    label: 'Printer & Struk',
    shortLabel: 'Printer',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
      </svg>
    ),
    description: 'Bluetooth, kertas, kustomisasi struk',
  },
  {
    id: 'preferences',
    label: 'Preferensi Sistem',
    shortLabel: 'Preferensi',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
    description: 'Pajak, service charge, pembulatan, shift',
  },
  {
    id: 'security',
    label: 'Keamanan Akun',
    shortLabel: 'Keamanan',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    description: 'Password & keamanan sesi kasir',
  },
];

// ── Tabs that have a "Simpan" button (security manages its own form save) ────
const SAVEABLE_TABS = ['identity', 'printer', 'preferences'];

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Uploading states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [isUploadingReceiptLogo, setIsUploadingReceiptLogo] = useState(false);

  // File refs
  const fileInputRef = useRef(null);
  const qrisFileInputRef = useRef(null);
  const receiptLogoFileInputRef = useRef(null);

  // ── Identity State ──
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [qrisImageUrl, setQrisImageUrl] = useState(null);

  // ── Printer & Receipt State ──
  const [printerWidth, setPrinterWidth] = useState(58);
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);
  const [receiptLogoUrl, setReceiptLogoUrl] = useState(null);
  const [receiptShowStoreName, setReceiptShowStoreName] = useState(true);
  const [receiptFontSize, setReceiptFontSize] = useState('NORMAL');
  const [receiptDoubleHeight, setReceiptDoubleHeight] = useState(true);
  const [receiptCols, setReceiptCols] = useState('');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptHeaderAlign, setReceiptHeaderAlign] = useState('CENTER');
  const [receiptHeaderBold, setReceiptHeaderBold] = useState(false);
  const [receiptFooter, setReceiptFooter] = useState(
    'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.'
  );
  const [receiptFooterAlign, setReceiptFooterAlign] = useState('CENTER');
  const [receiptFooterBold, setReceiptFooterBold] = useState(false);

  // ── Preferences State ──
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxBaseIncludesServiceCharge, setTaxBaseIncludesServiceCharge] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [cashRoundingEnabled, setCashRoundingEnabled] = useState(false);
  const [cashRoundingUnit, setCashRoundingUnit] = useState(0);
  const [maxActiveShifts, setMaxActiveShifts] = useState(1);

  // ── Bluetooth ──
  const { btStatus, btDeviceName, printBytes } = useBluetooth();
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // ── Load Data ─────────────────────────────────────────────────────────────
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
      setReceiptFontSize(settings.receiptFontSize || 'NORMAL');
      setReceiptDoubleHeight(settings.receiptDoubleHeight ?? true);
      setReceiptCols(settings.receiptCols !== null && settings.receiptCols !== undefined ? String(settings.receiptCols) : '');
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

  // ── Logo Upload / Remove ──────────────────────────────────────────────────
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) { toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5MB.'); return; }

    setIsUploadingLogo(true);
    const toastId = toast.loading('Mengunggah logo toko ke Supabase Storage...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      const res = await uploadStoreLogo(formData);
      if (res.error) { toast.error(res.error, { id: toastId }); }
      else { toast.success(res.message || 'Logo berhasil diperbarui!', { id: toastId }); setLogoUrl(res.logoUrl); }
    } catch (err) { console.error(err); toast.error('Gagal mengunggah logo toko.', { id: toastId }); }
    finally { setIsUploadingLogo(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    const toastId = toast.loading('Menghapus logo toko...');
    const res = await removeStoreLogo();
    if (res.error) { toast.error(res.error, { id: toastId }); }
    else { toast.success('Logo toko berhasil dihapus.', { id: toastId }); setLogoUrl(null); }
    setIsUploadingLogo(false);
  };

  // ── QRIS Upload / Remove ──────────────────────────────────────────────────
  const handleQrisChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) { toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5MB.'); return; }

    setIsUploadingQris(true);
    const toastId = toast.loading('Mengunggah barcode QRIS toko...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      formData.append('qris', file);
      const res = await uploadQrisImage(formData);
      if (res.error) { toast.error(res.error, { id: toastId }); }
      else { toast.success(res.message || 'Barcode QRIS berhasil diperbarui!', { id: toastId }); setQrisImageUrl(res.qrisImageUrl); }
    } catch (err) { console.error(err); toast.error('Gagal mengunggah gambar QRIS.', { id: toastId }); }
    finally { setIsUploadingQris(false); if (qrisFileInputRef.current) qrisFileInputRef.current.value = ''; }
  };

  const handleRemoveQris = async () => {
    setIsUploadingQris(true);
    const toastId = toast.loading('Menghapus gambar QRIS toko...');
    const res = await removeQrisImage();
    if (res.error) { toast.error(res.error, { id: toastId }); }
    else { toast.success('Gambar QRIS toko berhasil dihapus.', { id: toastId }); setQrisImageUrl(null); }
    setIsUploadingQris(false);
  };

  // ── Receipt Logo Upload / Remove ──────────────────────────────────────────
  const handleReceiptLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) { toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5MB.'); return; }

    setIsUploadingReceiptLogo(true);
    const toastId = toast.loading('Mengunggah logo khusus struk...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      formData.append('receiptLogo', file);
      const res = await uploadReceiptLogo(formData);
      if (res.error) { toast.error(res.error, { id: toastId }); }
      else { toast.success(res.message || 'Logo struk berhasil diperbarui!', { id: toastId }); setReceiptLogoUrl(res.receiptLogoUrl); }
    } catch (err) { console.error(err); toast.error('Gagal mengunggah logo struk.', { id: toastId }); }
    finally { setIsUploadingReceiptLogo(false); if (receiptLogoFileInputRef.current) receiptLogoFileInputRef.current.value = ''; }
  };

  const handleRemoveReceiptLogo = async () => {
    setIsUploadingReceiptLogo(true);
    const toastId = toast.loading('Menghapus logo khusus struk...');
    const res = await removeReceiptLogo();
    if (res.error) { toast.error(res.error, { id: toastId }); }
    else { toast.success('Logo struk berhasil dihapus.', { id: toastId }); setReceiptLogoUrl(null); }
    setIsUploadingReceiptLogo(false);
  };

  // ── Test Print ────────────────────────────────────────────────────────────
  const handleTestPrint = async () => {
    if (btStatus !== 'connected') { toast.error('Belum terhubung ke printer Bluetooth.'); return; }
    setIsTestPrinting(true);
    const toastId = toast.loading('Mengirim data ke printer...');
    try {
      const testOrder = {
        orderNumber: 'TEST-001', queueNumber: 'A-00',
        createdAt: new Date().toISOString(), paidAt: new Date().toISOString(),
        customerNameSnapshot: 'Test Print', createdBy: { name: 'Kasir' }, source: 'POS',
        items: [{ productNameSnapshot: 'KONEKSI BLUETOOTH', variantNameSnapshot: null, quantity: 1, unitPrice: 0, subtotal: 0, notes: 'OK', promotionDiscount: 0 }],
        productSubtotal: 0, promotionDiscount: 0, serviceChargeAmount: 0, serviceChargeRate: 0,
        taxAmount: 0, taxRate: 0, roundingAmount: 0, cashPayable: 0, grandTotal: 0,
        payment: { method: 'CASH', cashReceived: 0, changeAmount: 0 },
      };
      const storeInfo = {
        name: storeName || 'SCHAW CAFE', logoUrl: logoUrl || null, receiptLogoUrl: receiptLogoUrl || null,
        receiptShowStoreName, receiptFontSize, receiptDoubleHeight, receiptCols: receiptCols ? parseInt(receiptCols, 10) : null,
        printerWidth, code: 'MAIN', receiptShowLogo, receiptHeader, receiptHeaderAlign, receiptHeaderBold,
        receiptFooter, receiptFooterAlign, receiptFooterBold,
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

  // ── Save Settings ─────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!storeName.trim()) { toast.error('Nama Toko/usaha tidak boleh kosong.'); return; }

    startTransition(async () => {
      const result = await updateStoreSettings({
        storeName: storeName.trim(),
        logoUrl,
        receiptLogoUrl,
        receiptShowStoreName,
        receiptFontSize,
        receiptDoubleHeight,
        receiptCols: receiptCols ? parseInt(receiptCols, 10) : null,
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

      if (result.error) { toast.error(result.error); }
      else { toast.success('Pengaturan toko berhasil diperbarui!'); loadData(); }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-500">Memuat konfigurasi toko...</p>
      </div>
    );
  }

  const isSaving = isPending || isUploadingLogo || isUploadingQris || isUploadingReceiptLogo;
  const activeTabConfig = TABS.find((t) => t.id === activeTab);

  return (
    <div className="max-w-7xl space-y-0">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Toko & POS</h1>
        <p className="text-xs text-slate-500 mt-1">
          Konfigurasi identitas kafe, struk kasir, printer, aturan pajak, dan keamanan akun.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Sidebar Tab Navigation (Desktop) ──────────────────────────── */}
        <aside className="lg:w-60 xl:w-64 shrink-0">
          {/* Mobile: Select Dropdown */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm font-semibold text-slate-900"
            >
              <span className="flex items-center gap-2.5">
                {activeTabConfig?.icon}
                {activeTabConfig?.label}
              </span>
              <svg
                className={cn('w-4 h-4 text-slate-500 transition-transform', mobileMenuOpen && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {mobileMenuOpen && (
              <div className="mt-1 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                      activeTab === tab.id
                        ? 'bg-emerald-50 text-emerald-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className={activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop: Vertical Sidebar */}
          <nav className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
            <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menu Pengaturan</p>
            </div>

            <div className="p-2 space-y-1">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 group',
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'
                    )}>
                      {tab.icon}
                    </span>
                    <div>
                      <div className={cn('text-xs font-bold leading-none mb-0.5', isActive ? 'text-white' : 'text-slate-800')}>
                        {tab.label}
                      </div>
                      <div className={cn('text-[10px] leading-tight', isActive ? 'text-emerald-100' : 'text-slate-400')}>
                        {tab.description}
                      </div>
                    </div>
                    {isActive && (
                      <span className="ml-auto shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Perubahan tersimpan secara otomatis setelah klik Simpan</span>
              </div>
            </div>
          </nav>
        </aside>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Tab Content Header Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 mb-5 text-xs text-slate-500">
            <span>Pengaturan</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-slate-900 font-semibold">{activeTabConfig?.label}</span>
          </div>

          {/* ── Tab: Identitas Toko ── */}
          {activeTab === 'identity' && (
            <StoreIdentityTab
              storeName={storeName} setStoreName={setStoreName}
              logoUrl={logoUrl} setLogoUrl={setLogoUrl}
              qrisImageUrl={qrisImageUrl} setQrisImageUrl={setQrisImageUrl}
              address={address} setAddress={setAddress}
              phone={phone} setPhone={setPhone}
              isSaving={isSaving}
              isUploadingLogo={isUploadingLogo} setIsUploadingLogo={setIsUploadingLogo}
              isUploadingQris={isUploadingQris} setIsUploadingQris={setIsUploadingQris}
              fileInputRef={fileInputRef}
              qrisFileInputRef={qrisFileInputRef}
              onLogoChange={handleLogoChange}
              onRemoveLogo={handleRemoveLogo}
              onQrisChange={handleQrisChange}
              onRemoveQris={handleRemoveQris}
            />
          )}

          {/* ── Tab: Printer & Struk ── */}
          {activeTab === 'printer' && (
            <PrinterReceiptTab
              storeName={storeName}
              logoUrl={logoUrl}
              printerWidth={printerWidth} setPrinterWidth={setPrinterWidth}
              receiptShowLogo={receiptShowLogo} setReceiptShowLogo={setReceiptShowLogo}
              receiptLogoUrl={receiptLogoUrl} setReceiptLogoUrl={setReceiptLogoUrl}
              receiptShowStoreName={receiptShowStoreName} setReceiptShowStoreName={setReceiptShowStoreName}
              receiptFontSize={receiptFontSize} setReceiptFontSize={setReceiptFontSize}
              receiptDoubleHeight={receiptDoubleHeight} setReceiptDoubleHeight={setReceiptDoubleHeight}
              receiptCols={receiptCols} setReceiptCols={setReceiptCols}
              receiptHeader={receiptHeader} setReceiptHeader={setReceiptHeader}
              receiptHeaderAlign={receiptHeaderAlign} setReceiptHeaderAlign={setReceiptHeaderAlign}
              receiptHeaderBold={receiptHeaderBold} setReceiptHeaderBold={setReceiptHeaderBold}
              receiptFooter={receiptFooter} setReceiptFooter={setReceiptFooter}
              receiptFooterAlign={receiptFooterAlign} setReceiptFooterAlign={setReceiptFooterAlign}
              receiptFooterBold={receiptFooterBold} setReceiptFooterBold={setReceiptFooterBold}
              isUploadingReceiptLogo={isUploadingReceiptLogo}
              receiptLogoFileInputRef={receiptLogoFileInputRef}
              onReceiptLogoChange={handleReceiptLogoChange}
              onRemoveReceiptLogo={handleRemoveReceiptLogo}
              isSaving={isSaving}
              handleTestPrint={handleTestPrint}
              isTestPrinting={isTestPrinting}
            />
          )}

          {/* ── Tab: Preferensi Sistem ── */}
          {activeTab === 'preferences' && (
            <SystemPreferencesTab
              taxEnabled={taxEnabled} setTaxEnabled={setTaxEnabled}
              taxRate={taxRate} setTaxRate={setTaxRate}
              taxBaseIncludesServiceCharge={taxBaseIncludesServiceCharge} setTaxBaseIncludesServiceCharge={setTaxBaseIncludesServiceCharge}
              serviceChargeEnabled={serviceChargeEnabled} setServiceChargeEnabled={setServiceChargeEnabled}
              serviceChargeRate={serviceChargeRate} setServiceChargeRate={setServiceChargeRate}
              cashRoundingEnabled={cashRoundingEnabled} setCashRoundingEnabled={setCashRoundingEnabled}
              cashRoundingUnit={cashRoundingUnit} setCashRoundingUnit={setCashRoundingUnit}
              maxActiveShifts={maxActiveShifts} setMaxActiveShifts={setMaxActiveShifts}
              isSaving={isSaving}
            />
          )}

          {/* ── Tab: Keamanan Akun ── */}
          {activeTab === 'security' && <SecurityTab />}

          {/* ── Save Button (shown only for saveable tabs) ── */}
          {SAVEABLE_TABS.includes(activeTab) && (
            <div className="mt-6 flex justify-end">
              <button
                id="btn-save-settings"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
                    Simpan Pengaturan
                  </>
                )}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
