'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useBluetooth, BLE_PROFILES, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';
import { cn } from '@/lib/utils';

/**
 * Modal Koneksi Cepat & Uji Coba Printer Bluetooth (Web Bluetooth BLE)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Status buka/tutup modal
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {string} [props.userName] - Nama user/kasir untuk struk test
 * @param {Function} [props.onConnectedContinue] - Callback opsional saat printer terhubung dan kasir ingin lanjut transaksi
 * @param {Function} [props.onProceedWithoutPrinter] - Callback opsional jika kasir ingin lanjut transaksi tanpa printer
 * @param {string} [props.continueButtonText] - Teks tombol lanjut (default: 'Lanjutkan Transaksi & Cetak')
 */
export default function BluetoothModal({
  isOpen,
  onClose,
  userName = 'Kasir',
  onConnectedContinue,
  onProceedWithoutPrinter,
  continueButtonText = 'Lanjutkan Konfirmasi & Cetak Struk',
}) {
  const {
    btStatus,
    btDeviceName,
    btServiceUuid,
    setBtServiceUuid,
    btErrorMsg,
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    printBytes,
  } = useBluetooth();

  const [isTestPrinting, setIsTestPrinting] = useState(false);

  if (!isOpen) return null;

  const handleTestPrint = async () => {
    if (!isConnected) {
      toast.error('Printer belum terhubung.');
      return;
    }
    setIsTestPrinting(true);
    const toastId = toast.loading('Mengirim data test print ke printer...');
    try {
      const testOrder = {
        orderNumber: 'TEST-001',
        queueNumber: 'A-00',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        customerNameSnapshot: 'Test Print',
        createdBy: { name: userName || 'Kasir' },
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
      const storeInfo = { name: 'SCHAW CAFE', printerWidth: 58, code: 'MAIN' };
      const bytes = buildReceiptBytes(testOrder, storeInfo, 'CUSTOMER');
      await printBytes(bytes);
      toast.success('Struk test berhasil dicetak!', { id: toastId });
    } catch (err) {
      toast.error('Gagal mencetak: ' + (err.message || 'Cek koneksi Bluetooth.'), { id: toastId });
    } finally {
      setIsTestPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Koneksi Printer Bluetooth</h3>
              <p className="text-[11px] text-slate-500">Web Bluetooth BLE Quick Connect</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notifikasi jika dibuka dari alur checkout */}
        {onConnectedContinue && !isConnected && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span>⚠️</span>
              <span>Printer Belum Terhubung</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Hubungkan printer thermal Bluetooth Anda sekarang agar struk transaksi dapat langsung dicetak otomatis.
            </p>
          </div>
        )}

        {/* Status Card */}
        <div className={cn(
          'p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs',
          isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isReconnecting
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : btStatus === 'connecting'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            {isConnected ? (
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            ) : isReconnecting ? (
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            ) : btStatus === 'connecting' ? (
              <svg className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold truncate">
                {isConnected
                  ? btDeviceName || 'Printer Terhubung'
                  : isReconnecting
                    ? 'Reconnecting otomatis...'
                    : btStatus === 'connecting'
                      ? 'Sedang menghubungkan...'
                      : 'Printer Belum Terhubung'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isConnected ? 'Siap digunakan untuk cetak struk kasir' : 'Klik tombol di bawah untuk memilih printer Bluetooth'}
              </p>
            </div>
          </div>

          {isConnected && (
            <button
              type="button"
              onClick={disconnect}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors shrink-0 cursor-pointer"
            >
              Putus
            </button>
          )}
        </div>

        {/* Error Alert */}
        {(btStatus === 'error' || btStatus === 'unsupported') && btErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{btErrorMsg}</span>
          </div>
        )}

        {/* Action Button: Scan & Connect */}
        {!isConnected && (
          <button
            type="button"
            onClick={connect}
            disabled={btStatus === 'connecting' || isReconnecting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            Scan &amp; Hubungkan Printer
          </button>
        )}

        {/* Tombol Lanjut saat sudah terhubung (Checkout Mode) */}
        {isConnected && onConnectedContinue && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onConnectedContinue();
            }}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🖨️</span>
            <span>{continueButtonText}</span>
          </button>
        )}

        {/* Test Print (jika terhubung) */}
        {isConnected && (
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTestPrinting}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTestPrinting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Mencetak Struk Test...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Cetak Struk Test Percobaan
              </>
            )}
          </button>
        )}

        {/* Profile UUID Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            BLE Service Profile (UUID)
          </label>
          <select
            value={btServiceUuid}
            onChange={(e) => {
              setBtServiceUuid(e.target.value);
              if (isConnected) disconnect();
            }}
            disabled={btStatus === 'connecting' || isReconnecting}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {BLE_PROFILES.map((p) => (
              <option key={p.serviceUuid} value={p.serviceUuid}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Opsi Lanjut Tanpa Printer jika dalam mode checkout */}
        {!isConnected && onProceedWithoutPrinter && (
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                onProceedWithoutPrinter();
              }}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Lanjutkan Transaksi Tanpa Printer &rarr;
            </button>
          </div>
        )}

        {/* Footer info & Link */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <Link
            href="/dashboard/settings"
            onClick={onClose}
            className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
          >
            Pengaturan Kertas &amp; Toko &rarr;
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
