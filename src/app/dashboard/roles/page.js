'use client';

import { useState, useEffect, useTransition } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getRoles, createRole, updateRole, deleteRole } from '@/app/actions/role';
import { MENU_PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export default function RolesManagementPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedRole, setSelectedRole] = useState(null);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // Load data
  const loadRoles = async () => {
    setLoading(true);
    const res = await getRoles();
    if (res?.error) {
      toast.error(res.error);
    } else {
      setRoles(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  // Filter roles
  const filteredRoles = roles.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  // Group permissions by category for clear UI presentation
  const groupedPermissions = MENU_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const openCreateModal = () => {
    setModalMode('CREATE');
    setSelectedRole(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setModalOpen(true);
  };

  const openEditModal = (role) => {
    if (role.name === 'OWNER') {
      toast.error('Role OWNER adalah sistem root admin dan hak aksesnya tidak dapat diubah.');
      return;
    }
    setModalMode('EDIT');
    setSelectedRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedPermissions(role.permissions || []);
    setModalOpen(true);
  };

  const togglePermission = (code) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAll = () => {
    setSelectedPermissions(MENU_PERMISSIONS.map((p) => p.code));
  };

  const handleClearAll = () => {
    setSelectedPermissions([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast.error('Nama peran wajib diisi.');
      return;
    }

    startTransition(async () => {
      let res;
      if (modalMode === 'CREATE') {
        res = await createRole({
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: selectedPermissions,
        });
      } else {
        res = await updateRole(selectedRole.id, {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: selectedPermissions,
        });
      }

      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          modalMode === 'CREATE'
            ? `Peran "${roleName}" berhasil dibuat!`
            : `Peran "${roleName}" berhasil diperbarui!`
        );
        setModalOpen(false);
        loadRoles();
      }
    });
  };

  const handleDelete = async (role) => {
    if (role.name === 'OWNER') {
      toast.error('Role OWNER adalah sistem root admin dan tidak dapat dihapus.');
      return;
    }
    if (role.isSystem) {
      toast.error(`Role bawaan sistem "${role.name}" tidak dapat dihapus.`);
      return;
    }
    if (role.userCount > 0) {
      toast.error(
        `Role "${role.name}" tidak dapat dihapus karena masih digunakan oleh ${role.userCount} karyawan.`
      );
      return;
    }

    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: `Hapus Peran "${role.name}"?`,
      text: 'Peran kustom ini akan dihapus permanen dari sistem.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus Peran',
      cancelButtonText: 'Batal',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const res = await deleteRole(role.id);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success(`Peran "${role.name}" berhasil dihapus.`);
          loadRoles();
        }
      });
    }
  };

  // Helper to find label by permission code
  const getPermissionLabel = (code) => {
    const p = MENU_PERMISSIONS.find((item) => item.code === code);
    return p ? p.label : code;
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Peran &amp; Hak Akses (RBAC)
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Atur hak akses menu secara spesifik. Karyawan hanya dapat melihat dan membuka menu yang diizinkan oleh peran mereka.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Peran Baru
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Cari nama peran atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Memuat daftar peran...</p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <p>Tidak ada peran yang ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Nama Peran</th>
                  <th className="py-3 px-5">Karyawan</th>
                  <th className="py-3 px-5">Hak Akses Menu</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRoles.map((role) => {
                  const isOwner = role.name === 'OWNER';
                  return (
                    <tr key={role.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name & Badge */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {role.name}
                            </span>
                            {isOwner ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                👑 Root Admin
                              </span>
                            ) : role.isSystem ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Sistem
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Kustom
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-slate-400 text-xs">{role.description}</p>
                          )}
                        </div>
                      </td>

                      {/* User Count */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          {role.userCount} Orang
                        </span>
                      </td>

                      {/* Permissions Badges */}
                      <td className="py-4 px-5 max-w-md">
                        {isOwner ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                            ⭐ Akses Penuh ke Seluruh Menu
                          </span>
                        ) : role.permissions && role.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {role.permissions.slice(0, 4).map((pCode) => (
                              <span
                                key={pCode}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/80"
                              >
                                {getPermissionLabel(pCode)}
                              </span>
                            ))}
                            {role.permissions.length > 4 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                +{role.permissions.length - 4} menu lainnya
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">
                            Tidak memiliki akses menu
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isOwner ? (
                            <span className="text-[11px] text-slate-400 italic py-1 px-2">
                              Terkunci (Root)
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => openEditModal(role)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              {!role.isSystem && role.userCount === 0 && (
                                <button
                                  onClick={() => handleDelete(role)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Hapus
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL CREATE / EDIT ROLE ───────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {modalMode === 'CREATE' ? 'Tambah Peran Baru' : `Edit Peran: ${selectedRole?.name}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tentukan nama peran dan centang menu-menu yang boleh dibuka oleh karyawan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Input Role Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Peran / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Contoh: Admin Gudang, Kasir Senior, Barista"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    required
                  />
                </div>

                {/* Input Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi Peran <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="Contoh: Mengelola penerimaan barang dan opname stok gudang"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Permissions Checkbox Matrix */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        Hak Akses Menu (Permissions)
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Centang menu yang diizinkan untuk dibuka oleh pengguna dengan peran ini.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                        {selectedPermissions.length} / {MENU_PERMISSIONS.length} Dipilih
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Hapus Semua
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <div
                        key={category}
                        className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5"
                      >
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Grup: {category}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.code);
                            return (
                              <label
                                key={perm.code}
                                className={cn(
                                  'flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none',
                                  isChecked
                                    ? 'bg-white border-emerald-500 shadow-2xs'
                                    : 'bg-white/60 border-slate-200 hover:bg-white'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm.code)}
                                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    {perm.label}
                                  </p>
                                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                                    {perm.description}
                                  </p>
                                  <code className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded mt-1 inline-block">
                                    {perm.defaultRoute}
                                  </code>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Peran'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
