'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import { formatRupiah } from '@/lib/utils';

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
      // Periksa apakah ada shift aktif lain di toko ini dan bandingkan dengan batas toko
      const activeShifts = await prisma.shift.findMany({
        where: {
          storeId,
          status: 'OPEN',
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      });

      const storeSettings = await prisma.storeSettings.findUnique({
        where: { storeId },
        select: { maxActiveShifts: true },
      });
      const maxActiveShifts = storeSettings?.maxActiveShifts ?? 1;

      return {
        data: null,
        activeStoreShifts: activeShifts.map((s) => ({
          id: s.id,
          userName: s.user?.name || 'Kasir',
          openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : null,
        })),
        maxActiveShifts,
        isLimitReached: activeShifts.length >= maxActiveShifts,
      };
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

    // Subtotal Cash Out Operasional (non-setor) vs Setor Owner
    const cashOutOperasional = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT' && m.category !== 'SETOR_OWNER')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const cashOutSetorOwner = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT' && m.category === 'SETOR_OWNER')
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
        cashOutOperasional,
        cashOutSetorOwner,
        expectedCash,
        transactionCount: shift.payments.length,
        payments: shift.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
          changeAmount: p.changeAmount ? Number(p.changeAmount) : null,
        })),
        cashMovements: shift.cashMovements.map((m) => ({
          id: m.id,
          type: m.type,
          category: m.category || null,
          amount: Number(m.amount),
          reason: m.reason,
          receiptUrl: m.receiptUrl || null,
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
        })),
      },
    };
  } catch (error) {
    console.error('[getCurrentShift] Error:', error);
    return { error: error.message || 'Gagal memuat status shift.' };
  }
}

function formatShiftForClient(shift) {
  if (!shift) return null;
  return {
    id: shift.id,
    storeId: shift.storeId,
    userId: shift.userId,
    status: shift.status,
    openingCash: shift.openingCash != null ? Number(shift.openingCash) : 0,
    expectedCash: shift.expectedCash != null ? Number(shift.expectedCash) : null,
    actualCash: shift.actualCash != null ? Number(shift.actualCash) : null,
    difference: shift.difference != null ? Number(shift.difference) : null,
    depositedCash: shift.depositedCash != null ? Number(shift.depositedCash) : 0,
    notes: shift.notes || null,
    openedAt: shift.openedAt ? new Date(shift.openedAt).toISOString() : null,
    closedAt: shift.closedAt ? new Date(shift.closedAt).toISOString() : null,
    createdAt: shift.createdAt ? new Date(shift.createdAt).toISOString() : null,
    updatedAt: shift.updatedAt ? new Date(shift.updatedAt).toISOString() : null,
  };
}

/**
 * Buka shift kasir baru dengan modal awal (Opening Cash).
 */
export async function openShift({ openingCash }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // a. Validasi Double Shift Kasir: Cek apakah kasir yang sedang login masih memiliki shift OPEN
    const existing = await prisma.shift.findFirst({
      where: {
        storeId,
        userId: user.id,
        status: 'OPEN',
      },
    });

    if (existing) {
      return { error: 'Anda masih memiliki shift yang sedang aktif. Silakan tutup terlebih dahulu.' };
    }

    // b. Validasi Limit Toko: Cek jumlah shift aktif di storeId terhadap maxActiveShifts
    const storeSettings = await prisma.storeSettings.findUnique({
      where: { storeId },
      select: { maxActiveShifts: true },
    });
    const maxActiveShifts = storeSettings?.maxActiveShifts ?? 1;

    const currentOpenShiftsCount = await prisma.shift.count({
      where: {
        storeId,
        status: 'OPEN',
      },
    });

    if (currentOpenShiftsCount >= maxActiveShifts) {
      return {
        error: `Maksimal shift aktif bersamaan (limit: ${maxActiveShifts}) telah tercapai. Tutup shift lain terlebih dahulu.`,
      };
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
    revalidatePath('/dashboard/pos/manage-shifts');
    return {
      success: true,
      data: formatShiftForClient(shift),
    };
  } catch (error) {
    console.error('[openShift] Error:', error);
    return { error: error.message || 'Gagal membuka shift kasir.' };
  }
}

/**
 * Tutup shift kasir dengan ketentuan: HANYA ADA PILIHAN SETOR SEMUA (Setor Penuh).
 * Seluruh uang fisik di laci (actualCash) disetor ke owner/brankas (depositedCash = actualCash),
 * dan sisa uang di laci diset 0. Shift berikutnya wajib buka shift baru dengan modal awal baru.
 */
export async function closeShift({ shiftId, actualCash, notes } = {}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // ── Validasi ketat actualCash ─────────────────────────────────────────────
    if (actualCash === null || actualCash === undefined || actualCash === '') {
      return { error: 'Jumlah uang fisik aktual di laci wajib diisi.' };
    }
    const actual = Number(actualCash);
    if (!Number.isFinite(actual)) {
      return { error: 'Jumlah uang fisik aktual harus berupa angka yang valid.' };
    }
    if (actual < 0) {
      return { error: 'Jumlah uang fisik aktual tidak boleh negatif.' };
    }
    if (actual > 1_000_000_000) {
      return { error: 'Jumlah uang fisik aktual melebihi batas wajar (maks Rp 1.000.000.000).' };
    }

    // Cari shift yang akan ditutup: gunakan shiftId spesifik atau shift aktif milik kasir
    let targetShift = null;
    if (shiftId) {
      targetShift = await prisma.shift.findFirst({
        where: { id: shiftId, storeId },
        include: {
          payments: { where: { status: 'PAID' } },
          cashMovements: true,
        },
      });
    }

    if (!targetShift) {
      targetShift = await prisma.shift.findFirst({
        where: { userId: user.id, storeId, status: 'OPEN' },
        include: {
          payments: { where: { status: 'PAID' } },
          cashMovements: true,
        },
      });
    }

    if (!targetShift) {
      return { error: 'Tidak ada shift aktif yang ditemukan untuk ditutup.' };
    }

    if (targetShift.status === 'CLOSED') {
      return { error: 'Shift ini sudah dalam keadaan ditutup.' };
    }

    // Perhitungan kalkulasi kas laci:
    // expectedCash = startingCash + totalCashSales + totalCashIn - totalCashOut
    const startingCash = Number(targetShift.openingCash || 0);
    const totalCashSales = targetShift.payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalCashIn = targetShift.cashMovements
      .filter((m) => m.type === 'CASH_IN')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const totalCashOut = targetShift.cashMovements
      .filter((m) => m.type === 'CASH_OUT')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const expectedCash = startingCash + totalCashSales + totalCashIn - totalCashOut;
    const difference = actual - expectedCash;

    // Alur Setor Semua: 100% uang fisik yang dihitung kasir disetor penuh
    const depositedCash = actual;

    // Validasi catatan jika ada selisih kas
    const cleanNotes = typeof notes === 'string' ? notes.trim() : '';
    if (difference !== 0 && !cleanNotes) {
      return {
        error: `Terdapat selisih kas ${difference > 0 ? 'lebih' : 'kurang'} sebesar ${formatRupiah(Math.abs(difference))}. Catatan penutupan wajib diisi untuk menjelaskan selisih.`,
      };
    }

    const closed = await prisma.shift.update({
      where: { id: targetShift.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        expectedCash,
        actualCash: actual,
        difference,
        depositedCash,
        notes: cleanNotes || null,
      },
    });

    // Catat log audit penutupan shift
    await prisma.auditLog.create({
      data: {
        storeId,
        userId: user.id,
        action: 'CLOSE_SHIFT',
        module: 'POS',
        entityType: 'Shift',
        entityId: targetShift.id,
        changeSummary: `Kasir ${user.name} menutup shift. Fisik: ${formatRupiah(actual)}, Diharapkan: ${formatRupiah(expectedCash)}, Selisih: ${formatRupiah(difference)}, Disetor Penuh: ${formatRupiah(depositedCash)}${cleanNotes ? ` [Catatan: ${cleanNotes}]` : ''}`,
      },
    }).catch((e) => console.error('[closeShift AuditLog Error]', e));

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/pos/shift');
    revalidatePath('/dashboard/pos/manage-shifts');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: formatShiftForClient(closed),
    };
  } catch (error) {
    console.error('[closeShift] Error:', error);
    return { error: error.message || 'Gagal menutup shift kasir.' };
  }
}

/**
 * Catat Kas Masuk (CASH_IN) atau Kas Keluar (CASH_OUT) operasional di shift saat ini.
 */
export async function addCashMovement({ shiftId, type = 'CASH_OUT', amount, category, reason, notes, receiptUrl }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    let targetShift = null;
    if (shiftId) {
      targetShift = await prisma.shift.findFirst({
        where: { id: shiftId, storeId },
        include: {
          payments: {
            where: { status: 'PAID' },
            select: { method: true, amount: true },
          },
          cashMovements: true,
        },
      });
    } else {
      targetShift = await prisma.shift.findFirst({
        where: { storeId, status: 'OPEN', userId: user.id },
        include: {
          payments: {
            where: { status: 'PAID' },
            select: { method: true, amount: true },
          },
          cashMovements: true,
        },
      });
    }

    if (!targetShift) {
      return { error: 'Tidak ada shift kasir yang sedang aktif.' };
    }

    if (targetShift.status !== 'OPEN') {
      return { error: 'Shift kasir ini sudah ditutup dan tidak dapat mencatat mutasi kas.' };
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { error: 'Jumlah uang kas harus berupa angka positif.' };
    }

    const cleanReason = (reason || notes || '').trim();
    if (cleanReason.length < 3) {
      return { error: 'Keterangan/alasan pengeluaran kas wajib diisi minimal 3 karakter.' };
    }

    if (type === 'CASH_OUT') {
      if (!category?.trim()) {
        return { error: 'Kategori pengeluaran kas keluar wajib dipilih.' };
      }

      // Hitung estimasi kas fisik di laci saat ini
      const openingCash = Number(targetShift.openingCash || 0);
      const totalCashSales = targetShift.payments
        .filter((p) => p.method === 'CASH')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalCashIn = targetShift.cashMovements
        .filter((m) => m.type === 'CASH_IN')
        .reduce((sum, m) => sum + Number(m.amount), 0);
      const totalCashOut = targetShift.cashMovements
        .filter((m) => m.type === 'CASH_OUT')
        .reduce((sum, m) => sum + Number(m.amount), 0);

      const currentDrawerCash = openingCash + totalCashSales + totalCashIn - totalCashOut;
      if (numAmount > currentDrawerCash) {
        return {
          error: `Nominal kas keluar (${formatRupiah(numAmount)}) melebihi saldo kas fisik yang ada di laci (${formatRupiah(Math.max(0, currentDrawerCash))}).`,
        };
      }
    }

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.cashMovement.create({
        data: {
          storeId,
          shiftId: targetShift.id,
          userId: user.id,
          type,
          category: type === 'CASH_OUT' ? (category?.trim() || 'LAINNYA') : null,
          amount: numAmount,
          reason: cleanReason,
          receiptUrl: receiptUrl?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: type === 'CASH_IN' ? 'CASH_IN' : 'CASH_OUT',
          module: 'POS',
          entityType: 'CashMovement',
          entityId: m.id,
          changeSummary: `Kasir ${user.name} mencatat ${
            type === 'CASH_IN'
              ? 'Kas Masuk (+)'
              : `Kas Keluar (-) [Kategori: ${category || 'LAINNYA'}]`
          } sebesar ${formatRupiah(numAmount)} [Alasan: ${cleanReason}]${
            receiptUrl ? ' (Nota dilampirkan)' : ''
          }`,
        },
      });

      return m;
    });

    revalidatePath('/dashboard/pos/shift');
    revalidatePath('/dashboard/pos/cash');
    revalidatePath('/dashboard/pos/manage-shifts');
    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: {
        id: movement.id,
        type: movement.type,
        category: movement.category,
        amount: Number(movement.amount),
        reason: movement.reason,
        receiptUrl: movement.receiptUrl,
        createdAt: movement.createdAt,
      },
    };
  } catch (error) {
    console.error('[addCashMovement] Error:', error);
    return { error: error.message || 'Gagal mencatat mutasi kas.' };
  }
}

/**
 * Server Action khusus Cash Out kasir
 */
export async function recordCashOut(params) {
  return addCashMovement({ ...params, type: 'CASH_OUT' });
}

/**
 * Mengambil seluruh data shift toko dengan filter periode waktu, status, dan kasir.
 * Khusus untuk halaman "Kelola Shift" (Owner/Manager).
 */
export async function getAllShifts({
  datePreset = 'TODAY',
  startDate,
  endDate,
  status = 'ALL',
  search = '',
} = {}) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const now = new Date();
    let start = null;
    let end = null;

    if (datePreset === 'TODAY') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === 'YESTERDAY') {
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === 'LAST_7_DAYS') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (datePreset === 'CUSTOM' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const whereClause = { storeId };

    if (start && end) {
      whereClause.openedAt = { gte: start, lte: end };
    }

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search?.trim()) {
      whereClause.user = {
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { username: { contains: search.trim(), mode: 'insensitive' } },
        ],
      };
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, username: true } },
        payments: {
          where: { status: 'PAID' },
          select: { id: true, method: true, amount: true },
        },
        cashMovements: {
          select: { id: true, type: true, amount: true },
        },
      },
    });

    const serializedShifts = shifts.map((s) => {
      const openingCash = Number(s.openingCash || 0);

      const cashSales = s.payments
        .filter((p) => p.method === 'CASH')
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const qrisSales = s.payments
        .filter((p) => p.method === 'QRIS')
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const cashIn = s.cashMovements
        .filter((m) => m.type === 'CASH_IN')
        .reduce((acc, m) => acc + Number(m.amount || 0), 0);

      const cashOut = s.cashMovements
        .filter((m) => m.type === 'CASH_OUT')
        .reduce((acc, m) => acc + Number(m.amount || 0), 0);

      const expectedCash =
        s.expectedCash != null
          ? Number(s.expectedCash)
          : openingCash + cashSales + cashIn - cashOut;

      const actualCash = s.actualCash != null ? Number(s.actualCash) : null;
      const difference = s.difference != null ? Number(s.difference) : null;
      const depositedCash = s.depositedCash != null ? Number(s.depositedCash) : 0;

      return {
        id: s.id,
        status: s.status,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() || null,
        user: s.user,
        openingCash,
        cashSales,
        qrisSales,
        totalSales: cashSales + qrisSales,
        cashIn,
        cashOut,
        expectedCash,
        actualCash,
        difference,
        depositedCash,
        transactionCount: s.payments.length,
        movementCount: s.cashMovements.length,
      };
    });

    const totalOpeningCash = serializedShifts.reduce((acc, s) => acc + s.openingCash, 0);
    const totalCashSales = serializedShifts.reduce((acc, s) => acc + s.cashSales, 0);
    const totalQrisSales = serializedShifts.reduce((acc, s) => acc + s.qrisSales, 0);
    const totalDepositedCash = serializedShifts.reduce((acc, s) => acc + s.depositedCash, 0);
    const openShiftCount = serializedShifts.filter((s) => s.status === 'OPEN').length;
    const closedShiftCount = serializedShifts.filter((s) => s.status === 'CLOSED').length;

    return {
      data: {
        shifts: serializedShifts,
        stats: {
          totalShifts: serializedShifts.length,
          openShiftCount,
          closedShiftCount,
          totalOpeningCash,
          totalCashSales,
          totalQrisSales,
          totalDepositedCash,
        },
      },
    };
  } catch (error) {
    console.error('[getAllShifts] Error:', error);
    return { error: error.message || 'Gagal memuat rekap shift.' };
  }
}

/**
 * Mendapatkan detail mendalam satu shift tertentu untuk modal rincian.
 */
export async function getShiftDetail(shiftId) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, storeId },
      include: {
        user: { select: { id: true, name: true, username: true } },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                queueNumber: true,
                customerNameSnapshot: true,
                grandTotal: true,
                createdAt: true,
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
      return { error: 'Data shift tidak ditemukan.' };
    }

    const openingCash = Number(shift.openingCash || 0);

    const cashSales = shift.payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const qrisSales = shift.payments
      .filter((p) => p.method === 'QRIS')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const cashIn = shift.cashMovements
      .filter((m) => m.type === 'CASH_IN')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const cashOut = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const cashOutOperasional = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT' && m.category !== 'SETOR_OWNER')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const cashOutSetorOwner = shift.cashMovements
      .filter((m) => m.type === 'CASH_OUT' && m.category === 'SETOR_OWNER')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const expectedCash =
      shift.expectedCash != null
        ? Number(shift.expectedCash)
        : openingCash + cashSales + cashIn - cashOut;

    const actualCash = shift.actualCash != null ? Number(shift.actualCash) : null;
    const difference = shift.difference != null ? Number(shift.difference) : null;
    const depositedCash = shift.depositedCash != null ? Number(shift.depositedCash) : 0;
    const remainingInDrawer =
      actualCash != null ? Math.max(0, actualCash - depositedCash) : null;

    return {
      data: {
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() || null,
        user: shift.user,
        openingCash,
        cashSales,
        qrisSales,
        totalSales: cashSales + qrisSales,
        cashIn,
        cashOut,
        cashOutOperasional,
        cashOutSetorOwner,
        expectedCash,
        actualCash,
        difference,
        depositedCash,
        remainingInDrawer,
        notes: shift.notes || null,
        transactionCount: shift.payments.length,
        payments: shift.payments.map((p) => ({
          id: p.id,
          method: p.method,
          amount: Number(p.amount),
          cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
          changeAmount: p.changeAmount ? Number(p.changeAmount) : null,
          createdAt: p.createdAt.toISOString(),
          order: p.order
            ? {
                id: p.order.id,
                orderNumber: p.order.orderNumber,
                queueNumber: p.order.queueNumber,
                customerName: p.order.customerNameSnapshot,
                grandTotal: Number(p.order.grandTotal),
              }
            : null,
        })),
        cashMovements: shift.cashMovements.map((m) => ({
          id: m.id,
          type: m.type,
          category: m.category || null,
          amount: Number(m.amount),
          reason: m.reason,
          receiptUrl: m.receiptUrl || null,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error('[getShiftDetail] Error:', error);
    return { error: error.message || 'Gagal memuat detail shift.' };
  }
}
