'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getAuditLogs } from '@/app/actions/audit';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async (mod = selectedModule) => {
    setLoading(true);
    const res = await getAuditLogs({ limit: 100, module: mod });
    if (res?.error) {
      toast.error(res.error);
    } else {
      setLogs(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs(selectedModule);
  }, [selectedModule]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      log.changeSummary?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.module?.toLowerCase().includes(q) ||
      log.user?.name?.toLowerCase().includes(q) ||
      log.user?.username?.toLowerCase().includes(q);
    return matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <Toaster position="top-right" />

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Rekam Jejak Sistem (Audit Log)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catatan kekal (immutable ledger) aktivitas keamanan, transaksi kasir, inventaris, dan perubahan data penting di kafe.
          </p>
        </div>

        <button
          onClick={() => loadLogs()}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Segarkan Log
        </button>
      </div>

      {/* ─── INFO ALERT ────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
        <svg className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-xs text-emerald-900 leading-relaxed">
          <strong className="font-bold">Prinsip Immutability:</strong> Log ini bersifat read-only dan dilindungi secara permanen. Tidak ada fitur ubah atau hapus untuk menjamin akuntabilitas seluruh tindakan pengguna dan kasir.
        </p>
      </div>

      {/* ─── FILTERS & SEARCH ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari ringkasan, pengguna, atau aksi log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Semua Modul</option>
          <option value="AUTH">AUTH (Autentikasi & Keamanan)</option>
          <option value="USER_MANAGEMENT">USER_MANAGEMENT (Karyawan & Akses)</option>
          <option value="POS">POS (Transaksi Penjualan)</option>
          <option value="INVENTORY">INVENTORY (Bahan Baku & Stok)</option>
          <option value="PURCHASING">PURCHASING (Pembelian & Supplier)</option>
          <option value="PROMOTION">PROMOTION (Diskon & Promo)</option>
          <option value="STORE_SETTINGS">STORE_SETTINGS (Pengaturan Toko)</option>
        </select>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Waktu & Tanggal</th>
                <th className="py-3.5 px-4">Pengguna / Petugas</th>
                <th className="py-3.5 px-4">Modul</th>
                <th className="py-3.5 px-4">Aksi</th>
                <th className="py-3.5 px-4">Ringkasan Aktivitas</th>
                <th className="py-3.5 px-4 text-center">Detail Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Memuat catatan Audit Log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Belum ada catatan aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let moduleBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (log.module === 'AUTH') moduleBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                  if (log.module === 'USER_MANAGEMENT') moduleBadge = 'bg-blue-100 text-blue-800 border-blue-200';
                  if (log.module === 'POS') moduleBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  if (log.module === 'INVENTORY') moduleBadge = 'bg-purple-100 text-purple-800 border-purple-200';
                  if (log.module === 'PURCHASING') moduleBadge = 'bg-orange-100 text-orange-800 border-orange-200';

                  const date = new Date(log.createdAt);
                  const timeFormatted = date.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const dateFormatted = date.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        <p className="text-xs font-bold text-slate-900">{timeFormatted}</p>
                        <p className="text-[10px] text-slate-400">{dateFormatted}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-bold text-slate-900">{log.user?.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          @{log.user?.username} <span className="text-slate-400 font-sans">({log.user?.roleName})</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${moduleBadge}`}>
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-slate-800">
                        {log.action}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-slate-600 line-clamp-2 max-w-md">
                          {log.changeSummary || '-'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {(log.beforeData || log.afterData) ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
                          >
                            Lihat Payload
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL PAYLOAD DETAILS ───────────────────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Detail Perubahan Data (Snapshot)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aksi: <strong className="font-mono text-slate-800">{selectedLog.action}</strong> oleh {selectedLog.user?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <span className="text-slate-500 font-bold uppercase text-[10px] block mb-0.5">Ringkasan Aktivitas:</span>
              {selectedLog.changeSummary}
            </div>

            {/* Before vs After Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Data */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Data Sebelum (Before)
                </span>
                <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto max-h-64 border border-slate-800">
                  {selectedLog.beforeData
                    ? JSON.stringify(selectedLog.beforeData, null, 2)
                    : '// Tidak ada data sebelumnya (Entitas Baru)'}
                </pre>
              </div>

              {/* After Data */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Data Sesudah (After)
                </span>
                <pre className="p-3.5 rounded-2xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto max-h-64 border border-slate-800">
                  {selectedLog.afterData
                    ? JSON.stringify(selectedLog.afterData, null, 2)
                    : '// Entitas Dihapus'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
