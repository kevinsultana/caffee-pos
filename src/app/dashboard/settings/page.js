'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getStoreSettings,
  updateStoreSettings,
  uploadStoreLogo,
  removeStoreLogo,
} from '@/app/actions/settings';
import { cn } from '@/lib/utils';

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

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Form state
  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [printerWidth, setPrinterWidth] = useState(58);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxBaseIncludesServiceCharge, setTaxBaseIncludesServiceCharge] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [cashRoundingEnabled, setCashRoundingEnabled] = useState(false);
  const [cashRoundingUnit, setCashRoundingUnit] = useState(0);

  // Load initial settings
  const loadData = async () => {
    const result = await getStoreSettings();
    if (result.error) {
      toast.error(result.error);
      setIsLoading(false);
      return;
    }
    const { settings, storeName: name, logoUrl: logo } = result.data;
    setStoreName(name || '');
    setLogoUrl(logo || null);
    if (settings) {
      setPrinterWidth(settings.printerWidth || 58);
      setTaxEnabled(settings.taxEnabled ?? false);
      setTaxRate(settings.taxRate ?? 0);
      setTaxBaseIncludesServiceCharge(settings.taxBaseIncludesServiceCharge ?? false);
      setServiceChargeEnabled(settings.serviceChargeEnabled ?? false);
      setServiceChargeRate(settings.serviceChargeRate ?? 0);
      setCashRoundingEnabled(settings.cashRoundingEnabled ?? false);
      setCashRoundingUnit(settings.cashRoundingUnit ?? 0);
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
        printerWidth,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
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

  const isSaving = isPending || isUploadingLogo;

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
