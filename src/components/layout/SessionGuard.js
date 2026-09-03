'use client';

import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { verifyCurrentSession, logout } from '@/app/actions/auth';

/**
 * SessionGuard — Komponen penjaga sesi aktif tunggal (Single Active Session Guard).
 *
 * Berjalan di background dashboard untuk mendeteksi apakah sesi login pengguna
 * telah dicabut (revoked) karena akun login di perangkat/browser lain.
 * Menggunakan polling 15 detik dan event window focus / tab visibility change.
 */
export default function SessionGuard() {
  const isKickedOutRef = useRef(false);

  useEffect(() => {
    async function checkSession() {
      if (isKickedOutRef.current) return;

      try {
        const res = await verifyCurrentSession();

        if (!res.isValid && res.reason === 'REVOKED') {
          isKickedOutRef.current = true;

          // Bersihkan interval & event listener
          clearInterval(intervalId);
          window.removeEventListener('focus', handleFocus);
          document.removeEventListener('visibilitychange', handleVisibilityChange);

          // Bersihkan local storage jika ada cache lokal
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.clear();
            } catch {
              // Abaikan error storage
            }
          }

          // Tampilkan modal SweetAlert2 pemblokir layar
          Swal.fire({
            icon: 'warning',
            title: 'Sesi Berakhir',
            text: 'Akun Anda telah login di perangkat lain. Anda akan dialihkan.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#059669', // Emerald-600
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
              popup: 'rounded-2xl shadow-xl font-sans',
              confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-sm',
            },
          }).then(async () => {
            try {
              await logout();
            } catch {
              // ignore
            }
            window.location.href = '/login';
          });

          // Fallback auto-redirect setelah 6 detik jika user tidak mengklik tombol
          setTimeout(async () => {
            try {
              await logout();
            } catch {}
            window.location.href = '/login';
          }, 6000);
        }
      } catch (err) {
        console.error('[SessionGuard] Error checking session:', err);
      }
    }

    // 1. Polling setiap 15 detik
    const intervalId = setInterval(checkSession, 15000);

    // 2. Trigger saat window kembali fokus (pindah window/aplikasi)
    const handleFocus = () => {
      checkSession();
    };

    // 3. Trigger saat tab browser kembali aktif
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
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
