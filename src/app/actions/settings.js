'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

/**
 * Baca Store & StoreSettings untuk toko utama (MAIN).
 */
export async function getStoreSettings() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });

    if (!store) return { error: 'Store tidak ditemukan.' };

    return {
      data: {
        storeName: store.name,
        storeCode: store.code,
        logoUrl: store.logoUrl || null,
        settings: store.settings
          ? {
              id: store.settings.id,
              storeId: store.settings.storeId,
              printerWidth: store.settings.printerWidth || 58,
              taxEnabled: store.settings.taxEnabled,
              taxRate: Number(store.settings.taxRate),
              taxBaseIncludesServiceCharge: store.settings.taxBaseIncludesServiceCharge,
              serviceChargeEnabled: store.settings.serviceChargeEnabled,
              serviceChargeRate: Number(store.settings.serviceChargeRate),
              cashRoundingEnabled: store.settings.cashRoundingEnabled,
              cashRoundingUnit: Number(store.settings.cashRoundingUnit),
              timezone: store.settings.timezone,
            }
          : {
              printerWidth: 58,
              taxEnabled: false,
              taxRate: 0,
              taxBaseIncludesServiceCharge: false,
              serviceChargeEnabled: false,
              serviceChargeRate: 0,
              cashRoundingEnabled: false,
              cashRoundingUnit: 0,
              timezone: 'Asia/Jakarta',
            },
      },
    };
  } catch (error) {
    console.error('[settings/getStoreSettings]', error);
    return { error: 'Gagal memuat pengaturan.' };
  }
}

/**
 * Upload Logo Toko ke Supabase Storage (Bucket: store-assets)
 *
 * @param {FormData} formData
 */
export async function uploadStoreLogo(formData) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const file = formData.get('file') || formData.get('logo');
    if (!file || typeof file === 'string') {
      return { error: 'File logo tidak valid atau tidak ditemukan.' };
    }

    // Validasi tipe file
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'image/gif',
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return { error: 'Format file tidak didukung. Harap gunakan file PNG, JPG, WEBP, atau SVG.' };
    }

    // Validasi ukuran file (Max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { error: 'Ukuran file terlalu besar. Maksimal 5MB.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dapatkan ekstensi file
    const ext = file.name ? file.name.split('.').pop() : 'png';
    const fileName = `logo-${Date.now()}.${ext}`;
    const filePath = `store-logo/${fileName}`;
    const bucketName = 'store-assets';

    // Upload ke Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[settings/uploadStoreLogo] Supabase error:', uploadError);
      // Fallback data URI jika bucket storage belum public/dibuat di dashboard Supabase
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type};base64,${base64}`;

      const store = await prisma.store.update({
        where: { code: 'MAIN' },
        data: { logoUrl: dataUri },
      });

      revalidatePath('/dashboard/settings');
      revalidatePath('/dashboard');

      return {
        success: true,
        logoUrl: dataUri,
        message: 'Logo toko berhasil disimpan.',
      };
    }

    // Dapatkan Public URL
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl || '';

    // Simpan ke database Store
    await prisma.store.update({
      where: { code: 'MAIN' },
      data: { logoUrl: publicUrl },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return {
      success: true,
      logoUrl: publicUrl,
      message: 'Logo toko berhasil diunggah dan disimpan.',
    };
  } catch (error) {
    console.error('[settings/uploadStoreLogo]', error);
    return { error: 'Gagal mengunggah logo toko.' };
  }
}

/**
 * Hapus Logo Toko
 */
export async function removeStoreLogo() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    await prisma.store.update({
      where: { code: 'MAIN' },
      data: { logoUrl: null },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return { success: true, message: 'Logo toko berhasil dihapus.' };
  } catch (error) {
    console.error('[settings/removeStoreLogo]', error);
    return { error: 'Gagal menghapus logo toko.' };
  }
}

/**
 * Perbarui Store & StoreSettings untuk toko MAIN.
 *
 * @param {{
 *   storeName: string,
 *   logoUrl?: string|null,
 *   printerWidth?: number,
 *   taxEnabled: boolean,
 *   taxRate: number,
 *   taxBaseIncludesServiceCharge: boolean,
 *   serviceChargeEnabled: boolean,
 *   serviceChargeRate: number,
 *   cashRoundingEnabled: boolean,
 *   cashRoundingUnit: number,
 * }} payload
 */
export async function updateStoreSettings(payload) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  const {
    storeName,
    logoUrl,
    printerWidth = 58,
    taxEnabled,
    taxRate,
    taxBaseIncludesServiceCharge,
    serviceChargeEnabled,
    serviceChargeRate,
    cashRoundingEnabled,
    cashRoundingUnit,
  } = payload;

  // ── Validasi Nama Toko ───────────────────────────────────────────────
  if (!storeName || !storeName.trim()) {
    return { error: 'Nama toko tidak boleh kosong.' };
  }

  // ── Validasi Printer Width ───────────────────────────────────────────
  const validPrinterWidth = Number(printerWidth) === 80 ? 80 : 58;

  // ── Validasi nilai rate ───────────────────────────────────────────────
  if (taxEnabled && (isNaN(taxRate) || taxRate < 0 || taxRate > 100)) {
    return { error: 'Tax rate harus antara 0 – 100.' };
  }
  if (
    serviceChargeEnabled &&
    (isNaN(serviceChargeRate) || serviceChargeRate < 0 || serviceChargeRate > 100)
  ) {
    return { error: 'Service charge rate harus antara 0 – 100.' };
  }

  try {
    const store = await prisma.store.findUnique({ where: { code: 'MAIN' } });
    if (!store) return { error: 'Store tidak ditemukan.' };

    // Update data Store (name & logoUrl jika ada)
    await prisma.store.update({
      where: { id: store.id },
      data: {
        name: storeName.trim(),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
    });

    // Upsert data StoreSettings
    await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: {
        printerWidth: validPrinterWidth,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
      },
      create: {
        storeId: store.id,
        printerWidth: validPrinterWidth,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
      },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/pos');

    return { success: true, message: 'Pengaturan toko berhasil diperbarui.' };
  } catch (error) {
    console.error('[settings/updateStoreSettings]', error);
    return { error: 'Gagal menyimpan pengaturan.' };
  }
}
