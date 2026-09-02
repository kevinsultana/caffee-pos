'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { changeFirstTimePassword, logout } from '@/app/actions/auth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Semua kolom password wajib diisi.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('Password baru tidak boleh sama dengan password lama/sementara.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Memperbarui password...');
      const result = await changeFirstTimePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (result?.error) {
        toast.error(result.error, { id: toastId });
        return;
      }

      const Swal = (await import('sweetalert2')).default;
      await Swal.fire({
        icon: 'success',
        title: 'Password Berhasil Diperbarui!',
        text: 'Akun Anda sekarang aman. Silakan masuk ke Dashboard.',
        confirmButtonText: 'Lanjutkan ke Dashboard',
        confirmButtonColor: '#b45309',
        background: '#1c1917',
        color: '#fef3c7',
      });

      router.push('/dashboard');
    });
  };

  const handleCancelLogout = () => {
    startTransition(async () => {
      await logout();
      router.push('/login');
    });
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-amber-600 selection:text-white">
      <Toaster position="top-center" />

      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-amber-800/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-amber-600 to-amber-800 text-white shadow-xl shadow-amber-950/60 mb-4 border border-amber-500/30">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-50 sm:text-3xl">
            Wajib Ganti Password
          </h1>
          <p className="mt-2 text-xs text-stone-400 max-w-xs mx-auto">
            Akun Anda baru dibuat atau baru saja di-reset oleh Owner. Anda harus membuat password pribadi baru untuk melanjutkan.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-stone-900/90 backdrop-blur-md border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current / Temporary Password */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Password Sementara Saat Ini *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Masukkan password awal dari Owner"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Password Baru Pribadi *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Minimal 6 karakter"
                required
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Konfirmasi Password Baru *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Ulangi password baru"
                required
              />
            </div>

            {/* Toggle show password */}
            <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPass}
                  onChange={(e) => setShowPass(e.target.checked)}
                  className="rounded bg-stone-800 border-stone-700 text-amber-600 focus:ring-amber-500"
                />
                Tampilkan karakter password
              </label>
            </div>

            {/* Actions */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
              >
                {isPending ? 'Menyimpan Password Baru...' : 'Simpan & Masuk ke Dashboard'}
              </button>

              <button
                type="button"
                onClick={handleCancelLogout}
                disabled={isPending}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 rounded-xl font-semibold text-xs transition-all"
              >
                Batalkan & Keluar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
