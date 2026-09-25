'use client';

import { useState, useEffect, useTransition } from 'react';
import toast from 'react-hot-toast';
import {
  getCurrentUserProfile,
  updateOwnUsername,
  updateOwnPassword,
} from '@/app/actions/account';

// ── Reusable Password Input Component ─────────────────────────────────────────
function PasswordInput({ id, label, value, onChange, show, onToggle, placeholder, disabled, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-xs font-bold text-slate-700">
          {label}
        </label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          tabIndex={-1}
          aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function AccountSettingsPage() {
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdatingUsername, startUsernameTransition] = useTransition();
  const [isUpdatingPassword, startPasswordTransition] = useTransition();

  // ── Profile Data State ──
  const [userProfile, setUserProfile] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // ── Password Form State ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // ── Load User Profile ─────────────────────────────────────────────────────
  const loadProfile = async () => {
    setIsLoadingProfile(true);
    const res = await getCurrentUserProfile();
    if (res.error) {
      toast.error(res.error);
      setIsLoadingProfile(false);
      return;
    }

    setUserProfile(res.data);
    setUsernameInput(res.data.username || '');
    setNameInput(res.data.name || '');
    setIsLoadingProfile(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // ── Handler: Update Username & Name ───────────────────────────────────────
  const handleUpdateUsername = (e) => {
    e.preventDefault();

    const cleanUsername = usernameInput.trim().toLowerCase();
    const cleanName = nameInput.trim();

    if (!cleanUsername) {
      toast.error('Username tidak boleh kosong.');
      return;
    }

    if (cleanUsername.length < 3) {
      toast.error('Username minimal 3 karakter.');
      return;
    }

    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      toast.error('Username hanya boleh memuat huruf kecil, angka, titik, strip (-), atau underscore (_).');
      return;
    }

    if (!cleanName) {
      toast.error('Nama Lengkap tidak boleh kosong.');
      return;
    }

    startUsernameTransition(async () => {
      const toastId = toast.loading('Menyimpan perubahan username...');
      const res = await updateOwnUsername({
        newUsername: cleanUsername,
        name: cleanName,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success(res.message || 'Username & profil berhasil diperbarui!', { id: toastId });
      // Update local profile state
      if (res.data) {
        setUserProfile((prev) => ({
          ...prev,
          username: res.data.username,
          name: res.data.name,
        }));
      }
    });
  };

  // ── Handler: Update Password ──────────────────────────────────────────────
  const handleUpdatePassword = (e) => {
    e.preventDefault();

    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error('Semua field password wajib diisi.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('Password baru tidak boleh sama dengan password saat ini.');
      return;
    }

    startPasswordTransition(async () => {
      const toastId = toast.loading('Memperbarui password akun...');
      const res = await updateOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      // Reset form password secara otomatis
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);

      toast.success('Password berhasil diperbarui!', { id: toastId });

      // Jika sesi dicabut dan mewajibkan login ulang
      if (res.requireRelogin) {
        const Swal = (await import('sweetalert2')).default;
        await Swal.fire({
          icon: 'success',
          title: 'Password Berhasil Diperbarui!',
          text: 'Demi keamanan akun Anda, seluruh sesi aktif telah diakhiri. Silakan login kembali dengan password baru Anda.',
          confirmButtonText: 'Login Kembali Sekarang',
          confirmButtonColor: '#059669',
          background: '#ffffff',
          color: '#0f172a',
          allowOutsideClick: false,
        });

        window.location.href = res.redirectUrl || '/login';
      }
    });
  };

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'Kosong', color: 'bg-slate-200', textClass: 'text-slate-400' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score: 1, text: 'Lemah', color: 'bg-rose-500 w-1/3', textClass: 'text-rose-600' };
    if (score <= 4) return { score: 2, text: 'Sedang', color: 'bg-amber-500 w-2/3', textClass: 'text-amber-600' };
    return { score: 3, text: 'Sangat Kuat', color: 'bg-emerald-500 w-full', textClass: 'text-emerald-600' };
  };

  const pwStrength = getPasswordStrength(newPassword);

  if (isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-500">Memuat data akun Anda...</p>
      </div>
    );
  }

  const initials = (userProfile?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isProfileChanged =
    usernameInput.trim().toLowerCase() !== (userProfile?.username || '').toLowerCase() ||
    nameInput.trim() !== (userProfile?.name || '');

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── Page Header & User Quick Identity ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Akun</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola identitas profil, username, dan keamanan password akun Anda.
          </p>
        </div>

        {/* User Badge Info */}
        <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-2xl border border-slate-200/90 shadow-2xs self-start sm:self-auto">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-100">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 leading-none">{userProfile?.name}</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {userProfile?.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">@{userProfile?.username}</p>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Card 1: Informasi Profil & Username ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/80">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Informasi Profil & Username</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data identitas Anda pada sistem POS dan pengaturan nama pengguna.
              </p>
            </div>
          </div>

          {/* Readonly Overview Badges */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Role / Peran</span>
              <span className="text-xs font-bold text-slate-800 mt-0.5 inline-block">
                {userProfile?.role}
              </span>
              {userProfile?.roleDescription && (
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{userProfile.roleDescription}</p>
              )}
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Toko / Cabang</span>
              <span className="text-xs font-bold text-slate-800 mt-0.5 inline-block">
                {userProfile?.storeName}
              </span>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Status: Aktif</p>
            </div>
          </div>

          {/* Form Ubah Username & Nama */}
          <form onSubmit={handleUpdateUsername} className="space-y-4">
            {/* Username Input */}
            <div>
              <label htmlFor="input-username" className="block text-xs font-bold text-slate-700 mb-1.5">
                Username Akun <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  @
                </span>
                <input
                  id="input-username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="username_anda"
                  disabled={isUpdatingUsername}
                  maxLength={30}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Digunakan untuk login ke sistem POS. Karakter huruf kecil, angka, titik, dan garis bawah (_).
              </p>
            </div>

            {/* Nama Lengkap Input */}
            <div>
              <label htmlFor="input-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nama Lengkap Kasir/Admin"
                disabled={isUpdatingUsername}
                maxLength={60}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Email (Readonly) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="input-email" className="block text-xs font-bold text-slate-700">
                  Email Terdaftar
                </label>
                <span className="text-[10px] text-slate-400">Hanya dapat diubah Owner</span>
              </div>
              <input
                id="input-email"
                type="email"
                value={userProfile?.email || 'Belum diatur'}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs cursor-not-allowed"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                id="btn-save-username"
                type="submit"
                disabled={isUpdatingUsername || !isProfileChanged}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingUsername ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Menyimpan Perubahan...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Simpan Perubahan Username</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Card 2: Ganti Password ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100/80">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ganti Password</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Perbarui kata sandi untuk menjaga keamanan akun dan transaksi kasir.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {/* Password Saat Ini */}
            <PasswordInput
              id="input-current-password"
              label="Password Saat Ini *"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrentPw}
              onToggle={() => setShowCurrentPw(!showCurrentPw)}
              placeholder="Masukkan password saat ini"
              disabled={isUpdatingPassword}
            />

            {/* Password Baru */}
            <PasswordInput
              id="input-new-password"
              label="Password Baru *"
              hint="Min. 8 karakter"
              value={newPassword}
              onChange={setNewPassword}
              show={showNewPw}
              onToggle={() => setShowNewPw(!showNewPw)}
              placeholder="Ketik password baru yang kuat"
              disabled={isUpdatingPassword}
            />

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Kekuatan Password:</span>
                  <span className={`font-bold ${pwStrength.textClass}`}>{pwStrength.text}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`} />
                </div>
              </div>
            )}

            {/* Konfirmasi Password Baru */}
            <PasswordInput
              id="input-confirm-password"
              label="Konfirmasi Password Baru *"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPw}
              onToggle={() => setShowConfirmPw(!showConfirmPw)}
              placeholder="Ketik ulang password baru"
              disabled={isUpdatingPassword}
            />

            {/* Notice Sesi & Keamanan */}
            <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50/80 p-3 rounded-xl border border-amber-200/80">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>
                Demi keamanan sistem kasir, setelah password berhasil diubah Anda akan diminta untuk melakukan login ulang.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                id="btn-save-password"
                type="submit"
                disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingPassword ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Memperbarui Password...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Perbarui Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* ── Footer Tips Keamanan ─────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Praktik Keamanan Akun POS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-500">
          <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
            <span className="text-base shrink-0">🔒</span>
            <div>
              <p className="font-bold text-slate-700">Kombinasi Rumit</p>
              <p className="text-slate-500 mt-0.5">Gunakan gabungan huruf besar, kecil, angka, dan simbol untuk password.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
            <span className="text-base shrink-0">👤</span>
            <div>
              <p className="font-bold text-slate-700">Privasi Akun Kasir</p>
              <p className="text-slate-500 mt-0.5">Jangan bagikan password kepada staf lain agar riwayat transaksi akurat.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
            <span className="text-base shrink-0">🚪</span>
            <div>
              <p className="font-bold text-slate-700">Tutup Shift & Logout</p>
              <p className="text-slate-500 mt-0.5">Selalu tutup shift kasir dan keluar dari sistem saat jam kerja selesai.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
