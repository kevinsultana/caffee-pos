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
        const toastId = toast.loading('Menyimpan perubahan karyawan...');
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

        const toastId = toast.loading('Mereset password...');
        res = await updateUser({
          id: editingUser.id,
          resetPassword: formData.resetPassword,
        });

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success(`Password untuk ${editingUser.name} berhasil di-reset!`, { id: toastId });
      }

      setModalOpen(false);
      loadUsers();
    });
  };

  const handleDelete = async (user) => {
    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: 'Hapus / Nonaktifkan Karyawan?',
      text: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.username})? Jika sudah memiliki transaksi, akun akan otomatis berstatus RESIGNED.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      confirmButtonText: 'Ya, Proses',
      cancelButtonText: 'Batal',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Memproses...');
        const res = await deleteUser(user.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success(res.message || 'Berhasil diproses.', { id: toastId });
          loadUsers();
        }
      });
    }
  };

  const filteredUsers = data.users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'ALL' || u.role?.name === filterRole;
    const matchStatus = filterStatus === 'ALL' || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = data.users.filter((u) => u.status === 'ACTIVE').length;
  const inactiveCount = data.users.filter((u) => u.status === 'INACTIVE' || u.status === 'RESIGNED').length;
  const changePassCount = data.users.filter((u) => u.mustChangePassword).length;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            Manajemen Karyawan (RBAC)
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Kelola akun pegawai kafe, pembagian peran akses, dan status kepegawaian.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Karyawan
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Total Akun Pegawai</p>
          <p className="text-xl font-bold font-mono text-amber-100 mt-1">{data.users.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-emerald-900/30">
          <p className="text-[11px] font-semibold text-emerald-400">Karyawan Aktif</p>
          <p className="text-xl font-bold font-mono text-emerald-300 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-rose-900/30">
          <p className="text-[11px] font-semibold text-rose-400">Non-Aktif / Resigned</p>
          <p className="text-xl font-bold font-mono text-rose-300 mt-1">{inactiveCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-amber-900/30">
          <p className="text-[11px] font-semibold text-amber-400">Wajib Ganti Password</p>
          <p className="text-xl font-bold font-mono text-amber-300 mt-1">{changePassCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-stone-900/40 border border-stone-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            placeholder="Cari nama / username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <svg className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">Semua Peran (Role)</option>
            {data.roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="RESIGNED">RESIGNED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-stone-900/70 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Nama Pegawai</th>
                <th className="py-3.5 px-4 font-semibold">Username</th>
                <th className="py-3.5 px-4 font-semibold">Peran (Role)</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Wajib Ganti Password</th>
                <th className="py-3.5 px-4 font-semibold">Tgl Dibuat</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-stone-500">
                    Memuat data karyawan...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-stone-500">
                    Tidak ada data karyawan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  let roleColor = 'bg-stone-800 text-stone-300 border-stone-700';
                  if (u.role?.name === 'OWNER') roleColor = 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-bold';
                  if (u.role?.name === 'MANAGER') roleColor = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
                  if (u.role?.name === 'CASHIER') roleColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  if (u.role?.name === 'INVENTORY_STAFF') roleColor = 'bg-purple-500/10 text-purple-300 border-purple-500/30';

                  let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  if (u.status === 'INACTIVE') statusColor = 'bg-stone-800 text-stone-400 border-stone-700';
                  if (u.status === 'RESIGNED') statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';

                  return (
                    <tr key={u.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-amber-50">{u.name}</p>
                        {u.email && <p className="text-[11px] text-stone-500">{u.email}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-300">
                        @{u.username}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] ${roleColor}`}>
                          {u.role?.name || 'No Role'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg border font-bold text-[10px] ${statusColor}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Ya (Pending)
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500">Sudah Aktif</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-[11px] font-semibold transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-[11px] font-semibold transition-all"
                          >
                            Reset Password
                          </button>
                          {u.role?.name !== 'OWNER' && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/30 text-[11px] font-semibold transition-all"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL FORM ────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h2 className="text-base font-bold text-amber-50">
                {modalMode === 'CREATE' && 'Tambah Karyawan Baru'}
                {modalMode === 'EDIT' && `Edit Karyawan: ${editingUser?.name}`}
                {modalMode === 'RESET_PASSWORD' && `Reset Password: ${editingUser?.name}`}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalMode === 'RESET_PASSWORD' ? (
                <div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mb-3">
                    Password baru ini bersifat sementara. Pegawai wajib mengganti password saat login berikutnya.
                  </div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Password Baru Sementara *
                  </label>
                  <input
                    type="text"
                    value={formData.resetPassword}
                    onChange={(e) => setFormData({ ...formData, resetPassword: e.target.value })}
                    disabled={isPending}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isPending}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={isPending}
                      placeholder="Contoh: budi.kasir"
                      className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isPending}
                      placeholder="budi@example.com"
                      className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {modalMode === 'CREATE' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                        Password Awal *
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        disabled={isPending}
                        placeholder="Minimal 6 karakter"
                        className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                      <p className="text-[11px] text-stone-500 mt-1">
                        * Karyawan wajib mengganti password ini saat pertama kali login.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                        Peran (Role) *
                      </label>
                      <select
                        value={formData.roleId}
                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                        disabled={isPending}
                        className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                        Status *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        disabled={isPending}
                        className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="RESIGNED">RESIGNED</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
