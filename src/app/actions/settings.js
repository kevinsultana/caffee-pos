'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
        qrisImageUrl: store.settings?.qrisImageUrl || null,
        settings: store.settings
          ? {
              id: store.settings.id,
              storeId: store.settings.storeId,
              printerWidth: store.settings.printerWidth || 58,
              receiptShowLogo: store.settings.receiptShowLogo ?? true,
              receiptLogoUrl: store.settings.receiptLogoUrl || null,
              receiptShowStoreName: store.settings.receiptShowStoreName ?? true,
              receiptHeader: store.settings.receiptHeader || '',
              receiptHeaderAlign: store.settings.receiptHeaderAlign || 'CENTER',
              receiptHeaderBold: Boolean(store.settings.receiptHeaderBold),
              receiptFooter:
                store.settings.receiptFooter ??
                'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.',
              receiptFooterAlign: store.settings.receiptFooterAlign || 'CENTER',
              receiptFooterBold: Boolean(store.settings.receiptFooterBold),
              receiptFontSize: store.settings.receiptFontSize || 'NORMAL',
              receiptDoubleHeight: store.settings.receiptDoubleHeight ?? true,
              receiptCols: store.settings.receiptCols ?? null,
              qrisImageUrl: store.settings.qrisImageUrl || null,
              taxEnabled: store.settings.taxEnabled,
              taxRate: Number(store.settings.taxRate),
              taxBaseIncludesServiceCharge: store.settings.taxBaseIncludesServiceCharge,
              serviceChargeEnabled: store.settings.serviceChargeEnabled,
              serviceChargeRate: Number(store.settings.serviceChargeRate),
              cashRoundingEnabled: store.settings.cashRoundingEnabled,
              cashRoundingUnit: Number(store.settings.cashRoundingUnit),
              timezone: store.settings.timezone,
              maxActiveShifts: store.settings.maxActiveShifts ?? 1,
            }
          : {
              printerWidth: 58,
              receiptShowLogo: true,
              receiptLogoUrl: null,
              receiptShowStoreName: true,
              receiptHeader: '',
              receiptHeaderAlign: 'CENTER',
              receiptHeaderBold: false,
              receiptFooter: 'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.',
              receiptFooterAlign: 'CENTER',
              receiptFooterBold: false,
              receiptFontSize: 'NORMAL',
              receiptDoubleHeight: true,
              receiptCols: null,
              qrisImageUrl: null,
              taxEnabled: false,
              taxRate: 0,
              taxBaseIncludesServiceCharge: false,
              serviceChargeEnabled: false,
              serviceChargeRate: 0,
              cashRoundingEnabled: false,
              cashRoundingUnit: 0,
              timezone: 'Asia/Jakarta',
              maxActiveShifts: 1,
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

  if (!isSupabaseConfigured) {
    return {
      error:
        'Kunci API Supabase belum dikonfigurasi di file .env. Harap tambahkan SUPABASE_SERVICE_ROLE_KEY di .env.',
    };
  }

  try {
    const file = formData.get('image') || formData.get('file') || formData.get('logo');
    if (!file || typeof file === 'string') {
      return { error: 'File logo tidak valid atau tidak ditemukan.' };
    }

    // Validasi tipe file (harus berupa file gambar)
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

    // Validasi ukuran file (Maksimal 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { error: 'Ukuran file terlalu besar. Maksimal 5MB.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Buat nama file unik
    const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'logo.png';
    const fileName = `${Date.now()}-${cleanFileName}`;
    const bucketName = 'store-assets';

    // Dapatkan data store lama untuk pembersihan gambar lama
    const currentStore = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      select: { logoUrl: true },
    });

    // Upload ke Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[settings/uploadStoreLogo] Supabase Storage error:', uploadError);
      return { error: `Gagal mengunggah logo ke Supabase Storage: ${uploadError.message}` };
    }

    // Dapatkan Public URL
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    const publicUrl = publicData?.publicUrl || '';

    if (!publicUrl) {
      return { error: 'Gagal mendapatkan Public URL logo dari Supabase Storage.' };
    }

    // Simpan HANYA Public URL ke database Store (Prisma)
    await prisma.store.update({
      where: { code: 'MAIN' },
      data: { logoUrl: publicUrl },
    });

    // Cleanup: hapus gambar lama dari Supabase Storage jika sebelumnya tersimpan di store-assets
    if (currentStore?.logoUrl && currentStore.logoUrl.includes('store-assets/')) {
      try {
        const oldParts = currentStore.logoUrl.split('store-assets/');
        if (oldParts[1]) {
          const oldFilePath = decodeURIComponent(oldParts[1].split('?')[0]);
          await supabase.storage.from(bucketName).remove([oldFilePath]);
        }
      } catch (cleanErr) {
        console.warn('[settings/uploadStoreLogo] Cleanup old logo error:', cleanErr);
      }
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');

    return {
      success: true,
      logoUrl: publicUrl,
      message: 'Logo toko berhasil diunggah ke Supabase Storage.',
    };
  } catch (error) {
    console.error('[settings/uploadStoreLogo]', error);
    return { error: 'Gagal mengunggah logo toko ke storage.' };
  }
}

/**
 * Hapus Logo Toko
 */
export async function removeStoreLogo() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      select: { logoUrl: true },
    });

    if (store?.logoUrl && store.logoUrl.includes('store-assets/')) {
      try {
        const parts = store.logoUrl.split('store-assets/');
        if (parts[1]) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from('store-assets').remove([filePath]);
        }
      } catch (err) {
        console.warn('[settings/removeStoreLogo] Gagal menghapus file storage:', err);
      }
    }

    await prisma.store.update({
      where: { code: 'MAIN' },
      data: { logoUrl: null },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');

    return { success: true, message: 'Logo toko berhasil dihapus.' };
  } catch (error) {
    console.error('[settings/removeStoreLogo]', error);
    return { error: 'Gagal menghapus logo toko.' };
  }
}

/**
 * Upload Foto / Logo Khusus Struk Kasir ke Supabase Storage (Bucket: store-assets)
 *
 * @param {FormData} formData
 */
export async function uploadReceiptLogo(formData) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  if (!isSupabaseConfigured) {
    return {
      error:
        'Kunci API Supabase belum dikonfigurasi di file .env. Harap tambahkan SUPABASE_SERVICE_ROLE_KEY di .env.',
    };
  }

  try {
    const file = formData.get('image') || formData.get('file') || formData.get('logo');
    if (!file || typeof file === 'string') {
      return { error: 'File logo struk tidak valid atau tidak ditemukan.' };
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return { error: 'Format file tidak didukung. Harap gunakan file PNG, JPG, WEBP, atau SVG.' };
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { error: 'Ukuran file terlalu besar. Maksimal 5MB.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'receipt-logo.png';
    const fileName = `receipt-logo-${Date.now()}-${cleanFileName}`;
    const bucketName = 'store-assets';

    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });
    if (!store) return { error: 'Store tidak ditemukan.' };

    const currentLogo = store.settings?.receiptLogoUrl;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[settings/uploadReceiptLogo] Supabase Storage error:', uploadError);
      return { error: `Gagal mengunggah logo struk ke Supabase Storage: ${uploadError.message}` };
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    const publicUrl = publicData?.publicUrl || '';

    if (!publicUrl) {
      return { error: 'Gagal mendapatkan Public URL logo struk dari Supabase Storage.' };
    }

    await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: { receiptLogoUrl: publicUrl },
      create: {
        storeId: store.id,
        receiptLogoUrl: publicUrl,
        printerWidth: 58,
        taxEnabled: false,
        taxRate: 0,
        taxBaseIncludesServiceCharge: false,
        serviceChargeEnabled: false,
        serviceChargeRate: 0,
        cashRoundingEnabled: false,
        cashRoundingUnit: 0,
      },
    });

    if (currentLogo && currentLogo.includes('store-assets/')) {
      try {
        const oldParts = currentLogo.split('store-assets/');
        if (oldParts[1]) {
          const oldFilePath = decodeURIComponent(oldParts[1].split('?')[0]);
          await supabase.storage.from(bucketName).remove([oldFilePath]);
        }
      } catch (cleanErr) {
        console.warn('[settings/uploadReceiptLogo] Cleanup old logo error:', cleanErr);
      }
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard');

    return {
      success: true,
      receiptLogoUrl: publicUrl,
      message: 'Foto logo struk berhasil disimpan.',
    };
  } catch (error) {
    console.error('[settings/uploadReceiptLogo]', error);
    return { error: 'Gagal mengunggah foto logo struk ke storage.' };
  }
}

/**
 * Hapus Foto / Logo Khusus Struk Kasir
 */
export async function removeReceiptLogo() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });

    const receiptLogoUrl = store?.settings?.receiptLogoUrl;

    if (receiptLogoUrl && receiptLogoUrl.includes('store-assets/')) {
      try {
        const parts = receiptLogoUrl.split('store-assets/');
        if (parts[1]) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from('store-assets').remove([filePath]);
        }
      } catch (err) {
        console.warn('[settings/removeReceiptLogo] Gagal menghapus file storage:', err);
      }
    }

    if (store?.settings) {
      await prisma.storeSettings.update({
        where: { id: store.settings.id },
        data: { receiptLogoUrl: null },
      });
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard');

    return { success: true, message: 'Logo struk berhasil dihapus.' };
  } catch (error) {
    console.error('[settings/removeReceiptLogo]', error);
    return { error: 'Gagal menghapus logo struk.' };
  }
}

/**
 * Upload Barcode / Gambar QRIS Toko ke Supabase Storage (Bucket: store-assets)
 *
 * @param {FormData} formData
 */
export async function uploadQrisImage(formData) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  if (!isSupabaseConfigured) {
    return {
      error:
        'Kunci API Supabase belum dikonfigurasi di file .env. Harap tambahkan SUPABASE_SERVICE_ROLE_KEY di .env.',
    };
  }

  try {
    const file = formData.get('image') || formData.get('file') || formData.get('qris');
    if (!file || typeof file === 'string') {
      return { error: 'File gambar QRIS tidak valid atau tidak ditemukan.' };
    }

    // Validasi tipe file (harus berupa file gambar)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return { error: 'Format file tidak didukung. Harap gunakan file PNG, JPG, WEBP, atau SVG.' };
    }

    // Validasi ukuran file (Maksimal 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { error: 'Ukuran file terlalu besar. Maksimal 5MB.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Buat nama file unik
    const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'qris.png';
    const fileName = `qris-${Date.now()}-${cleanFileName}`;
    const bucketName = 'store-assets';

    // Dapatkan data store & settings saat ini
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });
    if (!store) return { error: 'Store tidak ditemukan.' };

    const currentQrisUrl = store.settings?.qrisImageUrl;

    // Upload ke Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[settings/uploadQrisImage] Supabase Storage error:', uploadError);
      return { error: `Gagal mengunggah QRIS ke Supabase Storage: ${uploadError.message}` };
    }

    // Dapatkan Public URL
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    const publicUrl = publicData?.publicUrl || '';

    if (!publicUrl) {
      return { error: 'Gagal mendapatkan Public URL QRIS dari Supabase Storage.' };
    }

    // Simpan ke StoreSettings
    await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: { qrisImageUrl: publicUrl },
      create: {
        storeId: store.id,
        qrisImageUrl: publicUrl,
        printerWidth: 58,
        taxEnabled: false,
        taxRate: 0,
        taxBaseIncludesServiceCharge: false,
        serviceChargeEnabled: false,
        serviceChargeRate: 0,
        cashRoundingEnabled: false,
        cashRoundingUnit: 0,
      },
    });

    // Cleanup gambar lama dari Supabase Storage jika sebelumnya ada
    if (currentQrisUrl && currentQrisUrl.includes('store-assets/')) {
      try {
        const oldParts = currentQrisUrl.split('store-assets/');
        if (oldParts[1]) {
          const oldFilePath = decodeURIComponent(oldParts[1].split('?')[0]);
          await supabase.storage.from(bucketName).remove([oldFilePath]);
        }
      } catch (cleanErr) {
        console.warn('[settings/uploadQrisImage] Cleanup old QRIS error:', cleanErr);
      }
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard');

    return {
      success: true,
      qrisImageUrl: publicUrl,
      message: 'Gambar QRIS toko berhasil disimpan.',
    };
  } catch (error) {
    console.error('[settings/uploadQrisImage]', error);
    return { error: 'Gagal mengunggah gambar QRIS ke storage.' };
  }
}

/**
 * Hapus Gambar QRIS Toko
 */
export async function removeQrisImage() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });

    const qrisUrl = store?.settings?.qrisImageUrl;

    if (qrisUrl && qrisUrl.includes('store-assets/')) {
      try {
        const parts = qrisUrl.split('store-assets/');
        if (parts[1]) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from('store-assets').remove([filePath]);
        }
      } catch (err) {
        console.warn('[settings/removeQrisImage] Gagal menghapus file storage:', err);
      }
    }

    if (store?.settings) {
      await prisma.storeSettings.update({
        where: { id: store.settings.id },
        data: { qrisImageUrl: null },
      });
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard');

    return { success: true, message: 'Gambar QRIS toko berhasil dihapus.' };
  } catch (error) {
    console.error('[settings/removeQrisImage]', error);
    return { error: 'Gagal menghapus gambar QRIS.' };
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
    receiptShowLogo = true,
    receiptLogoUrl,
    receiptShowStoreName = true,
    receiptHeader = '',
    receiptHeaderAlign = 'CENTER',
    receiptHeaderBold = false,
    receiptFooter = 'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.',
    receiptFooterAlign = 'CENTER',
    receiptFooterBold = false,
    receiptFontSize = 'NORMAL',
    receiptDoubleHeight = true,
    receiptCols = null,
    printerWidth = 58,
    taxEnabled,
    taxRate,
    taxBaseIncludesServiceCharge,
    serviceChargeEnabled,
    serviceChargeRate,
    cashRoundingEnabled,
    cashRoundingUnit,
    maxActiveShifts = 1,
  } = payload;

  // ── Validasi Nama Toko ───────────────────────────────────────────────
  if (!storeName || !storeName.trim()) {
    return { error: 'Nama toko tidak boleh kosong.' };
  }

  // ── Validasi Printer Width ───────────────────────────────────────────
  const validPrinterWidth = Number(printerWidth) === 80 ? 80 : 58;

  // ── Validasi Receipt Align ───────────────────────────────────────────
  const validHeaderAlign = ['LEFT', 'CENTER', 'RIGHT'].includes(receiptHeaderAlign)
    ? receiptHeaderAlign
    : 'CENTER';
  const validFooterAlign = ['LEFT', 'CENTER', 'RIGHT'].includes(receiptFooterAlign)
    ? receiptFooterAlign
    : 'CENTER';

  // ── Validasi Font Size, Double Height, Cols ──────────────────────────
  const validFontSize = receiptFontSize === 'SMALL' ? 'SMALL' : 'NORMAL';
  const validDoubleHeight = Boolean(receiptDoubleHeight);
  const parsedCols = Number(receiptCols);
  const validCols = (receiptCols !== null && receiptCols !== undefined && !isNaN(parsedCols) && parsedCols > 0)
    ? Math.min(100, Math.max(20, Math.round(parsedCols)))
    : null;

  // ── Validasi Maksimal Shift Aktif ────────────────────────────────────
  const validMaxActiveShifts = Math.max(1, parseInt(maxActiveShifts, 10) || 1);

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
        receiptShowLogo: Boolean(receiptShowLogo),
        receiptShowStoreName: Boolean(receiptShowStoreName),
        ...(receiptLogoUrl !== undefined ? { receiptLogoUrl } : {}),
        receiptHeader: receiptHeader ? String(receiptHeader).trim() : null,
        receiptHeaderAlign: validHeaderAlign,
        receiptHeaderBold: Boolean(receiptHeaderBold),
        receiptFooter: receiptFooter ? String(receiptFooter).trim() : null,
        receiptFooterAlign: validFooterAlign,
        receiptFooterBold: Boolean(receiptFooterBold),
        receiptFontSize: validFontSize,
        receiptDoubleHeight: validDoubleHeight,
        receiptCols: validCols,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
        maxActiveShifts: validMaxActiveShifts,
      },
      create: {
        storeId: store.id,
        printerWidth: validPrinterWidth,
        receiptShowLogo: Boolean(receiptShowLogo),
        receiptShowStoreName: Boolean(receiptShowStoreName),
        receiptLogoUrl: receiptLogoUrl || null,
        receiptHeader: receiptHeader ? String(receiptHeader).trim() : null,
        receiptHeaderAlign: validHeaderAlign,
        receiptHeaderBold: Boolean(receiptHeaderBold),
        receiptFooter: receiptFooter ? String(receiptFooter).trim() : null,
        receiptFooterAlign: validFooterAlign,
        receiptFooterBold: Boolean(receiptFooterBold),
        receiptFontSize: validFontSize,
        receiptDoubleHeight: validDoubleHeight,
        receiptCols: validCols,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
        maxActiveShifts: validMaxActiveShifts,
      },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/pos');
    revalidatePath('/', 'layout');

    return { success: true, message: 'Pengaturan toko berhasil diperbarui.' };
  } catch (error) {
    console.error('[settings/updateStoreSettings]', error);
    return { error: 'Gagal menyimpan pengaturan.' };
  }
}
