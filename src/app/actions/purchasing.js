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
 * Generate unique PO number, e.g. PO-260902-001
 */
function generatePONumber() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${yy}${mm}${dd}-${rand}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET PURCHASES
// ══════════════════════════════════════════════════════════════════════════════

export async function getPurchases() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const purchases = await prisma.purchase.findMany({
      where: { storeId },
      orderBy: { purchasedAt: 'desc' },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true, baseUnit: true } },
            purchaseUnit: true,
          },
        },
      },
    });

    const serialized = purchases.map((p) => ({
      ...p,
      totalAmount: Number(p.totalAmount),
      items: p.items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        baseQuantity: Number(it.baseQuantity),
        baseUnitCost: Number(it.baseUnitCost),
        subtotal: Number(it.subtotal),
      })),
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getPurchases] Error:', error);
    return { error: error.message || 'Gagal memuat daftar pembelian.' };
  }
}

export async function getPurchaseById(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const purchase = await prisma.purchase.findFirst({
      where: { id, storeId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            inventoryItem: {
              include: {
                baseUnit: true,
                balance: true,
              },
            },
            purchaseUnit: true,
          },
        },
      },
    });

    if (!purchase) return { error: 'Data pembelian tidak ditemukan.' };

    return {
      data: {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        items: purchase.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          baseQuantity: Number(it.baseQuantity),
          baseUnitCost: Number(it.baseUnitCost),
          subtotal: Number(it.subtotal),
          inventoryItem: {
            ...it.inventoryItem,
            balance: it.inventoryItem.balance
              ? {
                  ...it.inventoryItem.balance,
                  quantity: Number(it.inventoryItem.balance.quantity),
                  averageCost: Number(it.inventoryItem.balance.averageCost),
                  stockValue: Number(it.inventoryItem.balance.stockValue),
                }
              : null,
          },
        })),
      },
    };
  } catch (error) {
    console.error('[getPurchaseById] Error:', error);
    return { error: error.message || 'Gagal memuat detail pembelian.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CREATE PURCHASE (DRAFT)
// ══════════════════════════════════════════════════════════════════════════════

export async function createPurchase({ supplierId, purchasedAt, items }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!supplierId) {
      return { error: 'Supplier wajib dipilih.' };
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { error: 'Daftar barang pembelian tidak boleh kosong.' };
    }

    let calculatedTotal = 0;
    const processedItems = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const invId = it.inventoryItemId;
      const unitId = it.purchaseUnitId;
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
      const factor = Number(it.conversionFactor) || 1;

      if (!invId || !unitId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
        return { error: `Baris ke-${i + 1}: Kuantitas dan harga beli harus berupa angka positif.` };
      }

      const subtotal = Math.round(qty * price * 100) / 100;
      const baseQuantity = qty * factor;
      const baseUnitCost = baseQuantity > 0 ? subtotal / baseQuantity : price;

      calculatedTotal += subtotal;

      processedItems.push({
        inventoryItemId: invId,
        purchaseUnitId: unitId,
        quantity: qty,
        unitPrice: price,
        baseQuantity,
        baseUnitCost,
        subtotal,
      });
    }

    const purchaseNumber = generatePONumber();

    const purchase = await prisma.purchase.create({
      data: {
        storeId,
        supplierId,
        createdById: user.id,
        purchaseNumber,
        status: 'DRAFT',
        totalAmount: calculatedTotal,
        purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
        items: {
          create: processedItems,
        },
      },
      include: {
        items: true,
      },
    });

    revalidatePath('/dashboard/inventory/purchases');
    return { success: true, data: purchase };
  } catch (error) {
    console.error('[createPurchase] Error:', error);
    return { error: error.message || 'Gagal membuat draft pembelian.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. CONFIRM PURCHASE & WAC CALCULATION (CRITICAL ATOMIC TRANSACTION)
// ══════════════════════════════════════════════════════════════════════════════

export async function confirmPurchase(id) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // Execute everything in a single atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch purchase with items and current inventory balance
      const purchase = await tx.purchase.findFirst({
        where: { id, storeId },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: {
                  balance: true,
                },
              },
            },
          },
        },
      });

      if (!purchase) {
        throw new Error('Data pembelian tidak ditemukan.');
      }

      if (purchase.status === 'CONFIRMED') {
        throw new Error('Pembelian ini sudah dikonfirmasi sebelumnya (Immutable).');
      }

      // 2. Process each purchase item: Update balance with WAC and create StockMovement
      for (const item of purchase.items) {
        const invId = item.inventoryItemId;
        const currentBalance = item.inventoryItem.balance;

        const currentQty = currentBalance ? Number(currentBalance.quantity) : 0;
        const currentAvgCost = currentBalance ? Number(currentBalance.averageCost) : 0;

        const incomingQty = Number(item.baseQuantity);
        const incomingCost = Number(item.baseUnitCost);
        const incomingTotal = Number(item.subtotal);

        const newQty = currentQty + incomingQty;
        let newAvgCost = currentAvgCost;

        // ── WAC CALCULATION (Weighted Average Cost) ─────────────────────────
        if (currentQty >= 0) {
          // Normal Case: stock is zero or positive
          if (newQty > 0) {
            newAvgCost = (currentQty * currentAvgCost + incomingTotal) / newQty;
          } else {
            newAvgCost = incomingCost;
          }
        } else {
          // Negative Stock Case: 08-FINAL-ERD.md Section 47
          // The first abs(currentQty) offsets the negative balance without asset valuation.
          // Remaining positive quantity is valued strictly at the incoming purchase cost.
          if (newQty > 0) {
            newAvgCost = incomingCost;
          } else {
            // Did not bring stock above zero
            newAvgCost = currentAvgCost > 0 ? currentAvgCost : incomingCost;
          }
        }

        const newStockValue = newQty * newAvgCost;

        // 3. Upsert InventoryBalance
        await tx.inventoryBalance.upsert({
          where: { inventoryItemId: invId },
          update: {
            quantity: newQty,
            averageCost: newAvgCost,
            stockValue: newStockValue,
          },
          create: {
            inventoryItemId: invId,
            quantity: newQty,
            averageCost: newAvgCost,
            stockValue: newStockValue,
          },
        });

        // 4. Create immutable StockMovement (historical ledger)
        await tx.stockMovement.create({
          data: {
            storeId,
            inventoryItemId: invId,
            type: 'PURCHASE',
            quantityDelta: incomingQty,
            unitCost: incomingCost,
            totalCost: incomingTotal,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            reason: `Posting Pembelian PO #${purchase.purchaseNumber}`,
            responsibleUserId: user.id,
          },
        });
      }

      // 5. Update purchase status to CONFIRMED
      const confirmedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
        },
      });

      return confirmedPurchase;
    });

    revalidatePath('/dashboard/inventory/purchases');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/movements');

    return { success: true, data: result };
  } catch (error) {
    console.error('[confirmPurchase] Error:', error);
    return { error: error.message || 'Gagal mengonfirmasi pembelian.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DELETE PURCHASE (DRAFT ONLY)
// ══════════════════════════════════════════════════════════════════════════════

export async function deletePurchase(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const purchase = await prisma.purchase.findFirst({
      where: { id, storeId },
    });

    if (!purchase) return { error: 'Pembelian tidak ditemukan.' };

    if (purchase.status === 'CONFIRMED') {
      return {
        error: 'Pembelian berstatus CONFIRMED tidak dapat dihapus karena stok dan HPP telah terposting.',
      };
    }

    await prisma.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await prisma.purchase.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/purchases');
    return { success: true };
  } catch (error) {
    console.error('[deletePurchase] Error:', error);
    return { error: error.message || 'Gagal menghapus draft pembelian.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. STOCK MOVEMENTS (KARTU STOK HISTORIS)
// ══════════════════════════════════════════════════════════════════════════════

export async function getStockMovements({ inventoryItemId, type, limit = 100 } = {}) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const whereClause = { storeId };
    if (inventoryItemId && inventoryItemId !== 'ALL') {
      whereClause.inventoryItemId = inventoryItemId;
    }
    if (type && type !== 'ALL') {
      whereClause.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            baseUnit: true,
          },
        },
        responsibleUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    const serialized = movements.map((m) => ({
      ...m,
      quantityDelta: Number(m.quantityDelta),
      unitCost: Number(m.unitCost),
      totalCost: Number(m.totalCost),
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getStockMovements] Error:', error);
    return { error: error.message || 'Gagal memuat histori pergerakan stok.' };
  }
}
