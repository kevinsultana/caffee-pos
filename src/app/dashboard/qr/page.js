'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getStoreSettings } from '@/app/actions/settings';
import { setAsStoreLogo } from '@/app/actions/storage';
import { useBluetooth, buildQrCardBytes } from '@/contexts/BluetoothPrinterContext';
import StorageImagePickerModal from '@/components/storage/StorageImagePickerModal';

export default function QrGeneratorPage() {
  const { isConnected: btConnected, printBytes, connect, btDeviceName } = useBluetooth();
  const [menuUrl, setMenuUrl] = useState('');
  const [tableNumber, setTableNumber] = useState('01');
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [defaultStoreLogoUrl, setDefaultStoreLogoUrl] = useState(null);
  const [storeName, setStoreName] = useState('SCHAW CAFE');
  const [printerWidth, setPrinterWidth] = useState(58);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSavingStoreLogo, setIsSavingStoreLogo] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMenuUrl(`${window.location.origin}/menu`);
    }

    async function loadSettings() {
      try {
        const res = await getStoreSettings();
        if (res?.data) {
          if (res.data.logoUrl) {
            setLogoUrl(res.data.logoUrl);
            setDefaultStoreLogoUrl(res.data.logoUrl);
          }
          if (res.data.storeName) setStoreName(res.data.storeName);
          if (res.data.settings?.printerWidth) setPrinterWidth(res.data.settings.printerWidth);
        }
      } catch (err) {
        console.error('Gagal memuat logo dan pengaturan toko:', err);
      }
    }

    loadSettings();
  }, []);

  function copyToClipboard() {
    navigator.clipboard.writeText(menuUrl);
    toast.success('Link menu berhasil disalin ke clipboard!');
  }

  // Simpan gambar yang dipilih sebagai Logo Utama Toko di database
  async function handleSetAsMainStoreLogo() {
    if (!logoUrl) return;
    setIsSavingStoreLogo(true);
    const toastId = toast.loading('Menyimpan sebagai logo utama toko...');
    try {
      const res = await setAsStoreLogo(logoUrl);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Logo berhasil disimpan sebagai Logo Utama Toko!', { id: toastId });
        setDefaultStoreLogoUrl(logoUrl);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan logo toko.', { id: toastId });
    } finally {
      setIsSavingStoreLogo(false);
    }
  }

  async function handlePrint() {
    if (!btConnected) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🖨️</span>
              <div>
                <p className="font-bold text-xs text-slate-900">Printer Thermal Belum Terhubung</p>
                <p className="text-[11px] text-slate-500">Hubungkan printer thermal Bluetooth untuk mencetak.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  await connect();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Hubungkan Printer
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        ),
        { duration: 6000, id: 'bt-connect-prompt' }
      );
      return;
    }

    setPrinting(true);
    const toastId = toast.loading('Mengirim Tent Card ke printer thermal Bluetooth...', { id: 'thermal-print-tent-card' });

    try {
      const bytes = buildQrCardBytes({
        storeName,
        tableNumber: tableNumber || '01',
        menuUrl,
        printerWidth,
      });

      await printBytes(bytes);
      toast.success(`Tent Card Meja #${tableNumber || '01'} berhasil dicetak ke ${btDeviceName || 'printer'}!`, {
        id: toastId,
        icon: '🖨️',
      });
    } catch (err) {
      console.error('[handlePrint Thermal Error]', err);
      toast.error('Gagal mencetak thermal: ' + (err.message || 'Cek koneksi printer Bluetooth.'), {
        id: toastId,
      });
    } finally {
      setPrinting(false);
    }
  }

  async function handleDownloadQR() {
    if (!qrRef.current) return;
    setDownloading(true);
    const toastId = toast.loading('Menyiapkan file gambar QR Code...');

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(qrRef.current, {
        scale: 3, // High-resolution output untuk hasil cetak tajam
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const filename = `QR-Code-Schaw-Meja-${tableNumber || '01'}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('QR Code berhasil diunduh!', { id: toastId });
    } catch (error) {
      console.error('[handleDownloadQR] Error:', error);
      toast.error('Gagal mengunduh QR Code: ' + (error.message || 'Terjadi kesalahan.'), { id: toastId });
    } finally {
      setDownloading(false);
    }
  }

  // QR Code generator URL using standard safe dynamic SVG/image endpoint
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0f172a&bgcolor=f8fafc&data=${encodeURIComponent(
    menuUrl || 'http://localhost:3000/menu'
  )}`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Generate QR Menu Meja Publik
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cetak atau unduh QR Code ini dan tempatkan di meja kafe agar pelanggan dapat memesan menu langsung dari smartphone.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/menu"
            target="_blank"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 7.5v11.25A2.25 2.25 0 005.25 21h11.25A2.25 2.25 0 0019.5 18.75V10.5M10.5 10.5L20.25 0.75m0 0h-5.25m5.25 0v5.25" />
            </svg>
            Buka Menu
          </Link>
          <button
            onClick={handleDownloadQR}
            disabled={downloading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? 'Mengunduh...' : 'Download QR'}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title={btConnected ? `Printer terhubung: ${btDeviceName}` : 'Klik untuk cetak via Thermal Printer'}
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.639 3.58-8.4 8-8.4s8 3.761 8 8.4c0 1.109-.13 2.189-.37 3.229M12 18.6V12m0 6.6l-3-3m3 3l3-3M6.72 13.829A7.962 7.962 0 0112 12c1.92 0 3.68.675 5.08 1.804" />
            </svg>
            {printing ? 'Mencetak...' : 'Cetak Thermal Tent Card'}
            {btConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`Printer terhubung: ${btDeviceName}`} />
            )}
          </button>
        </div>
      </div>

      {/* ─── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Settings, Supabase Storage Logo Picker & Link */}
        <div className="space-y-4">

          {/* 1. Supabase Storage Image & Logo Selector Card */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Logo & Gambar Tent Card</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Supabase Storage
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih gambar dari Supabase Storage untuk ditampilkan pada kartu meja QR
                </p>
              </div>
            </div>

            {/* Current Logo Preview & Controls */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Logo Tent Card"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {storeName ? storeName.slice(0, 2).toUpperCase() : 'SC'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {logoUrl ? 'Gambar Terpasang' : 'Inisial Nama Toko'}
                  </p>
                  <p
                    className="text-[11px] text-slate-400 font-mono truncate max-w-42.5 sm:max-w-52.5 block"
                    title={logoUrl ? decodeURIComponent(logoUrl.split('/').pop()?.split('?')[0] || '') : ''}
                  >
                    {logoUrl ? decodeURIComponent(logoUrl.split('/').pop()?.split('?')[0] || '') : 'Tidak ada gambar'}
                  </p>
                  {logoUrl && logoUrl === defaultStoreLogoUrl && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      ✓ Sesuai Logo Utama Toko
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStorageModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span>Pilih dari Storage</span>
                </button>

                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl(null);
                      toast('Logo Tent Card diubah ke mode inisial teks.', { icon: 'ℹ️' });
                    }}
                    className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Kosongkan logo pada Tent Card"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            {/* Extra Action Buttons */}
            {logoUrl && logoUrl !== defaultStoreLogoUrl && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  Gambar berbeda dari logo toko saat ini.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSetAsMainStoreLogo}
                    disabled={isSavingStoreLogo}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer disabled:opacity-50"
                  >
                    {isSavingStoreLogo ? 'Menyimpan...' : 'Jadikan Logo Utama Toko'}
                  </button>
                  {defaultStoreLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl(defaultStoreLogoUrl)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      &bull; Reset ke Logo Toko
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Tautan & Nomor Meja */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tautan Menu Digital
            </h2>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500">Public Menu URL:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={menuUrl}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Salin
                </button>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-500 mb-1">Nomor Meja Contoh:</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-28 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="01"
              />
            </div>
          </div>

          {/* 3. Petunjuk Penggunaan */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Petunjuk Penggunaan Tent Card:
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
              <li>Pilih gambar logo dari <strong>Supabase Storage</strong> atau upload baru via tombol di atas.</li>
              <li>Anda juga dapat menghapus gambar yang sudah tidak digunakan langsung dari galeri storage.</li>
              <li>Klik tombol <strong>Cetak Thermal Tent Card</strong> untuk langsung mencetak kartu meja ke printer kasir/thermal Bluetooth.</li>
              <li>Atau klik <strong>Download Gambar (PNG)</strong> jika ingin mencetak di percetakan/kertas tebal (Art Paper) atau akrilik meja.</li>
              <li>Pelanggan cukup membuka kamera smartphone dan langsung diarahkan ke katalog menu tanpa harus install aplikasi.</li>
            </ul>
          </div>
        </div>

        {/* Right: Printable Tent Card Preview & Actions */}
        <div className="flex flex-col items-center gap-4">
          <div
            ref={qrRef}
            id="printable-tent-card"
            className="w-72 bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl text-center space-y-4 flex flex-col items-center relative group"
          >
            {/* Quick edit logo on preview click */}
            <button
              type="button"
              onClick={() => setIsStorageModalOpen(true)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Ganti logo dari Supabase Storage"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>

            {/* Logo / Brand */}
            <div className="space-y-1.5 flex flex-col items-center">
              {logoUrl ? (
                <div
                  onClick={() => setIsStorageModalOpen(true)}
                  className="w-32 h-16 rounded-2xl flex items-center justify-center p-1.5 mx-auto shadow-2xs overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all bg-white"
                  title="Klik untuk mengganti gambar dari Supabase Storage"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt={storeName || 'Logo Toko'}
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  onClick={() => setIsStorageModalOpen(true)}
                  className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-md cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                  title="Klik untuk memilih gambar dari Supabase Storage"
                >
                  {storeName ? storeName.slice(0, 2).toUpperCase() : 'SC'}
                </div>
              )}
              <p className="text-[10px] text-slate-400 font-medium">Scan untuk Pesan Menu & Pembayaran</p>
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR Code Menu"
                crossOrigin="anonymous"
                className="w-48 h-48 rounded-xl object-contain"
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Arahkan kamera smartphone Anda ke kode QR untuk membuka daftar menu
            </p>
          </div>

          {/* Action Buttons under Preview */}
          <div className="w-72 space-y-2">
            <button
              onClick={handleDownloadQR}
              disabled={downloading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {downloading ? 'Mengunduh...' : 'Download Gambar (PNG)'}
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title={btConnected ? `Printer terhubung: ${btDeviceName}` : 'Klik untuk cetak via Thermal Printer'}
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.639 3.58-8.4 8-8.4s8 3.761 8 8.4c0 1.109-.13 2.189-.37 3.229M12 18.6V12m0 6.6l-3-3m3 3l3-3M6.72 13.829A7.962 7.962 0 0112 12c1.92 0 3.68.675 5.08 1.804" />
              </svg>
              {printing ? 'Mencetak Thermal...' : 'Cetak Thermal Tent Card'}
              {btConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`Printer terhubung: ${btDeviceName}`} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── SUPABASE STORAGE IMAGE PICKER & MANAGER MODAL ────────────────── */}
      <StorageImagePickerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        currentSelectedUrl={logoUrl}
        title="Galeri Gambar Supabase Storage"
        onSelectImage={(newUrl) => {
          setLogoUrl(newUrl);
          if (newUrl) {
            toast.success('Logo Tent Card berhasil diperbarui!');
          }
        }}
      />
    </div>
  );
}
