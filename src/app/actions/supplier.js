'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

export const getCachedSuppliers = async (storeId) => {
  return await prisma.supplier.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { purchases: true },
      },
    },
  });
};

export async function getSuppliers() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();
    const suppliers = await getCachedSuppliers(storeId);
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

    revalidateTag('suppliers', 'max');
    revalidatePath('/dashboard/inventory/suppliers');
    revalidatePath('/dashboard/inventory/purchases/create');
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

    revalidateTag('suppliers', 'max');
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

    revalidateTag('suppliers', 'max');
    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true };
  } catch (error) {
    console.error('[deleteSupplier] Error:', error);
    return { error: error.message || 'Gagal menghapus supplier.' };
  }
}

/**
 * Mengambil detail data Supplier beserta riwayat transaksi pembelian (PO) dan item barangnya.
 * Dibatasi maksimal 50 transaksi terakhir untuk efisiensi performa.
 */
export async function getSupplierPurchaseHistory(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const supplier = await prisma.supplier.findFirst({
      where: { id, storeId },
      include: {
        purchases: {
          orderBy: { purchasedAt: 'desc' },
          take: 50,
          include: {
            createdBy: {
              select: { id: true, name: true, username: true },
            },
            items: {
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    name: true,
                    category: { select: { id: true, name: true } },
                    baseUnit: { select: { id: true, name: true, code: true } },
                  },
                },
                purchaseUnit: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        },
      },
    });

    if (!supplier) {
      return { error: 'Supplier tidak ditemukan.' };
    }

    const serializedPurchases = supplier.purchases.map((p) => ({
      ...p,
      purchasedAt: p.purchasedAt?.toISOString?.() || null,
      createdAt: p.createdAt?.toISOString?.() || null,
      updatedAt: p.updatedAt?.toISOString?.() || null,
      totalAmount: p.totalAmount != null ? Number(p.totalAmount) : 0,
      items: (p.items || []).map((it) => ({
        ...it,
        quantity: it.quantity != null ? Number(it.quantity) : 0,
        unitPrice: it.unitPrice != null ? Number(it.unitPrice) : 0,
        baseQuantity: it.baseQuantity != null ? Number(it.baseQuantity) : 0,
        baseUnitCost: it.baseUnitCost != null ? Number(it.baseUnitCost) : 0,
        subtotal: it.subtotal != null ? Number(it.subtotal) : 0,
      })),
    }));

    return {
      data: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
        createdAt: supplier.createdAt?.toISOString?.() || null,
        updatedAt: supplier.updatedAt?.toISOString?.() || null,
        purchases: serializedPurchases,
      },
    };
  } catch (error) {
    console.error('[getSupplierPurchaseHistory] Error:', error);
    return { error: error.message || 'Gagal memuat riwayat pembelian supplier.' };
  }
}
