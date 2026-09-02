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
 * Mengambil daftar bahan baku beserta saldo sistem saat ini untuk formulir Stock Opname.
 */
export async function getOpnameItems() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const items = await prisma.inventoryItem.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        category: true,
        baseUnit: true,
        balance: true,
      },
    });

    const serialized = items.map((it) => ({
      id: it.id,
      name: it.name,
      categoryName: it.category?.name || 'Uncategorized',
      baseUnitCode: it.baseUnit?.code || '',
      systemQuantity: it.balance ? Number(it.balance.quantity) : 0,
      averageCost: it.balance ? Number(it.balance.averageCost) : 0,
      minimumStock: it.minimumStock ? Number(it.minimumStock) : null,
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getOpnameItems] Error:', error);
    return { error: error.message || 'Gagal memuat data stock opname.' };
  }
}

/**
 * Eksekusi penyesuaian Stock Opname:
 * Jika kuantitas fisik != kuantitas sistem, buat StockMovement bertipe ADJUSTMENT
 * dan perbarui saldo InventoryBalance secara atomic.
 */
export async function recordStockOpname({
  inventoryItemId,
  physicalQuantity,
  reason = 'Stock Opname Fisik',
}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const physQty = Number(physicalQuantity);
    if (isNaN(physQty)) {
      return { error: 'Kuantitas fisik harus berupa angka yang valid.' };
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, storeId },
      include: { balance: true, baseUnit: true },
    });

    if (!item) {
      return { error: 'Bahan baku tidak ditemukan.' };
    }

    const currentQty = item.balance ? Number(item.balance.quantity) : 0;
    const currentAvgCost = item.balance ? Number(item.balance.averageCost) : 0;
    const deltaQty = physQty - currentQty;

    if (deltaQty === 0) {
      return {
        success: true,
        message: 'Kuantitas fisik sama dengan saldo sistem. Tidak ada perubahan saldo.',
        data: { difference: 0 },
      };
    }

    const newStockValue = physQty * currentAvgCost;

    await prisma.$transaction(async (tx) => {
      // 1. Update/Upsert InventoryBalance
      await tx.inventoryBalance.upsert({
        where: { inventoryItemId },
        update: {
          quantity: physQty,
          stockValue: newStockValue,
        },
        create: {
          inventoryItemId,
          quantity: physQty,
          averageCost: currentAvgCost,
          stockValue: newStockValue,
        },
      });

      // 2. Buat StockMovement (ADJUSTMENT)
      await tx.stockMovement.create({
        data: {
          storeId,
          inventoryItemId,
          type: 'ADJUSTMENT',
          quantityDelta: deltaQty,
          unitCost: currentAvgCost,
          totalCost: Math.abs(deltaQty) * currentAvgCost,
          referenceType: 'STOCK_OPNAME',
          reason: reason.trim() || 'Stock Opname Fisik',
          responsibleUserId: user.id,
        },
      });
    });

    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/movements');
    revalidatePath('/dashboard/inventory/opname');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: {
        itemName: item.name,
        unitCode: item.baseUnit?.code,
        previousQty: currentQty,
        physicalQty: physQty,
        difference: deltaQty,
      },
    };
  } catch (error) {
    console.error('[recordStockOpname] Error:', error);
    return { error: error.message || 'Gagal menyimpan penyesuaian stock opname.' };
  }
}
