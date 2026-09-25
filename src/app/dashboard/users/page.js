'use client';

import { useState, useEffect, useTransition } from 'react';
import toast from 'react-hot-toast';
import { getUsers, createUser, updateUser, deleteUser, adminResetPassword } from '@/app/actions/user';
import SearchableSelect from '@/components/ui/SearchableSelect';

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

  // Reset Password Success Modal State
  const [resetSuccessModalOpen, setResetSuccessModalOpen] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

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

  const generateRandomPassword = () => {
    const prefix = 'Schaw';
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const pass = `${prefix}@${randomPart}${randomNum}`;
    setFormData((prev) => ({ ...prev, resetPassword: pass }));
  };

  const openResetPasswordModal = (user) => {
    setModalMode('RESET_PASSWORD');
    setEditingUser(user);
    const prefix = 'Schaw';
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const initialPass = `${prefix}@${randomPart}${randomNum}`;

    setFormData({
      name: user.name,
      username: user.username,
      email: user.email || '',
      password: '',
      roleId: user.roleId || user.role?.id || '',
      status: user.status,
      resetPassword: initialPass,
    });
    setModalOpen(true);
  };

  const handleCopyPassword = () => {
    if (resetResult?.temporaryPassword) {
      navigator.clipboard.writeText(resetResult.temporaryPassword);
      setCopied(true);
      toast.success('Password sementara berhasil disalin ke clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
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
        setModalOpen(false);
        loadUsers();
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
        setModalOpen(false);
        loadUsers();
      } else if (modalMode === 'RESET_PASSWORD') {
        if (!formData.resetPassword || formData.resetPassword.length < 6) {
          toast.error('Password baru minimal 6 karakter.');
          return;
        }

        const toastId = toast.loading('Mereset password karyawan...');
        res = await adminResetPassword(editingUser.id, formData.resetPassword);

        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }

        toast.success('Password berhasil direset!', { id: toastId });
        setModalOpen(false);
        setResetResult({
          temporaryPassword: res.temporaryPassword,
          username: res.username || editingUser.username,
          name: res.name || editingUser.name,
        });
        setResetSuccessModalOpen(true);
        loadUsers();
      }
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
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        <SearchableSelect
          options={[
            { value: 'ALL', label: 'Semua Peran (Role)' },
            ...data.roles.map((r) => ({ value: r.name, label: r.name })),
          ]}
          value={filterRole}
          onChange={(val) => setFilterRole(val || 'ALL')}
          className="w-full sm:w-52"
        />

        <SearchableSelect
          options={[
            { value: 'ALL', label: 'Semua Status' },
            { value: 'ACTIVE', label: 'ACTIVE' },
            { value: 'INACTIVE', label: 'INACTIVE' },
            { value: 'RESIGNED', label: 'RESIGNED' },
          ]}
          value={filterStatus}
          onChange={(val) => setFilterStatus(val || 'ALL')}
          className="w-full sm:w-44"
        />
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
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-all cursor-pointer"
                          title="Reset Password Karyawan"
                        >
                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          Reset Password
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
                      <SearchableSelect
                        options={data.roles.map((r) => ({ value: r.id, label: r.name }))}
                        value={formData.roleId}
                        onChange={(val) => setFormData({ ...formData, roleId: val })}
                        disabled={isPending}
                        placeholder="Pilih Peran..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Status Karyawan *
                      </label>
                      <SearchableSelect
                        options={[
                          { value: 'ACTIVE', label: 'ACTIVE (Bisa Login)' },
                          { value: 'INACTIVE', label: 'INACTIVE (Dibekukan)' },
                          { value: 'RESIGNED', label: 'RESIGNED (Keluar)' },
                        ]}
                        value={formData.status}
                        onChange={(val) => setFormData({ ...formData, status: val })}
                        disabled={isPending}
                        placeholder="Pilih Status..."
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                    <p className="text-slate-500">Mereset password untuk akun:</p>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 font-mono text-sm">
                        {editingUser?.name} <span className="text-slate-500 font-normal">(@{editingUser?.username})</span>
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        {editingUser?.role?.name || 'Staff'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Password Sementara Baru *
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Acak Otomatis
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Masukkan password baru (min 6 karakter)"
                      value={formData.resetPassword}
                      onChange={(e) => setFormData({ ...formData, resetPassword: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      minLength={6}
                    />

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 mt-3 text-[11px] text-amber-800 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <span>⚠️</span> Wajib Ganti Password:
                      </p>
                      <p>
                        Setelah direset, staf akan diwajibkan membuat password baru saat pertama kali login. Seluruh sesi aktif staf ini di perangkat lain akan otomatis dibatalkan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : modalMode === 'RESET_PASSWORD' ? 'Konfirmasi Reset Password' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL SUKSES RESET PASSWORD DENGAN COPY TO CLIPBOARD ───────────── */}
      {resetSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-1">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Password Berhasil Direset!
              </h3>
              <p className="text-xs text-slate-500">
                Berikan password sementara di bawah ini kepada karyawan <strong>{resetResult?.name}</strong> (@{resetResult?.username}).
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-2 border-dashed border-emerald-300 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Password Sementara:</span>
                <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Wajib Ganti Saat Login
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="font-mono text-base font-bold text-emerald-800 tracking-wider select-all">
                  {resetResult?.temporaryPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Tersalin!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Salin
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Karyawan akan otomatis diarahkan untuk menetapkan password baru saat masuk ke sistem POS.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetSuccessModalOpen(false);
                  setResetResult(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
