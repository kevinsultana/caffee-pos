'use client';

import { useRef } from 'react';
import { SettingsCard } from './SharedComponents';

export default function StoreIdentityTab({
  storeName, setStoreName,
  logoUrl, setLogoUrl,
  qrisImageUrl, setQrisImageUrl,
  address, setAddress,
  phone, setPhone,
  isSaving,
  isUploadingLogo, setIsUploadingLogo,
  isUploadingQris, setIsUploadingQris,
  fileInputRef,
  qrisFileInputRef,
  onLogoChange,
  onRemoveLogo,
  onQrisChange,
  onRemoveQris,
}) {
  return (
    <div className="space-y-6">
      {/* ── Identitas & Nama Toko ──────────────────────────── */}
      <SettingsCard
        title="Identitas & Nama Toko"
        description="Nama dan logo usaha yang tertera di header nota fisik, dashboard, dan cetak struk kasir."
      >
        {/* Nama Toko */}
        <div>
          <label htmlFor="input-store-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nama Toko / Usaha *
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

        {/* Alamat Toko */}
        <div>
          <label htmlFor="input-store-address" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Alamat Toko
          </label>
          <textarea
            id="input-store-address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isSaving}
            placeholder="contoh: Jl. Sudirman No. 12, Jakarta Pusat"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all leading-relaxed"
          />
        </div>

        {/* Kontak */}
        <div>
          <label htmlFor="input-store-phone" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nomor Telepon / WhatsApp Toko
          </label>
          <input
            id="input-store-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSaving}
            placeholder="contoh: 0812-3456-7890"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </SettingsCard>

      {/* ── Upload Logo Toko ──────────────────────────────── */}
      <SettingsCard
        title="Logo Toko"
        description="Upload logo usaha Anda. Akan digunakan di sidebar aplikasi dan header nota fisik struk kasir."
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Logo Preview */}
          <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative shadow-2xs">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo Toko" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-center p-2">
                <svg className="w-7 h-7 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span className="text-[10px] text-slate-400 block mt-1 font-medium">No Logo</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 flex-1">
            <input
              ref={fileInputRef}
              type="file"
              id="file-store-logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoChange}
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
                  onClick={onRemoveLogo}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hapus Logo
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Format didukung: <strong>PNG, JPG, WEBP, SVG</strong> (Maksimal 5MB). Disimpan di Supabase Storage.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* ── Barcode & Gambar QRIS ──────────────────────────── */}
      <SettingsCard
        title="Barcode & Gambar QRIS Toko"
        description="Upload barcode QRIS usaha Anda (BCA, Mandiri, GoPay, DANA, OVO, ShopeePay, dll). Gambar ini muncul di layar pembayaran kasir POS saat metode bayar QRIS dipilih."
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* QRIS Preview */}
          <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrisImageUrl} alt="Barcode QRIS Toko" className="w-full h-full object-contain p-2 bg-white" />
            ) : (
              <div className="text-center p-3">
                <svg className="w-8 h-8 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                </svg>
                <span className="text-[10px] text-slate-400 block mt-1 font-medium">Belum Ada QRIS</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 flex-1">
            <input
              ref={qrisFileInputRef}
              type="file"
              id="file-store-qris"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onQrisChange}
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
                  onClick={onRemoveQris}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hapus Barcode QRIS
                </button>
              )}
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 space-y-0.5">
              <p className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Terintegrasi langsung dengan Popup Pembayaran Kasir POS
              </p>
              <p className="text-[10px] text-emerald-700/80">
                Gunakan gambar QRIS rasio 1:1 resolusi tajam. Format: <strong>PNG, JPG, WEBP, SVG</strong> (Maks 5MB).
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
