'use client';

import { cn } from '@/lib/utils';
import { Toggle, SettingsCard, AlignSelector } from './SharedComponents';
import { useBluetooth, BLE_PROFILES } from '@/contexts/BluetoothPrinterContext';

// ── Live Receipt Preview ──────────────────────────────────────────────────────
function ReceiptPreviewCard({
  storeName,
  logoUrl,
  receiptLogoUrl,
  printerWidth,
  receiptShowLogo,
  receiptShowStoreName = true,
  receiptFontSize = 'NORMAL',
  receiptDoubleHeight = true,
  receiptCols = null,
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
  const isSmallFont = receiptFontSize === 'SMALL';
  const defaultCols = is80 ? (isSmallFont ? 64 : 48) : (isSmallFont ? 42 : 32);
  const cols = (receiptCols && Number(receiptCols) > 0) ? Number(receiptCols) : defaultCols;
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview Struk
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
            {printerWidth}mm • {cols} Col
          </span>
          {isSmallFont && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
              Font B
            </span>
          )}
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

      {/* Kertas Struk Termal */}
      <div
        className={cn(
          'w-full bg-[#fcfcfa] text-stone-900 font-mono leading-tight px-4 py-6 rounded-md shadow-md border border-stone-200 transition-all relative',
          isSmallFont ? 'text-[9.5px]' : 'text-[11px]',
          is80 ? 'max-w-85' : 'max-w-67.5'
        )}
      >
        <div className="absolute -top-1 left-0 right-0 h-1 overflow-hidden flex justify-between opacity-20 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="inline-block w-2 h-2 bg-stone-400 rotate-45 transform origin-bottom" />
          ))}
        </div>

        {receiptShowLogo && activeLogo && (
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeLogo} alt="Logo Struk" className="max-h-12 max-w-30 object-contain filter grayscale contrast-125" />
          </div>
        )}

        {receiptShowStoreName && (
          <div className={cn('text-center font-black uppercase tracking-wider text-black', receiptDoubleHeight ? 'text-sm' : 'text-xs')}>
            {storeName || 'SCHAW CAFE'}
          </div>
        )}

        {receiptHeader && receiptHeader.trim() ? (
          <div className={cn('text-[10px] text-stone-700 whitespace-pre-line my-1', getAlignClass(receiptHeaderAlign), receiptHeaderBold && 'font-bold text-stone-950')}>
            {receiptHeader}
          </div>
        ) : (
          <div className="text-center text-[10px] text-stone-500 my-0.5">Cabang MAIN</div>
        )}

        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">{sep}</div>

        <div className="text-[10px] space-y-0.5 text-stone-600">
          <div className="flex justify-between"><span>Waktu:</span><span>24/09/2026 17:00</span></div>
          <div className="flex justify-between"><span>No. Order:</span><span className="font-semibold text-stone-900">#ORD-1029</span></div>
          <div className="flex justify-between"><span>Antrean:</span><span className="font-bold text-stone-900">A-01</span></div>
          <div className="flex justify-between"><span>Pesanan:</span><span>Dine In</span></div>
          <div className="flex justify-between"><span>Kasir:</span><span>Kasir Utama</span></div>
          <div className="flex justify-between"><span>Pelanggan:</span><span>Budi Santoso</span></div>
        </div>

        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">{sep}</div>

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

        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">{sep}</div>

        <div className="text-[10px] space-y-0.5 text-stone-600">
          <div className="flex justify-between"><span>Subtotal:</span><span>Rp 40.000</span></div>
          <div className={cn('flex justify-between font-bold text-black pt-1 border-t border-dashed border-stone-300', receiptDoubleHeight ? 'text-xs sm:text-sm' : 'text-[11px]')}>
            <span>TOTAL:</span><span>Rp 40.000</span>
          </div>
          <div className="flex justify-between pt-0.5"><span>Metode Bayar:</span><span className="font-semibold text-stone-800">CASH</span></div>
          <div className="flex justify-between"><span>Uang Diterima:</span><span>Rp 50.000</span></div>
          <div className="flex justify-between"><span>Kembalian:</span><span>Rp 10.000</span></div>
        </div>

        <div className="text-stone-400 select-none overflow-hidden my-1 text-center font-mono">{sep}</div>

        {receiptFooter && receiptFooter.trim() ? (
          <div className={cn('text-[10px] whitespace-pre-line text-stone-700 my-1.5', getAlignClass(receiptFooterAlign), receiptFooterBold && 'font-bold text-stone-950')}>
            {receiptFooter}
          </div>
        ) : (
          <div className="text-center text-[10px] text-stone-600 space-y-0.5 my-1.5">
            <div>Terima kasih atas kunjungan Anda!</div>
            <div className="text-[9px] text-stone-500">Simpan struk sebagai bukti pembayaran.</div>
          </div>
        )}

        <div className="absolute -bottom-1 left-0 right-0 h-1 overflow-hidden flex justify-between opacity-20 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="inline-block w-2 h-2 bg-stone-400 rotate-45 transform origin-top" />
          ))}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full', btConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
        <span>{btConnected ? `Printer Bluetooth Siap (${btDeviceName})` : 'Printer belum terhubung'}</span>
      </div>
    </div>
  );
}


// ── PrinterReceiptTab (Main Export) ──────────────────────────────────────────
export default function PrinterReceiptTab({
  storeName,
  logoUrl,
  printerWidth, setPrinterWidth,
  receiptShowLogo, setReceiptShowLogo,
  receiptLogoUrl, setReceiptLogoUrl,
  receiptShowStoreName, setReceiptShowStoreName,
  receiptFontSize, setReceiptFontSize,
  receiptDoubleHeight, setReceiptDoubleHeight,
  receiptCols, setReceiptCols,
  receiptHeader, setReceiptHeader,
  receiptHeaderAlign, setReceiptHeaderAlign,
  receiptHeaderBold, setReceiptHeaderBold,
  receiptFooter, setReceiptFooter,
  receiptFooterAlign, setReceiptFooterAlign,
  receiptFooterBold, setReceiptFooterBold,
  isUploadingReceiptLogo,
  receiptLogoFileInputRef,
  onReceiptLogoChange,
  onRemoveReceiptLogo,
  isSaving,
  handleTestPrint,
  isTestPrinting,
}) {
  const { btStatus, btDeviceName, btServiceUuid, btErrorMsg, connect: handleBtConnect, disconnect: handleBtDisconnect, setBtServiceUuid } = useBluetooth();
  const btConnected = btStatus === 'connected';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* ── Left Column: Settings Forms (8 cols) ── */}
      <div className="xl:col-span-8 space-y-6">

        {/* ── 1. Koneksi Bluetooth ── */}
        <SettingsCard
          title="Koneksi Bluetooth Printer Termal"
          description="Hubungkan printer thermal Bluetooth via Web Bluetooth API (BLE). Tersedia di Google Chrome & Microsoft Edge."
        >
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
                  <span className="text-xs font-semibold text-amber-600">Reconnecting otomatis...</span>
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
              {btStatus === 'disconnecting' && (
                <>
                  <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-500">Memutus koneksi...</span>
                </>
              )}
            </div>

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
                  Scan & Hubungkan
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

          {(btStatus === 'error' || btStatus === 'unsupported') && btErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{btErrorMsg}</span>
            </div>
          )}

          {/* BLE UUID Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              BLE Service Profile (UUID)
            </label>
            <select
              id="select-bt-service-uuid"
              value={btServiceUuid}
              onChange={(e) => {
                setBtServiceUuid(e.target.value);
                if (btStatus === 'connected') handleBtDisconnect();
              }}
              disabled={btStatus === 'connecting' || btStatus === 'disconnecting'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {BLE_PROFILES.map((p) => (
                <option key={p.serviceUuid} value={p.serviceUuid}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Jika <strong>Auto-Detect</strong> gagal, coba pilih profile merk printer secara manual.
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/80 text-[11px] text-blue-700 space-y-1.5">
            <p className="font-semibold text-blue-800 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              Web Bluetooth API — Panduan Penggunaan
            </p>
            <ul className="space-y-1 pl-1 list-none">
              <li>✅ <strong>Didukung:</strong> Google Chrome & Microsoft Edge (versi terbaru)</li>
              <li>❌ <strong>Tidak didukung:</strong> Firefox, Safari, dan browser lainnya</li>
              <li>🔒 <strong>HTTPS wajib</strong> di production — localhost tetap berfungsi</li>
              <li>📱 <strong>Printer BLE</strong> yang kompatibel: Xprinter, GOOJPRT, RONGTA, Cashino, dll.</li>
            </ul>
          </div>
        </SettingsCard>

        {/* ── 2. Ukuran Kertas ── */}
        <SettingsCard
          title="Ukuran Kertas Printer"
          description="Pilih format lebar kertas printer termal saat kasir mencetak nota struk penjualan."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { val: 58, label: '58mm (Printer Kasir Kecil)', cols: '32 Col', desc: 'Lebar struk standar 58mm (32 karakter/baris). Cocok untuk printer Bluetooth mini portabel atau printer saku kasir.' },
              { val: 80, label: '80mm (Printer Struk Standar)', cols: '48 Col', desc: 'Lebar struk standar 80mm (48 karakter/baris). Cocok untuk printer kasir desktop, USB, Ethernet LAN / Auto-Cutter.' },
            ].map((opt) => (
              <div
                key={opt.val}
                onClick={() => setPrinterWidth(opt.val)}
                className={cn(
                  'p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2',
                  printerWidth === opt.val
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-4 h-4 rounded-full border flex items-center justify-center', printerWidth === opt.val ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300')}>
                      {printerWidth === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">{opt.cols}</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-6">{opt.desc}</p>
              </div>
            ))}
          </div>
        </SettingsCard>

        {/* ── 3. Kustomisasi Header & Footer Struk ── */}
        <SettingsCard
          title="Kustomisasi Header Struk"
          description="Atur logo, nama toko, dan teks tambahan pada bagian atas nota struk fisik kasir."
        >
          {/* Toggle Logo */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Tampilkan Logo di Struk</p>
                <p className="text-[11px] text-slate-500">Cetak gambar logo di bagian atas struk kasir</p>
              </div>
              <Toggle id="toggle-receipt-logo" checked={receiptShowLogo} onChange={setReceiptShowLogo} disabled={isSaving} />
            </div>

            {receiptShowLogo && (
              <div className="pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {receiptLogoUrl || logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={receiptLogoUrl || logoUrl} alt="Logo Struk" className="w-full h-full object-contain p-1 filter grayscale contrast-125" />
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
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Khusus Struk</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {receiptLogoUrl
                        ? 'Foto khusus struk aktif digunakan pada thermal printer.'
                        : logoUrl
                          ? 'Default menggunakan logo toko. Upload foto khusus receipt agar terpisah.'
                          : 'Unggah gambar hitam-putih / kontras tinggi agar tajam di printer thermal.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <input
                    ref={receiptLogoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={onReceiptLogoChange}
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
                      onClick={onRemoveReceiptLogo}
                      disabled={isSaving}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Toggle Nama Toko */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <p className="text-xs font-bold text-slate-800">Cetak Nama Toko / Usaha</p>
              <p className="text-[11px] text-slate-500">
                Jika dinonaktifkan, teks nama Toko (&quot;{storeName || 'SCHAW CAFE'}&quot;) tidak akan dicetak.
              </p>
            </div>
            <Toggle id="toggle-receipt-show-store-name" checked={receiptShowStoreName} onChange={setReceiptShowStoreName} disabled={isSaving} />
          </div>

          {/* Teks Sub-Header */}
          <div>
            <label htmlFor="input-receipt-header" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Teks Header Tambahan (Sub-Header)
            </label>
            <textarea
              id="input-receipt-header"
              rows={3}
              value={receiptHeader}
              onChange={(e) => setReceiptHeader(e.target.value)}
              disabled={isSaving}
              placeholder={"Contoh: Jl. Sudirman No. 12, Jakarta\nTelp/WA: 0812-3456-7890\nInstagram: @schawcafe"}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 mt-1">Bisa multi-baris (gunakan Enter). Kosongkan untuk default &quot;Cabang MAIN&quot;.</p>
          </div>

          {/* Align & Bold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Perataan (Alignment)</label>
              <AlignSelector id="select-header-align" value={receiptHeaderAlign} onChange={setReceiptHeaderAlign} disabled={isSaving} />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-6">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Teks Tebal (Bold)</span>
                <span className="text-[10px] text-slate-400">Gunakan font bold ESC/POS</span>
              </div>
              <Toggle id="toggle-header-bold" checked={receiptHeaderBold} onChange={setReceiptHeaderBold} disabled={isSaving} />
            </div>
          </div>
        </SettingsCard>

        {/* ── 4. Ukuran Font & Format Cetak ── */}
        <SettingsCard
          title="Ukuran Font & Format Cetak"
          description="Atur ukuran teks thermal, huruf tinggi (double-height), dan lebar karakter per baris."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { val: 'NORMAL', label: 'Normal (Font A)', badge: '12x24 dot', desc: 'Ukuran standar printer termal. Font jelas dan mudah terbaca dari jarak wajar.' },
              { val: 'SMALL', label: 'Kecil / Kompak (Font B)', badge: '9x17 dot', badgeColor: 'bg-blue-100 text-blue-700', desc: 'Ukuran font lebih kecil & padat. Muat lebih banyak detail menu serta hemat kertas struk.' },
            ].map((opt) => (
              <div
                key={opt.val}
                onClick={() => !isSaving && setReceiptFontSize(opt.val)}
                className={cn(
                  'p-3.5 rounded-xl border transition-all cursor-pointer select-none space-y-1',
                  receiptFontSize === opt.val
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-4 h-4 rounded-full border flex items-center justify-center', receiptFontSize === opt.val ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300')}>
                      {receiptFontSize === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                  </div>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-bold', opt.badgeColor || 'bg-slate-100 text-slate-700')}>{opt.badge}</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-6">{opt.desc}</p>
              </div>
            ))}
          </div>

          {/* Double Height */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <p className="text-xs font-bold text-slate-800">Huruf Tinggi (Double Height)</p>
              <p className="text-[11px] text-slate-500">
                Cetak nama usaha dan teks <strong>TOTAL</strong> 2x lebih tinggi agar menonjol.
              </p>
            </div>
            <Toggle id="toggle-receipt-double-height" checked={receiptDoubleHeight} onChange={setReceiptDoubleHeight} disabled={isSaving} />
          </div>

          {/* Karakter per Baris */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label htmlFor="input-receipt-cols" className="text-xs font-bold text-slate-800 block">
                  Jumlah Karakter per Baris (Lebar Kolom)
                </label>
                <p className="text-[11px] text-slate-500">
                  Standar: <strong>{printerWidth === 80 ? (receiptFontSize === 'SMALL' ? '64' : '48') : (receiptFontSize === 'SMALL' ? '42' : '32')}</strong> karakter.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => { const v = parseInt(receiptCols || (printerWidth === 80 ? (receiptFontSize === 'SMALL' ? 64 : 48) : (receiptFontSize === 'SMALL' ? 42 : 32)), 10); setReceiptCols(String(Math.max(20, v - 1))); }} disabled={isSaving} className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 text-sm shadow-2xs">-</button>
                <input
                  id="input-receipt-cols"
                  type="number" min={20} max={100}
                  value={receiptCols}
                  onChange={(e) => setReceiptCols(e.target.value)}
                  placeholder={String(printerWidth === 80 ? (receiptFontSize === 'SMALL' ? 64 : 48) : (receiptFontSize === 'SMALL' ? 42 : 32))}
                  disabled={isSaving}
                  className="w-20 text-center px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
                <button type="button" onClick={() => { const v = parseInt(receiptCols || (printerWidth === 80 ? (receiptFontSize === 'SMALL' ? 64 : 48) : (receiptFontSize === 'SMALL' ? 42 : 32)), 10); setReceiptCols(String(Math.min(100, v + 1))); }} disabled={isSaving} className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 text-sm shadow-2xs">+</button>
                {receiptCols && (
                  <button type="button" onClick={() => setReceiptCols('')} disabled={isSaving} className="px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* ── 5. Footer Struk ── */}
        <SettingsCard
          title="Footer Struk (Bagian Bawah)"
          description="Pesan penutup, ucapan terima kasih, info wifi, atau akun sosmed di bagian bawah nota."
        >
          <div>
            <label htmlFor="input-receipt-footer" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Teks Footer Struk
            </label>
            <textarea
              id="input-receipt-footer"
              rows={3}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              disabled={isSaving}
              placeholder={"Contoh: Terima kasih atas kunjungan Anda!\nWifi: kopienak / pass: nikmat123\nSimpan struk sebagai bukti pembayaran yang sah."}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 mt-1">Bisa multi-baris (gunakan Enter). Bebas disesuaikan untuk promosi / info kafe.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Perataan (Alignment)</label>
              <AlignSelector id="select-footer-align" value={receiptFooterAlign} onChange={setReceiptFooterAlign} disabled={isSaving} />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-6">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Teks Tebal (Bold)</span>
                <span className="text-[10px] text-slate-400">Gunakan font bold ESC/POS</span>
              </div>
              <Toggle id="toggle-footer-bold" checked={receiptFooterBold} onChange={setReceiptFooterBold} disabled={isSaving} />
            </div>
          </div>
        </SettingsCard>

      </div>

      {/* ── Right Column: Live Preview (4 cols, sticky) ── */}
      <div className="xl:col-span-4">
        <div className="xl:sticky xl:top-6">
          <ReceiptPreviewCard
            storeName={storeName}
            logoUrl={logoUrl}
            receiptLogoUrl={receiptLogoUrl}
            printerWidth={printerWidth}
            receiptShowLogo={receiptShowLogo}
            receiptShowStoreName={receiptShowStoreName}
            receiptFontSize={receiptFontSize}
            receiptDoubleHeight={receiptDoubleHeight}
            receiptCols={receiptCols}
            receiptHeader={receiptHeader}
            receiptHeaderAlign={receiptHeaderAlign}
            receiptHeaderBold={receiptHeaderBold}
            receiptFooter={receiptFooter}
            receiptFooterAlign={receiptFooterAlign}
            receiptFooterBold={receiptFooterBold}
            onTestPrint={handleTestPrint}
            isTestPrinting={isTestPrinting}
            btConnected={btConnected}
            btDeviceName={btDeviceName}
          />
        </div>
      </div>
    </div>
  );
}
