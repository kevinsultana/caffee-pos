'use client';

import { useState, useEffect, useTransition } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getUsers, createUser, updateUser, deleteUser } from '@/app/actions/user';

export default function UsersManagementPage() {
  const [data, setData] = useState({ users: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT' | 'RESET_PASSWORD'
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    roleId: '',
    status: 'ACTIVE',
    resetPassword: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsers();
    if (res?.error) {
      toast.error(res.error);
    } else {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setModalMode('CREATE');
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      roleId: data.roles[0]?.id || '',
      status: 'ACTIVE',
      resetPassword: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('EDIT');
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email || '',
      password: '',
      roleId: user.roleId || user.role?.id || '',
      status: user.status,
      resetPassword: '',
    });
    setModalOpen(true);
  };

  const openResetPasswordModal = (user) => {
    setModalMode('RESET_PASSWORD');
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email || '',
      password: '',
      roleId: user.roleId || user.role?.id || '',
      status: user.status,
      resetPassword: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    startTransition(async () => {
      let res;
      if (modalMode === 'CREATE') {
        const toastId = toast.loading('Menambahkan karyawan baru...');
        res = await createUser({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          roleId: formData.roleId,
          status: formData.status,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success(`Karyawan "${res.data.name}" berhasil dibuat!`, { id: toastId });
      } else if (modalMode === 'EDIT') {
        const toastId = toast.loading('Menyimpan perubahan data...');
        res = await updateUser({
          id: editingUser.id,
          name: formData.name,
          username: formData.username,
          email: formData.email,
          roleId: formData.roleId,
          status: formData.status,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success('Data karyawan berhasil diperbarui!', { id: toastId });
      } else if (modalMode === 'RESET_PASSWORD') {
        if (!formData.resetPassword || formData.resetPassword.length < 6) {
          toast.error('Password baru minimal 6 karakter.');
          return;
        }

        const toastId = toast.loading('Mereset password karyawan...');
        res = await updateUser({
          id: editingUser.id,
          password: formData.resetPassword,
          mustChangePassword: true,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success('Password berhasil direset! Pegawai diwajibkan ganti password saat login berikutnya.', {
          id: toastId,
          duration: 5000,
        });
      }

      setModalOpen(false);
      loadUsers();
    });
  };

  const handleDelete = async (user) => {
    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: 'Hapus Karyawan?',
      text: `Apakah Anda yakin ingin menghapus akun pegawai "${user.name}" (@${user.username})? Tindakan ini tidak dapat dibatalkan jika akun memiliki rekam jejak transaksi.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus data...');
        const res = await deleteUser(user.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Akun pegawai berhasil dihapus.', { id: toastId });
          loadUsers();
        }
      });
    }
  };

  const filteredUsers = data.users.filter((u) => {
    const matchQuery =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchRole = filterRole === 'ALL' || u.role?.name === filterRole;
    const matchStatus = filterStatus === 'ALL' || u.status === filterStatus;
    return matchQuery && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <Toaster position="top-right" />

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Karyawan (RBAC)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola hak akses pengguna, penetapan peran (Role-Based Access Control), dan reset password pegawai.
          </p>
        </div>

        <button
          id="btn-add-user"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          + Tambah Karyawan
        </button>
      </div>

      {/* ─── FILTERS & SEARCH ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama atau username pegawai..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Semua Peran (Role)</option>
          {data.roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="RESIGNED">RESIGNED</option>
        </select>
      </div>

      {/* ─── DATA TABLE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nama Pegawai</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Peran (Role)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Wajib Ganti Password</th>
                <th className="py-3.5 px-4">Tgl Terdaftar</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    Memuat data karyawan...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    Tidak ada data karyawan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  let roleBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (u.role?.name === 'OWNER') roleBadge = 'bg-purple-100 text-purple-800 border-purple-200 font-bold';
                  if (u.role?.name === 'MANAGER') roleBadge = 'bg-blue-100 text-blue-800 border-blue-200';
                  if (u.role?.name === 'CASHIER') roleBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  if (u.role?.name === 'INVENTORY_STAFF') roleBadge = 'bg-amber-100 text-amber-800 border-amber-200';

                  let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  if (u.status === 'INACTIVE') statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                  if (u.status === 'RESIGNED') statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        {u.email && <p className="text-[10px] text-slate-400">{u.email}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        @{u.username}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${roleBadge}`}>
                          {u.role?.name || 'No Role'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Ya (Pending)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Aktif Normal</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(u)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all"
                        >
                          Reset Pass
                        </button>
                        {u.role?.name !== 'OWNER' && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-all"
                          >
                            Hapus
                          </button>
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

      {/* ─── MODAL USER FORM ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'CREATE' && 'Tambah Akun Pegawai'}
                {modalMode === 'EDIT' && 'Edit Data Karyawan'}
                {modalMode === 'RESET_PASSWORD' && 'Reset Password Karyawan'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalMode !== 'RESET_PASSWORD' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      placeholder="contoh: Kevin Sanjaya"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Username (Login Kasir / Admin) *
                    </label>
                    <input
                      type="text"
                      placeholder="contoh: kevin"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      placeholder="contoh: kevin@schawcafe.id"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {modalMode === 'CREATE' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Password Awal *
                      </label>
                      <input
                        type="password"
                        placeholder="Minimal 6 karakter"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        disabled={isPending}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Hak Akses (Role) *
                      </label>
                      <select
                        value={formData.roleId}
                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                        disabled={isPending}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        {data.roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Status Karyawan *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        disabled={isPending}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="ACTIVE">ACTIVE (Bisa Login)</option>
                        <option value="INACTIVE">INACTIVE (Dibekukan)</option>
                        <option value="RESIGNED">RESIGNED (Keluar)</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                    <p className="text-slate-500">Mereset password untuk akun:</p>
                    <p className="font-bold text-slate-900 font-mono">
                      {editingUser?.name} (@{editingUser?.username})
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Password Sementara Baru *
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan password baru (min 6 karakter)"
                      value={formData.resetPassword}
                      onChange={(e) => setFormData({ ...formData, resetPassword: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      minLength={6}
                    />
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                      ⚠️ Pegawai akan diwajibkan untuk langsung mengganti password saat pertama kali login.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs"
                >
                  {isPending ? 'Menyimpan...' : modalMode === 'RESET_PASSWORD' ? 'Reset Password' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
