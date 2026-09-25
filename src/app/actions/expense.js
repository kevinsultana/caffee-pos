'use server';

import { prisma as basePrisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

let fallbackPrisma = null;
function getDbClient() {
  if (basePrisma && basePrisma.expenseNote) {
    return basePrisma;
  }
  if (!fallbackPrisma) {
    fallbackPrisma = new PrismaClient();
  }
  return fallbackPrisma;
}

/**
 * Autentikasi sesi aktif sebelum mengeksekusi operasi pengeluaran
 */
async function getAuthenticatedUser() {
  const user = await verifySession();
  if (!user) {
    throw new Error('Sesi tidak valid. Silakan login kembali.');
  }
  return user;
}

/**
 * Helper untuk normalisasi rentang tanggal filter
 */
function parseDateFilter(startDate, endDate) {
  const dateFilter = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
  }
  return Object.keys(dateFilter).length > 0 ? dateFilter : undefined;
}

/**
 * Mengambil daftar catatan pengeluaran dengan filter tanggal & pencarian nama
 */
export async function getExpenseNotes({ startDate, endDate, search } = {}) {
  try {
    await getAuthenticatedUser();

    const where = {};
    const dateFilter = parseDateFilter(startDate, endDate);
    if (dateFilter) {
      where.date = dateFilter;
    }

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const db = getDbClient();
    const expenses = await db.expenseNote.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const serialized = expenses.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      pcs: item.pcs,
      total: Number(item.total),
      date: item.date ? item.date.toISOString() : new Date().toISOString(),
      notes: item.notes || '',
      createdAt: item.createdAt ? item.createdAt.toISOString() : null,
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error('[getExpenseNotes] Error:', error);
    return { success: false, error: error.message || 'Gagal memuat catatan pengeluaran.' };
  }
}

/**
 * Menghitung ringkasan pengeluaran (total nilai, total transaksi, rata-rata)
 */
export async function getExpenseSummary({ startDate, endDate } = {}) {
  try {
    await getAuthenticatedUser();

    const where = {};
    const dateFilter = parseDateFilter(startDate, endDate);
    if (dateFilter) {
      where.date = dateFilter;
    }

    const db = getDbClient();
    const agg = await db.expenseNote.aggregate({
      where,
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    const totalAmount = Number(agg._sum.total || 0);
    const totalCount = agg._count.id || 0;
    const averageAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

    return {
      success: true,
      data: {
        totalAmount,
        totalCount,
        averageAmount,
      },
    };
  } catch (error) {
    console.error('[getExpenseSummary] Error:', error);
    return { success: false, error: error.message || 'Gagal menghitung ringkasan pengeluaran.' };
  }
}

/**
 * Membuat catatan pengeluaran baru
 */
export async function createExpenseNote({ name, price, pcs = 1, date, notes }) {
  try {
    await getAuthenticatedUser();

    if (!name || !name.trim()) {
      return { success: false, error: 'Nama pengeluaran wajib diisi.' };
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return { success: false, error: 'Harga satuan harus berupa angka dan minimal 0.' };
    }

    const numPcs = parseInt(pcs, 10);
    if (isNaN(numPcs) || numPcs < 1) {
      return { success: false, error: 'Jumlah item (pcs) minimal 1.' };
    }

    const total = numPrice * numPcs;
    const expenseDate = date ? new Date(date) : new Date();

    const db = getDbClient();
    const created = await db.expenseNote.create({
      data: {
        name: name.trim(),
        price: numPrice,
        pcs: numPcs,
        total,
        date: expenseDate,
        notes: notes ? notes.trim() : null,
      },
    });

    revalidatePath('/dashboard/expenses');

    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        price: Number(created.price),
        pcs: created.pcs,
        total: Number(created.total),
        date: created.date.toISOString(),
        notes: created.notes || '',
      },
    };
  } catch (error) {
    console.error('[createExpenseNote] Error:', error);
    return { success: false, error: error.message || 'Gagal menyimpan catatan pengeluaran.' };
  }
}

/**
 * Memperbarui catatan pengeluaran berdasarkan ID
 */
export async function updateExpenseNote(id, { name, price, pcs = 1, date, notes }) {
  try {
    await getAuthenticatedUser();

    if (!id) {
      return { success: false, error: 'ID pengeluaran diperlukan.' };
    }

    if (!name || !name.trim()) {
      return { success: false, error: 'Nama pengeluaran wajib diisi.' };
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return { success: false, error: 'Harga satuan harus berupa angka dan minimal 0.' };
    }

    const numPcs = parseInt(pcs, 10);
    if (isNaN(numPcs) || numPcs < 1) {
      return { success: false, error: 'Jumlah item (pcs) minimal 1.' };
    }

    const total = numPrice * numPcs;
    const expenseDate = date ? new Date(date) : new Date();

    const db = getDbClient();
    const updated = await db.expenseNote.update({
      where: { id },
      data: {
        name: name.trim(),
        price: numPrice,
        pcs: numPcs,
        total,
        date: expenseDate,
        notes: notes ? notes.trim() : null,
      },
    });

    revalidatePath('/dashboard/expenses');

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        price: Number(updated.price),
        pcs: updated.pcs,
        total: Number(updated.total),
        date: updated.date.toISOString(),
        notes: updated.notes || '',
      },
    };
  } catch (error) {
    console.error('[updateExpenseNote] Error:', error);
    return { success: false, error: error.message || 'Gagal memperbarui catatan pengeluaran.' };
  }
}

/**
 * Menghapus catatan pengeluaran berdasarkan ID
 */
export async function deleteExpenseNote(id) {
  try {
    await getAuthenticatedUser();

    if (!id) {
      return { success: false, error: 'ID pengeluaran diperlukan.' };
    }

    const db = getDbClient();
    await db.expenseNote.delete({
      where: { id },
    });

    revalidatePath('/dashboard/expenses');

    return { success: true };
  } catch (error) {
    console.error('[deleteExpenseNote] Error:', error);
    return { success: false, error: error.message || 'Gagal menghapus catatan pengeluaran.' };
  }
}
