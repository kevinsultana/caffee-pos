'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Swal from 'sweetalert2';
import { verifyCurrentSession, logout } from '@/app/actions/auth';

/**
 * SessionGuard — Komponen penjaga sesi aktif yang sangat hemat resource (On-Demand).
 *
 * Efisiensi kerja server:
 * - TIDAK ADA background polling berkala (setInterval 100% dihapus).
 * - Verifikasi sesi dijalankan saat berpindah halaman (perubahan pathname).
 * - Saat user melakukan aksi (POST/GET/PUT/DELETE), Server Actions secara otomatis
 *   memvalidasi sesi di database secara on-demand.
 * - Jika sesi terdeteksi tidak valid / dicabut, cookie & storage langsung dibersihkan
 *   dan user dialihkan ke halaman login.
 */
export default function SessionGuard() {
  const pathname = usePathname();
  const isKickedOutRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    async function handleKickOut() {
      if (isKickedOutRef.current) return;
      isKickedOutRef.current = true;

      const cleanupAndRedirect = async () => {
        try {
          // 1. Panggil Server Action logout untuk memastikan sesi bersih di sisi server
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
          // 4. Hard redirect ke route handler pembersih sesi
          window.location.replace('/api/auth/clear-session');
        }
      };

      // Tampilkan modal peringatan SweetAlert2
      Swal.fire({
        icon: 'warning',
        title: 'Sesi Telah Berakhir',
        text: 'Akun Anda telah login di perangkat lain atau sesi telah kedaluwarsa. Anda dialihkan ke halaman login.',
        confirmButtonText: 'Login Kembali',
        confirmButtonColor: '#059669',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: 'rounded-2xl shadow-xl font-sans',
          confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-sm',
        },
      }).then(cleanupAndRedirect);

      // Fallback otomatis jika pengguna tidak mengklik tombol
      setTimeout(cleanupAndRedirect, 3500);
    }

    async function checkSessionOnNavigation() {
      if (isKickedOutRef.current) return;

      try {
        const res = await verifyCurrentSession();
        if (!res.isValid && res.reason === 'REVOKED') {
          handleKickOut();
        }
      } catch (err) {
        console.error('[SessionGuard] Error verifying session on navigation:', err);
      }
    }

    // Jalankan cek sesi HANYA saat berpindah halaman
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      checkSessionOnNavigation();
    }

    // Dengarkan event global dari aksi Server jika ada respons sesi revoked
    const onSessionRevoked = () => handleKickOut();
    window.addEventListener('schaw:session-revoked', onSessionRevoked);

    return () => {
      window.removeEventListener('schaw:session-revoked', onSessionRevoked);
    };
  }, [pathname]);

  return null;
}
