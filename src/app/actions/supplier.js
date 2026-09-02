'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

export async function getSuppliers() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const suppliers = await prisma.supplier.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    return { data: suppliers };
  } catch (error) {
    console.error('[getSuppliers] Error:', error);
    return { error: error.message || 'Gagal memuat daftar supplier.' };
  }
}

export async function createSupplier({ name, phone, address }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama supplier wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.supplier.findUnique({
      where: { storeId_name: { storeId, name: cleanName } },
    });

    if (existing) {
      return { error: `Supplier dengan nama "${cleanName}" sudah ada.` };
    }

    const supplier = await prisma.supplier.create({
      data: {
        storeId,
        name: cleanName,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      },
    });

    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true, data: supplier };
  } catch (error) {
    console.error('[createSupplier] Error:', error);
    return { error: error.message || 'Gagal menambahkan supplier.' };
  }
}

export async function updateSupplier(id, { name, phone, address }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama supplier wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.supplier.findFirst({
      where: {
        storeId,
        name: cleanName,
        NOT: { id },
      },
    });

    if (existing) {
      return { error: `Supplier dengan nama "${cleanName}" sudah ada.` };
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: cleanName,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      },
    });

    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateSupplier] Error:', error);
    return { error: error.message || 'Gagal memperbarui supplier.' };
  }
}

export async function deleteSupplier(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const supplier = await prisma.supplier.findFirst({
      where: { id, storeId },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    if (!supplier) {
      return { error: 'Supplier tidak ditemukan.' };
    }

    if (supplier._count.purchases > 0) {
      return {
        error: `Supplier "${supplier.name}" tidak dapat dihapus karena memiliki riwayat ${supplier._count.purchases} transaksi pembelian.`,
      };
    }

    await prisma.supplier.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true };
  } catch (error) {
    console.error('[deleteSupplier] Error:', error);
    return { error: error.message || 'Gagal menghapus supplier.' };
  }
}
