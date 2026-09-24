'use client';

/**
 * BluetoothPrinterContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Global React Context untuk koneksi BLE Thermal Printer.
 * Di-mount di DashboardShell agar hidup selama sesi dashboard (tidak reset
 * saat berpindah halaman).
 *
 * Mengekspos:
 *  - btStatus      : 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error' | 'unsupported'
 *  - btDeviceName  : string nama printer yang terhubung
 *  - btServiceUuid : UUID profile yang dipilih
 *  - btErrorMsg    : pesan error terakhir
 *  - connect()     : buka BLE picker & hubungkan
 *  - disconnect()  : putus koneksi
 *  - printBytes(Uint8Array) : kirim raw ESC/POS bytes ke printer
 *  - buildReceiptBytes(order, store, mode) : generate ESC/POS bytes untuk struk
 *  - buildKitchenBytes(order, cols)        : generate ESC/POS bytes untuk tiket dapur
 *  - setBtServiceUuid(uuid) : ganti profile UUID
 */

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

// ── BLE Profile Definitions ──────────────────────────────────────────────────
export const BLE_PROFILES = [
  {
    label: 'Auto-Detect (Coba Semua)',
    serviceUuid: 'auto',
    services: [
      { svc: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' },
      { svc: '0000ffe0-0000-1000-8000-00805f9b34fb', char: '0000ffe1-0000-1000-8000-00805f9b34fb' },
      { svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
      { svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-1e4d-4bd9-ba61-23c647249616' },
      { svc: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af0-0000-1000-8000-00805f9b34fb' },
    ],
  },
  {
    label: 'HM-10 / Generic BLE UART (FFE0)',
    serviceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
    services: [{ svc: '0000ffe0-0000-1000-8000-00805f9b34fb', char: '0000ffe1-0000-1000-8000-00805f9b34fb' }],
  },
  {
    label: 'Zjiang / GOOJPRT / RONGTA (18F0)',
    serviceUuid: '000018f0-0000-1000-8000-00805f9b34fb',
    services: [
      { svc: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' },
      { svc: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af0-0000-1000-8000-00805f9b34fb' },
    ],
  },
  {
    label: 'SUNMI / iMin (E7810A71)',
    serviceUuid: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    services: [{ svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' }],
  },
  {
    label: 'Microchip RN4870/71 (49535343)',
    serviceUuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    services: [{ svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-1e4d-4bd9-ba61-23c647249616' }],
  },
];

const ALL_BLE_SERVICE_UUIDS = BLE_PROFILES.flatMap((p) =>
  p.services.map((s) => s.svc)
).filter((v, i, a) => a.indexOf(v) === i);

// ── Context ──────────────────────────────────────────────────────────────────
const BluetoothPrinterContext = createContext(null);

// ── ESC/POS Helpers ──────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;

function enc(text) {
  // Ganti non-breaking space (\u00A0, \u202F) atau whitespace Unicode lainnya dengan spasi ASCII standar (0x20)
  const sanitized = String(text ?? '').replace(/[\u00A0\u202F\u2000-\u200B]/g, ' ');
  return new TextEncoder().encode(sanitized);
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length; }
  return out;
}

function padRight(str, len) {
  return String(str).padEnd(len, ' ').slice(0, len);
}
function padLeft(str, len) {
  return String(str).padStart(len, ' ').slice(0, len);
}

/** Format angka ke Rupiah ringkas (ASCII murni, tanpa non-breaking space / Unicode) misal: Rp 12.500 */
function fmtRp(num) {
  if (num === null || num === undefined || isNaN(Number(num))) return 'Rp 0';
  const n = Math.round(Number(num));
  const formatted = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-Rp ' : 'Rp ') + formatted;
}

/** Format tanggal/waktu Indonesia (ASCII murni) */
function fmtDt(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Convert an image URL to ESC/POS raster bit image command (GS v 0).
 * Mode 0: GS v 0 0 xL xH yL yH d1...dk
 */
export async function rasterizeImageUrl(imageUrl, maxDots = 384) {
  if (typeof window === 'undefined' || !imageUrl) return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let origW = img.naturalWidth || img.width;
          let origH = img.naturalHeight || img.height;
          if (!origW || !origH) return resolve(null);

          // Batasi lebar maksimum dan pastikan kelipatan 8 dots
          let targetW = Math.min(origW, maxDots);
          targetW = Math.max(8, Math.floor(targetW / 8) * 8);
          let targetH = Math.round((origH * targetW) / origW);
          if (targetH <= 0) return resolve(null);

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);

          // Background putih untuk gambar dengan transparansi PNG / SVG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          const bytesWidth = targetW / 8;
          const rasterBytes = new Uint8Array(8 + bytesWidth * targetH);

          // GS v 0 0 xL xH yL yH
          rasterBytes[0] = GS;
          rasterBytes[1] = 0x76;
          rasterBytes[2] = 0x30;
          rasterBytes[3] = 0x00; // mode 0: normal
          rasterBytes[4] = bytesWidth & 0xff; // xL
          rasterBytes[5] = (bytesWidth >> 8) & 0xff; // xH
          rasterBytes[6] = targetH & 0xff; // yL
          rasterBytes[7] = (targetH >> 8) & 0xff; // yH

          let offset = 8;
          for (let y = 0; y < targetH; y++) {
            for (let b = 0; b < bytesWidth; b++) {
              let byteVal = 0;
              for (let bit = 0; bit < 8; bit++) {
                const x = b * 8 + bit;
                const idx = (y * targetW + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const bl = data[idx + 2];
                const a = data[idx + 3];

                // Hitung luminance grayscale (jika transparan -> putih)
                const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * bl;
                if (lum < 165) {
                  byteVal |= 0x80 >> bit;
                }
              }
              rasterBytes[offset++] = byteVal;
            }
          }

          resolve(rasterBytes);
        } catch (canvasErr) {
          console.warn('[rasterizeImageUrl] Canvas error:', canvasErr);
          resolve(null);
        }
      };
      img.onerror = (e) => {
        console.warn('[rasterizeImageUrl] Image load error:', e);
        resolve(null);
      };
      img.src = imageUrl;
    } catch (err) {
      console.warn('[rasterizeImageUrl] Error:', err);
      resolve(null);
    }
  });
}

/**
 * Build ESC/POS bytes untuk struk CUSTOMER
 */
export async function buildReceiptBytes(order, store, mode = 'CUSTOMER') {
  const isSmallFont = store?.receiptFontSize === 'SMALL';
  const defaultCols = (store?.printerWidth || 58) === 80
    ? (isSmallFont ? 64 : 48)
    : (isSmallFont ? 42 : 32);
  const cols = (store?.receiptCols && Number(store.receiptCols) > 0)
    ? Number(store.receiptCols)
    : defaultCols;
  const sep = '-'.repeat(cols);
  const isKitchen = mode === 'KITCHEN';

  // Resolusi nomor antrean dari berbagai kemungkinan properti
  const queueNum =
    order?.queueNumber ||
    order?.queue_number ||
    order?.queue ||
    order?.queueNo ||
    order?.antrean ||
    '-';

  const parts = [];

  // Init
  parts.push(new Uint8Array([ESC, 0x40]));

  // Font size selection: ESC M 0 (Font A / Standar) atau ESC M 1 (Font B / Kecil-Kompak)
  if (isSmallFont) {
    parts.push(new Uint8Array([ESC, 0x4D, 0x01]));
  } else {
    parts.push(new Uint8Array([ESC, 0x4D, 0x00]));
  }

  if (isKitchen) {
    // ── TIKET DAPUR ──────────────────────────────────────────────────────────
    parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
    parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold on
    parts.push(new Uint8Array([ESC, 0x21, 0x10])); // double height
    parts.push(enc('== TIKET DAPUR ==\n'));
    parts.push(new Uint8Array([ESC, 0x21, 0x00])); // normal size
    const isTakeaway = queueNum.toUpperCase().startsWith('TA') || order?.orderType === 'TAKEAWAY';
    const typeBadge = isTakeaway ? '[ BUNGKUS / TAKEAWAY ]' : '[ DINE IN / DI TEMPAT ]';
    parts.push(enc(typeBadge + '\n'));
    parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold off
    parts.push(enc(sep + '\n'));

    // Nomor antrean besar & jelas untuk dapur
    if (queueNum && queueNum !== '-') {
      parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
      parts.push(enc('NOMOR ANTREAN\n'));
      parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold on
      parts.push(new Uint8Array([ESC, 0x21, 0x30])); // double height + double width
      parts.push(enc(queueNum + '\n'));
      parts.push(new Uint8Array([ESC, 0x21, 0x00])); // normal
      parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold off
      parts.push(enc(sep + '\n'));
    }

    // Meta
    parts.push(new Uint8Array([ESC, 0x61, 0x00])); // left
    parts.push(enc('No. Order : ' + (order.orderNumber || '-') + '\n'));
    parts.push(enc('Waktu     : ' + fmtDt(order.createdAt) + '\n'));
    parts.push(enc('Pelanggan : ' + (order.customerNameSnapshot || order.customer?.name || 'Umum') + '\n'));
    parts.push(enc('Tipe      : ' + (isTakeaway ? 'Takeaway / Bungkus' : 'Dine In / Di Tempat') + '\n'));
    parts.push(enc('Sumber    : ' + (order.source === 'PUBLIC_QR' ? 'QR Online' : 'Kasir POS') + '\n'));
    parts.push(enc(sep + '\n'));

    // Items
    for (const item of (order.items || [])) {
      parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold on
      parts.push(enc(item.quantity + 'x ' + item.productNameSnapshot + '\n'));
      parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold off
      if (item.variantNameSnapshot) {
        parts.push(enc('   Varian: ' + item.variantNameSnapshot + '\n'));
      }
      if (item.notes) {
        parts.push(enc('   *Catatan: ' + item.notes + '\n'));
      }
    }

    parts.push(enc(sep + '\n'));
    parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
    parts.push(new Uint8Array([ESC, 0x45, 0x01]));
    parts.push(enc('*** SELESAIKAN PESANAN ***\n'));
    parts.push(new Uint8Array([ESC, 0x45, 0x00]));
  } else {
    // ── STRUK CUSTOMER ───────────────────────────────────────────────────────
    // 1. Logo Toko (Foto Khusus Struk atau Logo Toko Utama)
    const activeLogoUrl = store?.receiptLogoUrl || store?.logoUrl;
    if (store?.receiptShowLogo !== false && activeLogoUrl) {
      try {
        const maxDots = (store?.printerWidth === 80) ? 384 : 256;
        const logoBytes = await rasterizeImageUrl(activeLogoUrl, maxDots);
        if (logoBytes) {
          parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
          parts.push(logoBytes);
          parts.push(enc('\n'));
        }
      } catch (err) {
        console.warn('[buildReceiptBytes] Logo print error:', err);
      }
    }

    // 2. Header nama toko (Bisa diaktifkan/dinonaktifkan jika memilih hanya logo)
    if (store?.receiptShowStoreName !== false) {
      parts.push(new Uint8Array([ESC, 0x61, 0x01])); // center
      parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold on
      if (store?.receiptDoubleHeight !== false) {
        parts.push(new Uint8Array([ESC, 0x21, 0x10])); // double height
      }
      parts.push(enc((store?.name || 'SCHAW CAFE') + '\n'));
      if (store?.receiptDoubleHeight !== false) {
        parts.push(new Uint8Array([ESC, 0x21, 0x00])); // normal
      }
      parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold off
    }

    // 3. Teks Header Kustom (Align & Bold dinamis)
    const headerAlignCode =
      store?.receiptHeaderAlign === 'LEFT' ? 0x00 : store?.receiptHeaderAlign === 'RIGHT' ? 0x02 : 0x01;
    const headerBold = Boolean(store?.receiptHeaderBold);

    parts.push(new Uint8Array([ESC, 0x61, headerAlignCode]));
    if (headerBold) parts.push(new Uint8Array([ESC, 0x45, 0x01]));

    if (store?.receiptHeader && store.receiptHeader.trim()) {
      const headerLines = store.receiptHeader.split('\n');
      for (const line of headerLines) {
        if (line.trim().length > 0) {
          parts.push(enc(line + '\n'));
        }
      }
    } else {
      parts.push(enc('Cabang ' + (store?.code || 'MAIN') + '\n'));
    }

    if (headerBold) parts.push(new Uint8Array([ESC, 0x45, 0x00]));
    parts.push(new Uint8Array([ESC, 0x61, 0x01]));
    parts.push(enc(sep + '\n'));


    // Meta transaksi
    const isTakeawayCust = queueNum.toUpperCase().startsWith('TA') || order?.orderType === 'TAKEAWAY';
    parts.push(new Uint8Array([ESC, 0x61, 0x00])); // left
    parts.push(enc('Waktu    : ' + fmtDt(order.paidAt || order.createdAt) + '\n'));
    parts.push(enc('No.Order : ' + (order.orderNumber || '-') + '\n'));
    parts.push(enc('Antrean  : ' + queueNum + '\n'));
    parts.push(enc('Pesanan  : ' + (isTakeawayCust ? 'Takeaway / Bungkus' : 'Dine In / Di Tempat') + '\n'));
    parts.push(enc('Kasir    : ' + (order.createdBy?.name || 'Kasir') + '\n'));
    parts.push(enc('Pelanggan: ' + (order.customerNameSnapshot || order.customer?.name || 'Umum') + '\n'));
    parts.push(enc(sep + '\n'));

    // Items
    for (const item of (order.items || [])) {
      const nameLine = item.productNameSnapshot +
        (item.variantNameSnapshot ? ' (' + item.variantNameSnapshot + ')' : '');
      // Nama item (potong jika terlalu panjang)
      if (nameLine.length > cols) {
        parts.push(enc(nameLine.slice(0, cols) + '\n'));
      } else {
        parts.push(enc(nameLine + '\n'));
      }
      // Qty x harga = subtotal (rata kanan)
      const qtyPrice = item.quantity + 'x ' + fmtRp(item.unitPrice);
      const subtotalStr = fmtRp(item.subtotal);
      const gap = cols - qtyPrice.length - subtotalStr.length;
      parts.push(enc(qtyPrice + ' '.repeat(Math.max(1, gap)) + subtotalStr + '\n'));

      if (item.notes) {
        parts.push(enc('  *' + item.notes + '\n'));
      }
      if (item.promotionDiscount > 0) {
        const discStr = '-' + fmtRp(item.promotionDiscount);
        parts.push(enc(padRight('  Diskon:', cols - discStr.length) + discStr + '\n'));
      }
    }

    parts.push(enc(sep + '\n'));

    // Ringkasan keuangan
    const printRow = (label, value) => {
      const valStr = String(value);
      parts.push(enc(padRight(label, cols - valStr.length) + valStr + '\n'));
    };

    printRow('Subtotal:', fmtRp(order.productSubtotal));
    if (order.promotionDiscount > 0) printRow('Diskon Promo:', '-' + fmtRp(order.promotionDiscount));
    if (order.serviceChargeAmount > 0)
      printRow(`Service Charge (${order.serviceChargeRate}%):`, fmtRp(order.serviceChargeAmount));
    if (order.taxAmount > 0)
      printRow(`Pajak PPN (${order.taxRate}%):`, fmtRp(order.taxAmount));
    if (order.roundingAmount && order.roundingAmount !== 0)
      printRow('Pembulatan:', fmtRp(order.roundingAmount));

    parts.push(enc(sep + '\n'));
    // TOTAL bold + double height
    parts.push(new Uint8Array([ESC, 0x45, 0x01]));
    if (store?.receiptDoubleHeight !== false) {
      parts.push(new Uint8Array([ESC, 0x21, 0x10]));
    }
    const totalStr = fmtRp(order.cashPayable || order.grandTotal);
    parts.push(enc(padRight('TOTAL', cols - totalStr.length) + totalStr + '\n'));
    if (store?.receiptDoubleHeight !== false) {
      parts.push(new Uint8Array([ESC, 0x21, 0x00]));
    }
    parts.push(new Uint8Array([ESC, 0x45, 0x00]));
    parts.push(enc(sep + '\n'));

    // Pembayaran
    const method = order.payment?.method || 'CASH';
    printRow('Metode Bayar:', method);
    if (method === 'CASH') {
      const received = order.payment?.cashReceived ?? (order.cashPayable || order.grandTotal);
      printRow('Uang Diterima:', fmtRp(received));
      printRow('Kembalian:', fmtRp(order.payment?.changeAmount || 0));
    }

    parts.push(enc(sep + '\n'));

    // Footer dinamis (Align & Bold)
    const footerAlignCode =
      store?.receiptFooterAlign === 'LEFT' ? 0x00 : store?.receiptFooterAlign === 'RIGHT' ? 0x02 : 0x01;
    const footerBold = Boolean(store?.receiptFooterBold);

    parts.push(new Uint8Array([ESC, 0x61, footerAlignCode]));
    if (footerBold) parts.push(new Uint8Array([ESC, 0x45, 0x01]));

    if (store?.receiptFooter && store.receiptFooter.trim()) {
      const footerLines = store.receiptFooter.split('\n');
      for (const line of footerLines) {
        if (line.trim().length > 0) {
          parts.push(enc(line + '\n'));
        }
      }
    } else {
      parts.push(enc('Terima kasih atas kunjungan Anda!\n'));
      parts.push(enc('Simpan struk sebagai bukti pembayaran.\n'));
    }

    if (footerBold) parts.push(new Uint8Array([ESC, 0x45, 0x00]));
    parts.push(new Uint8Array([ESC, 0x61, 0x00])); // reset alignment to left
  }

  // Reset font ke normal (Font A) jika sebelumnya Font B
  if (isSmallFont) {
    parts.push(new Uint8Array([ESC, 0x4D, 0x00]));
  }

  // Feed & full cut
  parts.push(new Uint8Array([ESC, 0x64, 0x05]));
  parts.push(new Uint8Array([GS, 0x56, 0x00]));

  return concat(...parts);
}

/**
 * Build ESC/POS bytes untuk CETAK TENT CARD QR MEJA (Thermal Printer)
 */
export function buildQrCardBytes({
  storeName = 'SCHAW CAFE',
  tableNumber = '01',
  menuUrl = 'http://localhost:3000/menu',
  printerWidth = 58,
}) {
  const cols = (printerWidth || 58) === 80 ? 48 : 32;
  const sep = '='.repeat(cols);
  const thinSep = '-'.repeat(cols);

  const parts = [];

  // 1. Initialize printer
  parts.push(new Uint8Array([ESC, 0x40]));

  // 2. Center alignment
  parts.push(new Uint8Array([ESC, 0x61, 0x01]));

  // 3. Store name header (Bold, Double Height)
  parts.push(new Uint8Array([ESC, 0x45, 0x01])); // bold ON
  parts.push(new Uint8Array([ESC, 0x21, 0x10])); // double height
  parts.push(enc((storeName || 'SCHAW CAFE').toUpperCase() + '\n'));
  parts.push(new Uint8Array([ESC, 0x21, 0x00])); // normal font size
  parts.push(new Uint8Array([ESC, 0x45, 0x00])); // bold OFF
  parts.push(enc('PESAN MENU DARI MEJA\n'));
  parts.push(enc(sep + '\n\n'));

  // 5. ESC/POS Standard 2D QR Code
  const qrString = String(menuUrl || 'http://localhost:3000/menu');
  const qrData = enc(qrString);
  const moduleSize = cols === 48 ? 8 : 6; // dot size per module

  // 5a. Function 165: Model 2 (49 65 50 0)
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
  // 5b. Function 167: Module size (49 67 moduleSize)
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]));
  // 5c. Function 169: Error correction Level M (49 69 49)
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]));
  // 5d. Function 180: Store data (49 80 48 data...)
  const storeLen = qrData.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  parts.push(new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]));
  parts.push(qrData);
  // 5e. Function 181: Print symbol (49 81 48)
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));

  // 6. Subtext / Instructions below QR
  parts.push(enc('\n'));
  parts.push(enc('Scan QR Code di atas\n'));
  parts.push(enc('menggunakan kamera smartphone Anda\n'));
  parts.push(enc('untuk langsung memilih menu & pesan.\n'));
  parts.push(enc(sep + '\n'));
  parts.push(enc('Selamat Menikmati Hidangan!\n'));

  // 7. Feed 5 lines & paper cut
  parts.push(new Uint8Array([ESC, 0x64, 0x05]));
  parts.push(new Uint8Array([GS, 0x56, 0x00]));

  return concat(...parts);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function BluetoothPrinterProvider({ children }) {
  const deviceRef = useRef(null);
  const charRef = useRef(null);
  const profilesRef = useRef(BLE_PROFILES[0].services); // profiles yang digunakan saat connect
  const isManualDisconnectRef = useRef(false);           // true saat user sengaja disconnect

  const [btStatus, setBtStatus] = useState('idle');
  const [btDeviceName, setBtDeviceName] = useState('');
  const [btServiceUuid, setBtServiceUuid] = useState('auto');
  const [btErrorMsg, setBtErrorMsg] = useState('');

  // ── internal: find writable characteristic ──────────────────────────────
  const findChar = useCallback(async (server, profiles) => {
    let fallback = null;
    for (const { svc, char } of profiles) {
      try {
        const service = await server.getPrimaryService(svc);
        const characteristic = await service.getCharacteristic(char);
        if (characteristic.properties.writeWithoutResponse) return characteristic;
        if (characteristic.properties.write && !fallback) fallback = characteristic;
      } catch { /* coba berikutnya */ }
    }
    return fallback;
  }, []);

  // ── internal: write bytes in 20-byte chunks ─────────────────────────────
  const writeBytes = useCallback(async (data) => {
    const ch = charRef.current;
    if (!ch) throw new Error('Printer belum terhubung.');

    const CHUNK = 20;   // BLE default MTU — JANGAN ubah
    const DELAY = 50;   // ms antar chunk

    for (let offset = 0; offset < data.length; offset += CHUNK) {
      const chunk = data.slice(offset, offset + CHUNK);
      try {
        if (ch.properties.writeWithoutResponse) {
          await ch.writeValueWithoutResponse(chunk);
        } else {
          await ch.writeValue(chunk);
        }
      } catch (e) {
        // fallback ke writeValue jika writeWithoutResponse gagal
        if (ch.properties.write) {
          await ch.writeValue(chunk);
        } else {
          throw e;
        }
      }
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }, []);

  // ── internal: auto-reconnect ke device yang sama ───────────────────────
  // Dipanggil saat gattserverdisconnected atau sebelum print jika link putus.
  // Max 5 percobaan dengan delay bertahap (1s, 2s, 3s, 4s, 5s).
  const reconnectDevice = useCallback(async (silent = false) => {
    const device = deviceRef.current;
    if (!device) return false;

    if (!silent) setBtStatus('reconnecting');

    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        const server = await device.gatt.connect();
        const char = await findChar(server, profilesRef.current);
        if (char) {
          charRef.current = char;
          setBtStatus('connected');
          if (!silent) toast.success('Printer terhubung kembali!', { icon: '🖨️' });
          return true;
        }
      } catch {
        // gagal percobaan ini, lanjut ke berikutnya
      }
    }

    // Semua percobaan gagal
    charRef.current = null;
    deviceRef.current = null;
    setBtStatus('error');
    setBtErrorMsg('Printer terputus dan gagal reconnect otomatis. Silakan hubungkan ulang secara manual.');
    setBtDeviceName('');
    toast.error('Printer terputus. Hubungkan ulang di Pengaturan.', { duration: 5000 });
    return false;
  }, [findChar]);

  // ── connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      setBtStatus('unsupported');
      setBtErrorMsg('Browser tidak mendukung Web Bluetooth API. Gunakan Chrome atau Edge.');
      return;
    }
    setBtStatus('connecting');
    setBtErrorMsg('');

    try {
      const profile = BLE_PROFILES.find((p) => p.serviceUuid === btServiceUuid);
      const profilesToTry = profile?.services || BLE_PROFILES[0].services;
      profilesRef.current = profilesToTry; // simpan untuk reconnect

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_BLE_SERVICE_UUIDS,
      });

      setBtDeviceName(device.name || 'Unknown Device');
      isManualDisconnectRef.current = false;

      // ── Auto-reconnect saat printer terputus (misal: setelah paper-cut) ──
      device.addEventListener('gattserverdisconnected', () => {
        if (isManualDisconnectRef.current) {
          // Disconnect disengaja oleh user — jangan reconnect
          deviceRef.current = null;
          charRef.current = null;
          setBtDeviceName('');
          setBtStatus('idle');
          return;
        }
        // Disconnect tidak disengaja (setelah print, firmware printer disconnect)
        // → langsung coba reconnect otomatis
        reconnectDevice(false);
      });

      const server = await device.gatt.connect();
      const char = await findChar(server, profilesToTry);

      if (!char) {
        throw new Error(
          'Tidak ditemukan BLE characteristic yang dapat ditulis. Coba pilih Service UUID Profile yang sesuai merk printer Anda.'
        );
      }

      deviceRef.current = device;
      charRef.current = char;
      setBtStatus('connected');
      toast.success(`Terhubung ke ${device.name || 'printer'}!`);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setBtStatus('idle'); // user menutup picker
      } else {
        setBtStatus('error');
        setBtErrorMsg(err.message || 'Gagal menghubungkan ke printer Bluetooth.');
        toast.error('Gagal menghubungkan: ' + (err.message || 'Unknown error'));
      }
    }
  }, [btServiceUuid, findChar, reconnectDevice]);

  // ── disconnect ──────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    setBtStatus('disconnecting');
    isManualDisconnectRef.current = true; // tandai ini disconnect disengaja
    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch { /* ignore */ }
    deviceRef.current = null;
    charRef.current = null;
    setBtDeviceName('');
    setBtStatus('idle');
    toast('Printer Bluetooth diputus.', { icon: '🔌' });
  }, []);

  // ── printBytes (public API) ─────────────────────────────────────────────
  const printBytes = useCallback(async (bytes) => {
    // Jika belum ada device sama sekali
    if (!deviceRef.current) {
      throw new Error('Printer belum terhubung. Hubungkan printer di halaman Pengaturan.');
    }

    // Jika device ada tapi GATT terputus (misal: setelah paper-cut) → reconnect dulu
    if (!deviceRef.current.gatt.connected) {
      const ok = await reconnectDevice(true); // silent=true (tidak tampilkan toast reconnect)
      if (!ok) {
        throw new Error('Gagal reconnect ke printer. Cek apakah printer menyala dan dalam jangkauan.');
      }
    }

    // Char mungkin null setelah reconnect jika findChar gagal
    if (!charRef.current) {
      throw new Error('Characteristic printer tidak ditemukan setelah reconnect.');
    }

    await writeBytes(bytes);
  }, [reconnectDevice, writeBytes]);

  const value = {
    btStatus,
    btDeviceName,
    btServiceUuid,
    btErrorMsg,
    isConnected: btStatus === 'connected' || btStatus === 'reconnecting',
    isReconnecting: btStatus === 'reconnecting',
    connect,
    disconnect,
    printBytes,
    buildReceiptBytes,
    buildQrCardBytes,
    setBtServiceUuid,
  };

  return (
    <BluetoothPrinterContext.Provider value={value}>
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useBluetooth() {
  const ctx = useContext(BluetoothPrinterContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used inside <BluetoothPrinterProvider>');
  }
  return ctx;
}
