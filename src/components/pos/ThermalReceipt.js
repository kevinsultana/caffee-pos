'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Format angka ke mata uang Rupiah
 */
function formatRupiah(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(num));
}

/**
 * Format tanggal & waktu lokal
 */
function formatDateTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Komponen Khusus Pencetakan Struk Thermal (58mm / 80mm).
 * Menggunakan CSS @media print: tersembunyi di layar normal (`hidden print:block`),
 * dan hanya tampil saat proses cetak berjalan.
 *
 * @param {Object} props
 * @param {Object} props.order - Objek Order lengkap beserta items, payment, customer
 * @param {Object} props.store - Objek Store Settings (name, logoUrl, printerWidth, etc.)
 * @param {'CUSTOMER'|'KITCHEN'} props.printMode - Mode cetak ('CUSTOMER' atau 'KITCHEN')
 */
export default function ThermalReceipt({ order, store, printMode = 'CUSTOMER' }) {
  if (!order) return null;

  const isKitchen = printMode === 'KITCHEN';
  const is80mm = store?.printerWidth === 80;

  return (
    <div id="thermal-receipt-print-area" className="hidden print:block font-mono text-black">
      <div
        className={cn(
          'mx-auto p-1 leading-tight',
          is80mm ? 'w-[80mm] max-w-[80mm] text-xs' : 'w-[58mm] max-w-[58mm] text-[11px]'
        )}
      >
        {isKitchen ? (
          /* ══════════════════════════════════════════════════════════════════
             MODE KITCHEN (TIKET DAPUR):
             Font lebih besar. HANYA Nomor Antrean/Order, Waktu, Item, Catatan.
             TIDAK ADA HARGA SAMA SEKALI.
             ══════════════════════════════════════════════════════════════════ */
          <div>
            {/* Header Tiket Dapur */}
            <div className="text-center font-black text-xs sm:text-sm border-2 border-black p-1 uppercase tracking-wider mb-2">
              TIKET DAPUR / KITCHEN
            </div>

            {/* Nomor Antrean Menonjol & Besar */}
            <div className="text-center border-2 border-black rounded p-1.5 my-2">
              <div className="text-[10px] uppercase font-bold tracking-widest text-gray-700">
                NOMOR ANTREAN
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight">
                {order.queueNumber || '-'}
              </div>
            </div>

            {/* Metadata Pesanan */}
            <div className="text-[10px] sm:text-[11px] space-y-0.5 my-2">
              <div className="flex justify-between">
                <span className="text-gray-700">No. Order:</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Waktu:</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Pelanggan:</span>
                <span className="font-bold truncate max-w-[150px]">
                  {order.customerNameSnapshot || order.customer?.name || 'Umum'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Sumber:</span>
                <span className="font-bold">
                  {order.source === 'PUBLIC_QR' ? 'QR Meja Online' : 'Kasir POS'}
                </span>
              </div>
            </div>

            {/* Pembatas Tebal */}
            <div className="border-b-2 border-dashed border-black my-2" />

            {/* Daftar Pesanan Dapur (Qty, Menu, Varian, Catatan) — TANPA HARGA */}
            <div className="space-y-2.5">
              {order.items?.map((item, idx) => (
                <div key={item.id || idx} className="border-b border-gray-400 pb-2">
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm sm:text-base font-black px-1.5 py-0.5 border border-black rounded bg-white shrink-0">
                      {item.quantity}x
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-black leading-tight uppercase">
                        {item.productNameSnapshot}
                      </div>
                      {item.variantNameSnapshot && (
                        <div className="text-[11px] font-bold text-gray-800 mt-0.5">
                          Varian: {item.variantNameSnapshot}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded mt-1 inline-block">
                          Catatan: {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Penutup Tiket Dapur */}
            <div className="border-t-2 border-black pt-2 text-center text-[10px] font-bold uppercase tracking-widest mt-4">
              *** SELESAIKAN PESANAN ***
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             MODE CUSTOMER (STRUK PELANGGAN):
             Lengkap: Logo, Nama Toko, Kasir, Waktu, Item, Qty, Harga, Subtotal,
             Diskon, Pajak, Grand Total, dan Informasi Pembayaran.
             ══════════════════════════════════════════════════════════════════ */
          <div>
            {/* Logo Toko */}
            {store?.logoUrl && (
              <div className="text-center mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={store.logoUrl}
                  alt={store.name || 'Logo'}
                  className="mx-auto max-h-12 max-w-[40mm] object-contain filter grayscale"
                />
              </div>
            )}

            {/* Nama & Info Toko */}
            <div className="text-center font-bold text-xs sm:text-sm uppercase tracking-wider">
              {store?.name || 'SCHAW CAFE'}
            </div>
            <div className="text-center text-[10px] text-gray-600">
              Cabang {store?.code || 'MAIN'}
            </div>

            <div className="border-b border-dashed border-black my-1.5" />

            {/* Info Transaksi */}
            <div className="text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDateTime(order.paidAt || order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>No. Order:</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>No. Antrean:</span>
                <span className="font-bold">{order.queueNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{order.createdBy?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-semibold truncate max-w-[140px]">
                  {order.customerNameSnapshot || order.customer?.name || 'Umum'}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-black my-1.5" />

            {/* Daftar Item Menu */}
            <div className="space-y-1.5">
              {order.items?.map((item, idx) => (
                <div key={item.id || idx}>
                  <div className="font-semibold leading-tight">
                    {item.productNameSnapshot}
                    {item.variantNameSnapshot && (
                      <span className="font-normal text-[10px] text-gray-700 ml-1">
                        ({item.variantNameSnapshot})
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-[9px] italic text-gray-700 pl-1">
                      * {item.notes}
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] mt-0.5">
                    <span>
                      {item.quantity} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                  {item.promotionDiscount > 0 && (
                    <div className="flex justify-between text-[9px] text-gray-700 pl-2">
                      <span>Diskon Menu:</span>
                      <span>-{formatRupiah(item.promotionDiscount)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-black my-1.5" />

            {/* Ringkasan Finansial */}
            <div className="text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(order.productSubtotal)}</span>
              </div>

              {order.promotionDiscount > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span>Diskon Promo:</span>
                  <span>-{formatRupiah(order.promotionDiscount)}</span>
                </div>
              )}

              {order.serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Biaya Layanan ({order.serviceChargeRate}%):</span>
                  <span>{formatRupiah(order.serviceChargeAmount)}</span>
                </div>
              )}

              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Pajak (PPN {order.taxRate}%):</span>
                  <span>{formatRupiah(order.taxAmount)}</span>
                </div>
              )}

              {order.roundingAmount !== 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Pembulatan Tunai:</span>
                  <span>{formatRupiah(order.roundingAmount)}</span>
                </div>
              )}
            </div>

            {/* Garis Pembatas Total */}
            <div className="border-b border-black my-1" />

            <div className="flex justify-between text-xs sm:text-sm font-black my-0.5">
              <span>TOTAL</span>
              <span>{formatRupiah(order.cashPayable || order.grandTotal)}</span>
            </div>

            <div className="border-b border-black my-1" />

            {/* Info Pembayaran */}
            <div className="text-[10px] space-y-0.5 mt-1">
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold">{order.payment?.method || 'CASH'}</span>
              </div>

              {order.payment?.method === 'CASH' && (
                <>
                  <div className="flex justify-between">
                    <span>Uang Diterima:</span>
                    <span>
                      {formatRupiah(
                        order.payment?.cashReceived !== null &&
                          order.payment?.cashReceived !== undefined
                          ? order.payment.cashReceived
                          : order.cashPayable || order.grandTotal
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(order.payment?.changeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-b border-dashed border-black my-2" />

            {/* Footer Ucapan */}
            <div className="text-center text-[10px] space-y-0.5 text-gray-700">
              <div className="font-semibold">Terima kasih atas kunjungan Anda!</div>
              <div className="text-[9px]">Simpan struk ini sebagai bukti pembayaran yang sah.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
