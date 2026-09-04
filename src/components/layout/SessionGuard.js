'use client';

import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { verifyCurrentSession, logout } from '@/app/actions/auth';

const POLL_INTERVAL_MS = 20 * 1000; // Cek setiap 20 detik
const FOCUS_COOLDOWN_MS = 5 * 1000; // Minimal jeda 5 detik untuk event focus/tab aktif

/**
 * SessionGuard — Komponen penjaga sesi aktif tunggal (Single Active Session Guard).
 *
 * Berjalan di background dashboard untuk mendeteksi secara real-time apakah sesi login
 * pengguna telah dicabut (revoked) karena akun login di perangkat/browser lain.
 */
export default function SessionGuard() {
  const isKickedOutRef = useRef(false);
  const lastCheckedRef = useRef(0);

  useEffect(() => {
    lastCheckedRef.current = Date.now();

    async function checkSession() {
      if (isKickedOutRef.current) return;
      lastCheckedRef.current = Date.now();

      try {
        const res = await verifyCurrentSession();

        if (!res.isValid && res.reason === 'REVOKED') {
          isKickedOutRef.current = true;

          // Bersihkan interval & event listener
          clearInterval(intervalId);
          window.removeEventListener('focus', handleFocus);
          document.removeEventListener('visibilitychange', handleVisibilityChange);

          const cleanupAndRedirect = async () => {
            try {
              // 1. Eksekusi Server Action logout untuk membersihkan sesi di server & cookie
              await logout();
            } catch (err) {
              console.error('[SessionGuard] Error calling logout:', err);
            }

            // 2. Pembersihan cookie browser lokal jika ada sisa
            if (typeof document !== 'undefined') {
              document.cookie = 'schaw_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
            }

            // 3. Bersihkan storage lokal & session storage
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.clear();
                localStorage.clear();
              } catch {
                // Abaikan error storage
              }
              // 4. Hard redirect ke route handler pembersih sesi untuk menghindari cache router
              window.location.replace('/api/auth/clear-session');
            }
          };

          // Tampilkan modal SweetAlert2 pemblokir layar
          Swal.fire({
            icon: 'warning',
            title: 'Sesi Telah Berakhir',
            text: 'Akun Anda telah login di perangkat lain. Anda akan dialihkan ke halaman login.',
            confirmButtonText: 'Login Kembali',
            confirmButtonColor: '#059669', // Emerald-600
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
              popup: 'rounded-2xl shadow-xl font-sans',
              confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-sm',
            },
          }).then(cleanupAndRedirect);

          // Fallback auto-redirect setelah 4 detik jika user tidak mengklik tombol
          setTimeout(cleanupAndRedirect, 4000);
        }
      } catch (err) {
        console.error('[SessionGuard] Error checking session:', err);
      }
    }

    // 1. Polling setiap 20 detik
    const intervalId = setInterval(checkSession, POLL_INTERVAL_MS);

    // 2. Trigger saat window kembali fokus
    const handleFocus = () => {
      if (Date.now() - lastCheckedRef.current >= FOCUS_COOLDOWN_MS) {
        checkSession();
      }
    };

    // 3. Trigger saat tab browser kembali aktif
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckedRef.current >= FOCUS_COOLDOWN_MS) {
        checkSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
