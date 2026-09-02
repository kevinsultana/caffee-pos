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
 * Mendapatkan informasi shift kasir yang sedang aktif (OPEN) untuk user yang login.
 */
export async function getCurrentShift() {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const shift = await prisma.shift.findFirst({
      where: {
        storeId,
        userId: user.id,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
        payments: {
          where: { status: 'PAID' },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                queueNumber: true,
                customerNameSnapshot: true,
              },
            },
          },
        },
        cashMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shift) {
      return { data: null };
    }

    // Hitung ringkasan kas fisik
    const openingCash = Number(shift.openingCash);

    // Cash sales
    const cashSales = shift.payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // QRIS sales (tercatat tapi bukan kas fisik laci)
    const qrisSales = shift.payments
      .filter((p) => p.method === 'QRIS')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Cash In
    const cashIn = shift.cashMovements
      .filter((m) => m.type === 'CASH_IN')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    // Cash Out
    const cashOut = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    // Expected Cash = Modal Awal + Penjualan Tunai + Kas Masuk - Kas Keluar
    const expectedCash = openingCash + cashSales + cashIn - cashOut;

    return {
      data: {
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt,
        user: shift.user,
        openingCash,
        cashSales,
        qrisSales,
        totalSales: cashSales + qrisSales,
        cashIn,
        cashOut,
        expectedCash,
        transactionCount: shift.payments.length,
        payments: shift.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
          changeAmount: p.changeAmount ? Number(p.changeAmount) : null,
        })),
        cashMovements: shift.cashMovements.map((m) => ({
          ...m,
          amount: Number(m.amount),
        })),
      },
    };
  } catch (error) {
    console.error('[getCurrentShift] Error:', error);
    return { error: error.message || 'Gagal memuat status shift.' };
  }
}

/**
 * Buka shift kasir baru dengan modal awal (Opening Cash).
 */
export async function openShift({ openingCash }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // Check if user already has an active OPEN shift
    const existing = await prisma.shift.findFirst({
      where: {
        storeId,
        userId: user.id,
        status: 'OPEN',
      },
    });

    if (existing) {
      return { error: 'Anda masih memiliki sesi shift kasir yang sedang aktif.' };
    }

    const initialCash = Number(openingCash);
    if (isNaN(initialCash) || initialCash < 0) {
      return { error: 'Modal awal kasir (Opening Cash) harus berupa angka valid non-negatif.' };
    }

    const shift = await prisma.shift.create({
      data: {
        storeId,
        userId: user.id,
        status: 'OPEN',
        openingCash: initialCash,
      },
    });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/pos/shift');
    return { success: true, data: shift };
  } catch (error) {
    console.error('[openShift] Error:', error);
    return { error: error.message || 'Gagal membuka shift kasir.' };
  }
}

/**
 * Tutup shift kasir dengan memasukkan uang fisik aktual (Actual Cash).
 */
export async function closeShift({ actualCash }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const shiftRes = await getCurrentShift();
    if (!shiftRes.data) {
      return { error: 'Tidak ada shift aktif yang ditemukan untuk ditutup.' };
    }

    const currentShift = shiftRes.data;
    const actual = Number(actualCash);

    if (isNaN(actual) || actual < 0) {
      return { error: 'Jumlah uang fisik aktual di laci harus diisi dengan benar.' };
    }

    const expected = currentShift.expectedCash;
    const difference = actual - expected;

    const closed = await prisma.shift.update({
      where: { id: currentShift.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        expectedCash: expected,
        actualCash: actual,
        difference: difference,
      },
    });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/pos/shift');
    return {
      success: true,
      data: {
        ...closed,
        expectedCash: expected,
        actualCash: actual,
        difference: difference,
      },
    };
  } catch (error) {
    console.error('[closeShift] Error:', error);
    return { error: error.message || 'Gagal menutup shift kasir.' };
  }
}

/**
 * Catat Kas Masuk (CASH_IN) atau Kas Keluar (CASH_OUT) operasional di shift saat ini.
 */
export async function addCashMovement({ type, amount, reason }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const shiftRes = await getCurrentShift();
    if (!shiftRes.data) {
      return { error: 'Tidak ada shift aktif.' };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { error: 'Jumlah uang kas harus berupa angka positif.' };
    }

    if (!reason?.trim()) {
      return { error: 'Keterangan/alasan pergerakan kas wajib diisi.' };
    }

    const movement = await prisma.cashMovement.create({
      data: {
        storeId,
        shiftId: shiftRes.data.id,
        userId: user.id,
        type,
        amount: numAmount,
        reason: reason.trim(),
      },
    });

    revalidatePath('/dashboard/pos/shift');
    return { success: true, data: movement };
  } catch (error) {
    console.error('[addCashMovement] Error:', error);
    return { error: error.message || 'Gagal mencatat mutasi kas.' };
  }
}
