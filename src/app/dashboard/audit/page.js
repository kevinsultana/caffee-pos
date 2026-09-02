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
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </span>
            Rekam Jejak Sistem (Audit Log)
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Catatan kekal (immutable) aktivitas keamanan, transaksi, autentikasi, dan perubahan data penting di kafe.
          </p>
        </div>

        <button
          onClick={() => loadLogs()}
          disabled={loading}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-semibold border border-stone-700 transition-all flex items-center justify-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Segarkan Log
        </button>
      </div>

      {/* Info Alert */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="font-bold text-amber-100">Prinsip Immutability:</strong> Log ini bersifat read-only dan dilindungi secara permanen. Tidak ada tombol ubah atau hapus untuk menjamin akuntabilitas seluruh tindakan pengguna dan kasir.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-stone-900/40 border border-stone-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Cari ringkasan, pengguna, atau aksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <svg className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
      </div>

      {/* Audit Log Table */}
      <div className="bg-stone-900/70 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Waktu & Tanggal</th>
                <th className="py-3.5 px-4 font-semibold">Pengguna / Petugas</th>
                <th className="py-3.5 px-4 font-semibold">Modul</th>
                <th className="py-3.5 px-4 font-semibold">Aksi</th>
                <th className="py-3.5 px-4 font-semibold">Ringkasan Aktivitas</th>
                <th className="py-3.5 px-4 font-semibold text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-stone-500 font-sans">
                    Memuat catatan Audit Log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-stone-500 font-sans">
                    Belum ada catatan aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let moduleBadge = 'bg-stone-800 text-stone-300 border-stone-700';
                  if (log.module === 'AUTH') moduleBadge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                  if (log.module === 'USER_MANAGEMENT') moduleBadge = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
                  if (log.module === 'POS') moduleBadge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  if (log.module === 'INVENTORY') moduleBadge = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
                  if (log.module === 'PURCHASING') moduleBadge = 'bg-orange-500/10 text-orange-300 border-orange-500/30';

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
                    <tr key={log.id} className="hover:bg-stone-800/30 transition-colors font-sans">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-amber-200">{timeFormatted}</p>
                        <p className="text-[11px] text-stone-500">{dateFormatted}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-amber-50">{log.user?.name}</p>
                        <p className="text-[11px] font-mono text-stone-500">
                          @{log.user?.username} <span className="text-[10px] text-amber-600 font-sans">({log.user?.roleName})</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[10px] font-bold font-mono ${moduleBadge}`}>
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-mono font-bold text-stone-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-stone-300 line-clamp-2 max-w-md">
                          {log.changeSummary || '-'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {(log.beforeData || log.afterData) ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-[11px] font-semibold transition-all"
                          >
                            Lihat Payload
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-600">-</span>
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

      {/* ─── PAYLOAD SNAPSHOT MODAL ────────────────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div>
                <h2 className="text-sm font-bold text-amber-50">
                  Detail Snapshot Audit Log
                </h2>
                <p className="text-[11px] font-mono text-stone-400 mt-0.5">
                  ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
                <p className="text-stone-400 font-semibold">Ringkasan:</p>
                <p className="text-amber-100">{selectedLog.changeSummary}</p>
              </div>

              {selectedLog.beforeData && (
                <div>
                  <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                    Data Sebelum Perubahan (Before Data)
                  </p>
                  <pre className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.beforeData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterData && (
                <div>
                  <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                    Data Setelah Perubahan (After Data)
                  </p>
                  <pre className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.afterData, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
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
