'use client';

import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { verifyCurrentSession, logout } from '@/app/actions/auth';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 menit
const FOCUS_COOLDOWN_MS = 5 * 60 * 1000; // Minimal jeda 5 menit untuk trigger event focus/tab

/**
 * SessionGuard — Komponen penjaga sesi aktif tunggal (Single Active Session Guard).
 *
 * Berjalan di background dashboard untuk mendeteksi apakah sesi login pengguna
 * telah dicabut (revoked) karena akun login di perangkat/browser lain.
 * Interval polling disetel per 15 menit agar hemat kuota request API/database.
 */
export default function SessionGuard() {
  const isKickedOutRef = useRef(false);
  const lastCheckedRef = useRef(Date.now());

  useEffect(() => {
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

          // Bersihkan local/session storage jika ada cache lokal
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

    // 1. Polling setiap 15 menit
    const intervalId = setInterval(checkSession, POLL_INTERVAL_MS);

    // 2. Trigger saat window kembali fokus (dengan throttle minimal jeda 5 menit)
    const handleFocus = () => {
      if (Date.now() - lastCheckedRef.current >= FOCUS_COOLDOWN_MS) {
        checkSession();
      }
    };

    // 3. Trigger saat tab browser kembali aktif (dengan throttle minimal jeda 5 menit)
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

