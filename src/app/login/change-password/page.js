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
        confirmButtonColor: '#059669',
        background: '#ffffff',
        color: '#0f172a',
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
          },
        }}
      />

      {/* Subtle decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-125 h-125 bg-emerald-100/60 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-100 h-100 bg-slate-200/80 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        <div className="bg-white w-full p-8 space-y-6 rounded-2xl shadow-sm border border-slate-200">

          {/* Header Branding */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-900 tracking-tight">
              Wajib Ganti Password
            </h1>
            <p className="text-sm text-center text-slate-500 mt-2 max-w-xs mx-auto">
              Akun Anda baru dibuat atau baru saja di-reset oleh Owner. Anda harus membuat password pribadi baru untuk melanjutkan.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current / Temporary Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password Sementara Saat Ini *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isPending}
                className="block w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Masukkan password awal dari Owner"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password Baru Pribadi *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isPending}
                className="block w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Minimal 6 karakter"
                required
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Konfirmasi Password Baru *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                className="block w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ulangi password baru"
                required
              />
            </div>

            {/* Toggle show password */}
            <div className="flex items-center text-sm text-slate-500 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPass}
                  onChange={(e) => setShowPass(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Tampilkan karakter password
              </label>
            </div>

            {/* Actions */}
            <div className="pt-3 space-y-2.5">
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Menyimpan Password Baru...' : 'Simpan & Masuk ke Dashboard'}
              </button>

              <button
                type="button"
                onClick={handleCancelLogout}
                disabled={isPending}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
              >
                Batalkan &amp; Keluar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
