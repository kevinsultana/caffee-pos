'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getStockMovements } from '@/app/actions/purchasing';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';

const MOVEMENT_TYPE_BADGES = {
  PURCHASE: { label: 'PURCHASE (Beli)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  SALE: { label: 'SALE (Jual)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ADJUSTMENT: { label: 'ADJUSTMENT', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  WASTE: { label: 'WASTE (Rusak)', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  OPENING_STOCK: { label: 'OPENING (Awal)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedItem, setSelectedItem] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [limit, setLimit] = useState(100);

  async function loadData() {
    setLoading(true);
    const [movRes, itemsRes] = await Promise.all([
      getStockMovements({ inventoryItemId: selectedItem, type: selectedType, limit }),
      getInventoryItems(),
    ]);

    if (movRes.error) toast.error(movRes.error);
    else setMovements(movRes.data || []);

    if (itemsRes.data) setInventoryItems(itemsRes.data);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [selectedItem, selectedType, limit]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Kartu Stok & Mutasi Inventaris
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Buku besar mutasi inventaris (Read-Only ledger) untuk melacak seluruh pergerakan masuk dan keluar bahan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/inventory/purchases"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Riwayat Pembelian
          </Link>
          <Link
            href="/dashboard/inventory/items"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Daftar Stok Bahan
          </Link>
        </div>
      </div>

      {/* ─── FILTERS ──────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Bahan Baku
          </label>
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Bahan Baku ({inventoryItems.length})</option>
            {inventoryItems.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Tipe Mutasi
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Tipe Mutasi</option>
            <option value="PURCHASE">PURCHASE (Penerimaan Beli)</option>
            <option value="SALE">SALE (Penjualan Kasir)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Stock Opname)</option>
            <option value="WASTE">WASTE (Bahan Rusak)</option>
            <option value="OPENING_STOCK">OPENING_STOCK (Saldo Awal)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Batas Tampilan
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value={50}>50 Mutasi Terakhir</option>
            <option value={100}>100 Mutasi Terakhir</option>
            <option value={250}>250 Mutasi Terakhir</option>
          </select>
        </div>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Waktu Transaksi</th>
                <th className="py-3.5 px-4">Nama Bahan</th>
                <th className="py-3.5 px-4">Tipe Mutasi</th>
                <th className="py-3.5 px-4 text-right">Perubahan Qty</th>
                <th className="py-3.5 px-4 text-right">Biaya Satuan (WAC)</th>
                <th className="py-3.5 px-4 text-right">Total Nilai</th>
                <th className="py-3.5 px-4">Referensi & Alasan</th>
                <th className="py-3.5 px-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    Memuat buku besar mutasi inventaris...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    Tidak ada catatan mutasi stok yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = Number(m.quantityDelta) > 0;
                  const badge = MOVEMENT_TYPE_BADGES[m.type] || {
                    label: m.type,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 text-xs">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                        {m.inventoryItem?.name}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={cn(
                            'inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                            badge.color
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-3.5 px-4 text-right font-bold text-xs',
                          isPositive ? 'text-emerald-700' : 'text-rose-600'
                        )}
                      >
                        {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}{' '}
                        {m.inventoryItem?.baseUnit?.code}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-900 font-semibold">
                        {formatRupiah(m.unitCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-900 font-bold">
                        {formatRupiah(m.totalCost)}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-slate-600">
                        <span className="font-semibold text-slate-800">{m.referenceType || '-'}</span>
                        {m.reason && (
                          <span className="text-slate-400 block text-[10px]">
                            {m.reason}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-slate-500">
                        {m.responsibleUser?.name || 'Sistem'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
