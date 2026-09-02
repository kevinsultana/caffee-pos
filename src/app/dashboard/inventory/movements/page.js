'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getStockMovements } from '@/app/actions/purchasing';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';

const MOVEMENT_TYPE_BADGES = {
  PURCHASE: { label: 'PURCHASE (Beli)', color: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' },
  SALE: { label: 'SALE (Jual)', color: 'bg-blue-950/60 text-blue-400 border-blue-800/50' },
  ADJUSTMENT: { label: 'ADJUSTMENT', color: 'bg-purple-950/60 text-purple-400 border-purple-800/50' },
  WASTE: { label: 'WASTE (Rusak/Basi)', color: 'bg-red-950/60 text-red-400 border-red-800/50' },
  OPENING_STOCK: { label: 'OPENING (Awal)', color: 'bg-amber-950/60 text-amber-400 border-amber-800/50' },
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50">Kartu Stok & Mutasi Inventaris</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Buku besar mutasi inventaris (Read-Only ledger) untuk melacak seluruh pergerakan masuk dan keluar bahan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/purchases"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Riwayat Pembelian
          </Link>
          <Link
            href="/dashboard/inventory/items"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Daftar Stok Bahan
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Filter Bahan */}
        <div>
          <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
            Filter Bahan Baku
          </label>
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="ALL">Semua Bahan Baku ({inventoryItems.length})</option>
            {inventoryItems.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Tipe Mutasi */}
        <div>
          <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
            Tipe Mutasi
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="ALL">Semua Tipe Mutasi</option>
            <option value="PURCHASE">PURCHASE (Pembelian)</option>
            <option value="SALE">SALE (Penjualan / Kasir)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Penyesuaian Opname)</option>
            <option value="WASTE">WASTE (Bahan Rusak/Basi)</option>
            <option value="OPENING_STOCK">OPENING_STOCK (Stok Awal)</option>
          </select>
        </div>

        {/* Filter Limit */}
        <div>
          <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
            Jumlah Baris
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 bg-stone-900/80 border border-stone-800 rounded-xl text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value={50}>Tampilkan 50 data terakhir</option>
            <option value={100}>Tampilkan 100 data terakhir</option>
            <option value={200}>Tampilkan 200 data terakhir</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-300">
            <thead className="bg-stone-800/60 text-xs font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Waktu Mutasi</th>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4">Perubahan Qty</th>
                <th className="py-3 px-4">Biaya / Satuan</th>
                <th className="py-3 px-4">Total Nilai</th>
                <th className="py-3 px-4">Keterangan / Referensi</th>
                <th className="py-3 px-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
                    Memuat kartu stok...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
                    Belum ada histori pergerakan stok tercatat.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const delta = Number(m.quantityDelta);
                  const isPositive = delta > 0;
                  const unitCode = m.inventoryItem?.baseUnit?.code || '';
                  const typeBadge = MOVEMENT_TYPE_BADGES[m.type] || {
                    label: m.type,
                    color: 'bg-stone-800 text-stone-300 border-stone-700',
                  };

                  return (
                    <tr key={m.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-stone-400">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-50">
                        {m.inventoryItem?.name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border',
                            typeBadge.color
                          )}
                        >
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {isPositive ? `+${delta}` : delta} {unitCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-stone-300">
                        {formatRupiah(m.unitCost)}/{unitCode}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {formatRupiah(m.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-400 max-w-xs truncate">
                        {m.reason || m.referenceType || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-300">
                        {m.responsibleUser?.name || 'System'}
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
