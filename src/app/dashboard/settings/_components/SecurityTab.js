'use client';

import { useState, useTransition } from 'react';
import toast from 'react-hot-toast';
import { SettingsCard } from './SharedComponents';
import { changeOwnPassword } from '@/app/actions/auth';

function PasswordInput({ id, label, value, onChange, show, onToggle, placeholder, disabled }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3.5 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          tabIndex={-1}
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

export default function SecurityTab() {
  const [isPending, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleChangePassword = (e) => {
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

    startTransition(async () => {
      const toastId = toast.loading('Memperbarui password akun Anda...');
      const res = await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res?.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.dismiss(toastId);

      const Swal = (await import('sweetalert2')).default;
      await Swal.fire({
        icon: 'success',
        title: 'Password Berhasil Diubah!',
        text: 'Demi keamanan, sesi akun Anda telah diakhiri. Silakan login kembali menggunakan password baru Anda.',
        confirmButtonText: 'Login Kembali Sekarang',
        confirmButtonColor: '#059669',
        background: '#ffffff',
        color: '#0f172a',
        allowOutsideClick: false,
      });

      window.location.href = '/login';
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Ubah Password Akun ──────────────────────── */}
      <SettingsCard
        title="Ubah Password Akun"
        description="Perbarui password akun admin/kasir Anda untuk keamanan akses sistem POS."
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordInput
            id="input-current-password"
            label="Password Saat Ini *"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPw}
            onToggle={() => setShowCurrentPw(!showCurrentPw)}
            placeholder="Masukkan password saat ini"
            disabled={isPending}
          />
          <PasswordInput
            id="input-new-password"
            label="Password Baru * (min. 8 karakter)"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPw}
            onToggle={() => setShowNewPw(!showNewPw)}
            placeholder="Masukkan password baru"
            disabled={isPending}
          />
          <PasswordInput
            id="input-confirm-password"
            label="Konfirmasi Password Baru *"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPw}
            onToggle={() => setShowConfirmPw(!showConfirmPw)}
            placeholder="Ulangi password baru"
            disabled={isPending}
          />

          {/* Password Strength Indicator */}
          {newPassword.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Kekuatan Password</span>
                <span className={`text-[11px] font-bold ${newPassword.length >= 12 ? 'text-emerald-600' : newPassword.length >= 8 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {newPassword.length >= 12 ? 'Kuat' : newPassword.length >= 8 ? 'Sedang' : 'Lemah'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    newPassword.length >= 12 ? 'bg-emerald-500 w-full' : newPassword.length >= 8 ? 'bg-amber-500 w-2/3' : 'bg-rose-500 w-1/3'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Menyimpan...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Ubah Password
                </>
              )}
            </button>
          </div>
        </form>
      </SettingsCard>

      {/* ── Keamanan Sesi & Tips ─────────────────────── */}
      <SettingsCard
        title="Tips Keamanan Akun"
        description="Panduan menjaga keamanan akses sistem kasir POS kafe Anda."
      >
        <div className="space-y-3">
          {[
            {
              icon: '🔒',
              title: 'Gunakan password yang kuat',
              desc: 'Minimal 12 karakter, kombinasi huruf besar, kecil, angka, dan simbol.',
            },
            {
              icon: '🔄',
              title: 'Ganti password secara berkala',
              desc: 'Disarankan mengganti password setiap 3 bulan sekali.',
            },
            {
              icon: '👥',
              title: 'Jangan bagikan password',
              desc: 'Setiap kasir sebaiknya memiliki akun terpisah untuk audit trail.',
            },
            {
              icon: '🚪',
              title: 'Logout setelah shift selesai',
              desc: 'Selalu logout dari sistem POS setelah shift kasir berakhir.',
            },
          ].map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-base shrink-0 mt-0.5">{tip.icon}</span>
              <div>
                <p className="text-xs font-bold text-slate-800">{tip.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
