'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

/**
 * Mengambil daftar pelanggan (Customer / Member).
 */
export async function getCustomers({ query = '' } = {}) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const whereClause = { storeId };
    if (query && query.trim().length > 0) {
      const q = query.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    const serialized = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      orderCount: c._count.orders,
      createdAt: c.createdAt,
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getCustomers] Error:', error);
    return { error: error.message || 'Gagal memuat daftar pelanggan.' };
  }
}

/**
 * Menambahkan pelanggan baru.
 */
export async function createCustomer({ name, phone, email }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama pelanggan wajib diisi.' };
    }

    const cleanName = name.trim();
    const cleanPhone = phone?.trim() || null;
    const cleanEmail = email?.trim() || null;

    const customer = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          storeId,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'CREATE_CUSTOMER',
          module: 'POS',
          entityType: 'Customer',
          entityId: c.id,
          changeSummary: `Mendaftarkan pelanggan baru: ${cleanName} (${cleanPhone || 'No Phone'})`,
        },
      });

      return c;
    });

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/pos');

    return { success: true, data: customer };
  } catch (error) {
    console.error('[createCustomer] Error:', error);
    return { error: error.message || 'Gagal menambahkan pelanggan.' };
  }
}

/**
 * Memperbarui data profil pelanggan.
 */
export async function updateCustomer({ id, name, phone, email }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama pelanggan wajib diisi.' };
    }

    const target = await prisma.customer.findFirst({
      where: { id, storeId },
    });
    if (!target) return { error: 'Pelanggan tidak ditemukan.' };

    const cleanName = name.trim();
    const cleanPhone = phone?.trim() || null;
    const cleanEmail = email?.trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({
        where: { id },
        data: {
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'UPDATE_CUSTOMER',
          module: 'POS',
          entityType: 'Customer',
          entityId: id,
          changeSummary: `Memperbarui data pelanggan: ${cleanName}`,
        },
      });

      return c;
    });

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/pos');

    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateCustomer] Error:', error);
    return { error: error.message || 'Gagal memperbarui data pelanggan.' };
  }
}

/**
 * Menghapus pelanggan jika belum memiliki riwayat transaksi pesanan.
 */
export async function deleteCustomer(id) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const target = await prisma.customer.findFirst({
      where: { id, storeId },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!target) return { error: 'Pelanggan tidak ditemukan.' };

    if (target._count.orders > 0) {
      return {
        error: `Pelanggan "${target.name}" sudah memiliki riwayat ${target._count.orders} transaksi pesanan sehingga tidak dapat dihapus.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'DELETE_CUSTOMER',
          module: 'POS',
          entityType: 'Customer',
          entityId: id,
          changeSummary: `Menghapus data pelanggan: ${target.name}`,
        },
      });
    });

    revalidatePath('/dashboard/customers');
    return { success: true };
  } catch (error) {
    console.error('[deleteCustomer] Error:', error);
    return { error: error.message || 'Gagal menghapus data pelanggan.' };
  }
}
