'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error('Username dan password tidak boleh kosong.', { id: 'validation' });
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(username.trim(), password);

      if (result?.error) {
        toast.error(result.error, {
          id: 'login-error',
          duration: 4000,
        });
        return;
      }

      if (result?.success) {
        // Dynamically import SweetAlert2 to avoid SSR issues
        const Swal = (await import('sweetalert2')).default;

        if (result.mustChangePassword) {
          await Swal.fire({
            icon: 'warning',
            title: 'Wajib Ganti Password!',
            text: `Halo ${username}, akun Anda wajib mengganti password sementara sebelum mengakses sistem.`,
            confirmButtonText: 'Ganti Password Sekarang',
            confirmButtonColor: '#b45309',
            background: '#1c1917',
            color: '#fef3c7',
          });
          router.push('/login/change-password');
          return;
        }

        await Swal.fire({
          icon: 'success',
          title: 'Login Berhasil!',
          text: `Selamat datang kembali, ${username}.`,
          confirmButtonText: 'Mulai',
          confirmButtonColor: '#b45309',
          background: '#1c1917',
          color: '#fef3c7',
          timer: 2000,
          timerProgressBar: true,
        });
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan. Silakan coba lagi.', { id: 'login-error' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Toast provider */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#292524',
            color: '#fef3c7',
            border: '1px solid #44403c',
            borderRadius: '12px',
            fontSize: '14px',
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1c1917' },
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#1c1917' },
          },
        }}
      />

      {/* Background */}
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 relative overflow-hidden">

        {/* Decorative background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-900/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-800/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-stone-900/40 rounded-full blur-3xl" />
        </div>

        {/* Login Card */}
        <div className="relative w-full max-w-md">

          {/* Glow border wrapper */}
          <div className="absolute -inset-0.5 bg-linear-to-br from-amber-700/50 via-amber-900/30 to-stone-800/50 rounded-2xl blur-sm" />

          <div className="relative bg-stone-900/90 backdrop-blur-xl border border-stone-700/50 rounded-2xl shadow-2xl overflow-hidden">

            {/* Top accent bar */}
            <div className="h-1 bg-linear-to-r from-amber-700 via-amber-500 to-amber-700" />

            <div className="p-8">

              {/* Logo & Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-900/40 border border-amber-700/30 mb-4 shadow-lg">
                  <svg
                    className="w-8 h-8 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.121m-3 0a2.25 2.25 0 01-1.5-2.121V3.104m3 0c.25.023.5.05.75.082M19.5 14.5l-4.091-4.09a2.25 2.25 0 00-.659-1.592V3.104m0 0a24.301 24.301 0 00-4.5 0M15 19.5h.75a2.25 2.25 0 002.25-2.25V14.5m-9 5h-.75A2.25 2.25 0 013 17.25V14.5"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-amber-50 tracking-tight">
                  Schaw Cafe
                </h1>
                <p className="text-stone-400 text-sm mt-1">
                  Point of Sale — Staff Login
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Username Input */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      placeholder="Masukkan username"
                      className="w-full pl-10 pr-4 py-3 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      placeholder="Masukkan password"
                      className="w-full pl-10 pr-12 py-3 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    />
                    {/* Show/hide password toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isLoading}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-500 hover:text-stone-300 transition-colors disabled:opacity-50"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? (
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

                {/* Submit Button */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 rounded-xl font-semibold text-sm
                    bg-linear-to-r from-amber-700 to-amber-600
                    hover:from-amber-600 hover:to-amber-500
                    text-white shadow-lg shadow-amber-900/30
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-stone-900
                    flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      {/* Spinner */}
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      <span>Masuk</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <p className="text-center text-xs text-stone-600 mt-8">
                Hanya untuk akses staf resmi Schaw Cafe
              </p>
            </div>
          </div>

          {/* Version badge */}
          <p className="text-center text-xs text-stone-700 mt-4">
            Schaw POS v1.0 &middot; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}
