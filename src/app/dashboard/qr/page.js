'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function QrGeneratorPage() {
  const [menuUrl, setMenuUrl] = useState('');
  const [tableNumber, setTableNumber] = useState('01');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMenuUrl(`${window.location.origin}/menu`);
    }
  }, []);

  function copyToClipboard() {
    navigator.clipboard.writeText(menuUrl);
    toast.success('Link menu berhasil disalin ke clipboard!');
  }

  function handlePrint() {
    window.print();
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
            Cetak QR Code ini dan tempatkan di meja kafe agar pelanggan dapat memesan menu langsung dari smartphone.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/menu"
            target="_blank"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 7.5v11.25A2.25 2.25 0 005.25 21h11.25A2.25 2.25 0 0019.5 18.75V10.5M10.5 10.5L20.25 0.75m0 0h-5.25m5.25 0v5.25" />
            </svg>
            Buka Halaman Menu
          </Link>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.639 3.58-8.4 8-8.4s8 3.761 8 8.4c0 1.109-.13 2.189-.37 3.229M12 18.6V12m0 6.6l-3-3m3 3l3-3M6.72 13.829A7.962 7.962 0 0112 12c1.92 0 3.68.675 5.08 1.804" />
            </svg>
            Cetak Tent Card QR
          </button>
        </div>
      </div>

      {/* ─── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Settings & Link */}
        <div className="space-y-4">
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
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

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Petunjuk Penggunaan Tent Card:
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
              <li>Klik tombol <strong>Cetak Tent Card QR</strong> di atas.</li>
              <li>Gunakan kertas tebal (Art Paper 260gsm/310gsm) atau selipkan pada akrilik meja ukuran A6 / A5.</li>
              <li>Pelanggan cukup membuka kamera HP atau aplikasi QR scanner dan langsung diarahkan ke katalog menu tanpa harus install aplikasi.</li>
            </ul>
          </div>
        </div>

        {/* Right: Printable Tent Card Preview */}
        <div className="flex justify-center">
          <div
            id="printable-tent-card"
            className="w-72 bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl text-center space-y-4 flex flex-col items-center"
          >
            {/* Logo / Brand */}
            <div className="space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-md">
                SC
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">SCHAW CAFE</h2>
              <p className="text-[10px] text-slate-400 font-medium">Scan untuk Pesan Menu & Pembayaran</p>
            </div>

            {/* Table Badge */}
            <div className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold font-mono">
              MEJA #{tableNumber || '01'}
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR Code Menu"
                className="w-48 h-48 rounded-xl object-contain"
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Arahkan kamera smartphone Anda ke kode QR untuk membuka daftar menu
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
