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
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=292524&bgcolor=fef3c7&data=${encodeURIComponent(
    menuUrl || 'http://localhost:3000/menu'
  )}`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Generate QR Menu Meja Publik</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Cetak QR Code ini dan tempatkan di meja kafe agar pelanggan dapat memesan menu langsung dari smartphone.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            target="_blank"
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 7.5v11.25A2.25 2.25 0 005.25 21h11.25A2.25 2.25 0 0019.5 18.75V10.5M10.5 10.5L20.25 0.75m0 0h-5.25m5.25 0v5.25" />
            </svg>
            Buka Halaman Menu
          </Link>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-950 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.04-.37-2.12-.37-3.229 0-4.639 3.58-8.4 8-8.4s8 3.761 8 8.4c0 1.109-.13 2.189-.37 3.229M12 18.6V12m0 6.6l-3-3m3 3l3-3M6.72 13.829A7.962 7.962 0 0112 12c1.92 0 3.68.675 5.08 1.804" />
            </svg>
            Cetak Tent Card QR
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings & Link */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-stone-800/80 bg-stone-900/50 space-y-4">
            <h2 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
              Tautan Menu Digital
            </h2>
            <div className="space-y-2">
              <label className="block text-xs text-stone-400">Public Menu URL:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={menuUrl}
                  className="flex-1 px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono text-xs focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Salin
                </button>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs text-stone-400 mb-1">Nomor Meja Contoh:</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-28 px-3.5 py-2 bg-stone-800 border border-stone-700 rounded-xl text-amber-50 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="01"
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-amber-900/40 bg-amber-950/20 text-xs text-amber-300/90 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5">
              <span>⚡</span> Alur Kerja Public QR Order:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-stone-300">
              <li>Pelanggan memindai QR Code di meja menggunakan kamera smartphone.</li>
              <li>Pelanggan memilih menu dan mengirim pesanan tanpa antre.</li>
              <li>Sistem membuat Order <b>`PENDING_PAYMENT`</b> dengan batas waktu <b>1 jam (60 menit)</b>.</li>
              <li>Pelanggan menunjukkan Token QR pesanan ke Kasir untuk membayar (CASH/QRIS).</li>
              <li>Kasir mengonfirmasi pembayaran di POS &rarr; stok otomatis dipotong dan dapur memproses pesanan.</li>
            </ol>
          </div>
        </div>

        {/* Right: Printable Tent Card Mockup */}
        <div className="flex justify-center">
          <div className="w-80 bg-amber-50 text-stone-900 rounded-3xl p-6 shadow-2xl border-4 border-stone-800 text-center space-y-4 print:w-full print:shadow-none print:border-none">
            <div className="space-y-1">
              <div className="w-10 h-10 mx-auto rounded-xl bg-amber-900 text-amber-200 flex items-center justify-center font-bold text-lg">
                ☕
              </div>
              <h3 className="text-lg font-black text-stone-900 tracking-tight">
                SCHAW CAFE
              </h3>
              <p className="text-[11px] font-semibold text-stone-600 uppercase tracking-widest">
                MEJA #{tableNumber}
              </p>
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-amber-100/80 rounded-2xl border-2 border-dashed border-stone-400/80 flex flex-col items-center justify-center">
              <img
                src={qrImageUrl}
                alt="QR Menu Schaw Cafe"
                className="w-48 h-48 rounded-xl shadow-sm"
              />
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider mt-2">
                Pindai untuk Pesan Menu
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-stone-800">
                1. Scan QR &bull; 2. Pilih Menu &bull; 3. Bayar di Kasir
              </p>
              <p className="text-[10px] text-stone-500">
                Pesanan tersimpan otomatis dengan token unik.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
