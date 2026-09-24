'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

const ALLOWED_BUCKETS = ['store-assets', 'product-images'];

/**
 * Mengambil daftar gambar dari Supabase Storage (store-assets dan/atau product-images)
 */
export async function listSupabaseStorageFiles(bucketFilter = 'all') {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  if (!isSupabaseConfigured) {
    return { error: 'Supabase Storage belum dikonfigurasi.' };
  }

  try {
    const bucketsToList = bucketFilter === 'all'
      ? ALLOWED_BUCKETS
      : ALLOWED_BUCKETS.filter((b) => b === bucketFilter);

    const allFiles = [];

    for (const bucket of bucketsToList) {
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error(`[listSupabaseStorageFiles] Error listing bucket ${bucket}:`, error);
        continue;
      }

      if (files && files.length > 0) {
        for (const f of files) {
          // Abaikan folder placeholder atau file non-gambar/tersembunyi
          if (!f.name || f.name.startsWith('.') || f.name.includes('.placeholder')) continue;

          const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(f.name);

          allFiles.push({
            name: f.name,
            bucket,
            id: f.id || `${bucket}/${f.name}`,
            size: f.metadata?.size || f.size || 0,
            mimetype: f.metadata?.mimetype || 'image/jpeg',
            createdAt: f.created_at || f.updated_at || new Date().toISOString(),
            publicUrl: publicData?.publicUrl || '',
          });
        }
      }
    }

    // Urutkan dari yang paling baru diupload
    allFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { success: true, files: allFiles };
  } catch (error) {
    console.error('[listSupabaseStorageFiles] Error:', error);
    return { error: 'Gagal memuat daftar gambar dari Supabase Storage.' };
  }
}

/**
 * Menghapus file gambar dari Supabase Storage dan membersihkan relasi di database jika ada
 */
export async function deleteSupabaseStorageFile(bucket, fileName) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  if (!isSupabaseConfigured) {
    return { error: 'Supabase Storage belum dikonfigurasi.' };
  }

  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return { error: 'Nama bucket storage tidak valid.' };
  }

  if (!fileName) {
    return { error: 'Nama file tidak boleh kosong.' };
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([fileName]);

    if (error) {
      console.error(`[deleteSupabaseStorageFile] Gagal menghapus file ${fileName} dari ${bucket}:`, error);
      return { error: `Gagal menghapus file dari storage: ${error.message}` };
    }

    // Cleanup reference di database jika file yang dihapus sedang dipakai
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    const targetUrl = publicData?.publicUrl;

    if (targetUrl) {
      // 1. Cek store logo
      await prisma.store.updateMany({
        where: { logoUrl: { contains: fileName } },
        data: { logoUrl: null },
      });

      // 2. Cek store settings (qrisImageUrl & receiptLogoUrl)
      await prisma.storeSettings.updateMany({
        where: { qrisImageUrl: { contains: fileName } },
        data: { qrisImageUrl: null },
      });

      await prisma.storeSettings.updateMany({
        where: { receiptLogoUrl: { contains: fileName } },
        data: { receiptLogoUrl: null },
      });

      // 3. Cek foto produk
      await prisma.product.updateMany({
        where: { imageUrl: { contains: fileName } },
        data: { imageUrl: null },
      });
    }

    revalidatePath('/dashboard/qr');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/products/list');
    revalidatePath('/menu');

    return {
      success: true,
      message: `File "${fileName}" berhasil dihapus secara permanen dari Supabase Storage (${bucket}).`,
    };
  } catch (error) {
    console.error('[deleteSupabaseStorageFile] Error:', error);
    return { error: 'Terjadi kesalahan sistem saat menghapus file storage.' };
  }
}

/**
 * Upload gambar baru ke Supabase Storage (bisa langsung digunakan di QR / Tent Card)
 */
export async function uploadSupabaseStorageFile(formData) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  if (!isSupabaseConfigured) {
    return { error: 'Supabase Storage belum dikonfigurasi.' };
  }

  try {
    const file = formData.get('file');
    const bucket = formData.get('bucket') || 'store-assets';

    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: 'Pilih file gambar yang valid untuk diunggah.' };
    }

    if (!file.type.startsWith('image/')) {
      return { error: 'Hanya file gambar (PNG, JPG, JPEG, WEBP) yang diperbolehkan.' };
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return { error: 'Bucket storage tidak valid.' };
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[uploadSupabaseStorageFile] Error:`, uploadError);
      return { error: `Gagal upload gambar ke Supabase: ${uploadError.message}` };
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    const publicUrl = publicData?.publicUrl || '';

    revalidatePath('/dashboard/qr');

    return {
      success: true,
      message: 'Gambar berhasil diunggah ke Supabase Storage!',
      file: {
        name: fileName,
        bucket,
        publicUrl,
        size: file.size,
        mimetype: file.type,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[uploadSupabaseStorageFile] Error:', error);
    return { error: 'Terjadi kesalahan saat mengunggah file ke storage.' };
  }
}

/**
 * Simpan logo yang dipilih sebagai logo resmi toko di database Store
 */
export async function setAsStoreLogo(logoUrl) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    await prisma.store.update({
      where: { code: 'MAIN' },
      data: { logoUrl: logoUrl || null },
    });

    revalidatePath('/dashboard/qr');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: logoUrl
        ? 'Gambar berhasil ditetapkan sebagai Logo Toko utama.'
        : 'Logo toko berhasil dikosongkan.',
    };
  } catch (error) {
    console.error('[setAsStoreLogo] Error:', error);
    return { error: 'Gagal memperbarui logo toko.' };
  }
}
