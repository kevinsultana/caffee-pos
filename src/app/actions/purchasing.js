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

function serializePurchase(p) {
  if (!p) return null;
  return {
    ...p,
    totalAmount: p.totalAmount != null ? Number(p.totalAmount) : 0,
    items: p.items
      ? p.items.map((it) => ({
          ...it,
          quantity: it.quantity != null ? Number(it.quantity) : 0,
          unitPrice: it.unitPrice != null ? Number(it.unitPrice) : 0,
          baseQuantity: it.baseQuantity != null ? Number(it.baseQuantity) : 0,
          baseUnitCost: it.baseUnitCost != null ? Number(it.baseUnitCost) : 0,
          subtotal: it.subtotal != null ? Number(it.subtotal) : 0,
          inventoryItem: it.inventoryItem
            ? {
                ...it.inventoryItem,
                minimumStock:
                  it.inventoryItem.minimumStock != null
                    ? Number(it.inventoryItem.minimumStock)
                    : 0,
                balance: it.inventoryItem.balance
                  ? {
                      ...it.inventoryItem.balance,
                      quantity: Number(it.inventoryItem.balance.quantity || 0),
                      averageCost: Number(it.inventoryItem.balance.averageCost || 0),
                      stockValue: Number(it.inventoryItem.balance.stockValue || 0),
                    }
                  : null,
              }
            : undefined,
        }))
      : undefined,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET PURCHASES
// ══════════════════════════════════════════════════════════════════════════════

export async function getPurchases() {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

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

    return { data: serialized, userRole: user.role?.name || null };
  } catch (error) {
    console.error('[getPurchases] Error:', error);
    return { error: error.message || 'Gagal memuat daftar pembelian.' };
  }
}

export async function getPurchaseById(id) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

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
          inventoryItem: it.inventoryItem
            ? {
                ...it.inventoryItem,
                minimumStock:
                  it.inventoryItem.minimumStock != null
                    ? Number(it.inventoryItem.minimumStock)
                    : 0,
                balance: it.inventoryItem.balance
                  ? {
                      ...it.inventoryItem.balance,
                      quantity: Number(it.inventoryItem.balance.quantity || 0),
                      averageCost: Number(it.inventoryItem.balance.averageCost || 0),
                      stockValue: Number(it.inventoryItem.balance.stockValue || 0),
                    }
                  : null,
              }
            : null,
        })),
      },
      userRole: user.role?.name || null,
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
      const factor = Number(it.conversionFactor) || 1;

      // Ambil subtotal pasti yang diinput pengguna
      const subtotal =
        it.subtotal != null && !isNaN(Number(it.subtotal))
          ? Math.round(Number(it.subtotal))
          : Math.round(qty * (Number(it.unitPrice) || 0));

      if (!invId || !unitId || isNaN(qty) || qty <= 0 || isNaN(subtotal) || subtotal < 0) {
        return { error: `Baris ke-${i + 1}: Kuantitas dan total harga harus berupa angka positif.` };
      }

      // Hitung unitPrice (harga per satuan beli) dengan presisi
      const unitPrice = qty > 0 ? subtotal / qty : 0;

      // Hitung jumlah dalam satuan dasar (base quantity)
      const baseQuantity = qty * factor;

      // HPP / Biaya per base unit (misal per gram) disimpan presisi desimal
      const baseUnitCost = baseQuantity > 0 ? subtotal / baseQuantity : unitPrice;

      calculatedTotal += subtotal;

      processedItems.push({
        inventoryItemId: invId,
        purchaseUnitId: unitId,
        quantity: qty,
        unitPrice,
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
    revalidatePath('/dashboard/inventory/suppliers');
    if (supplierId) {
      revalidatePath(`/dashboard/inventory/suppliers/${supplierId}`);
    }
    return { success: true, data: serializePurchase(purchase) };
  } catch (error) {
    console.error('[createPurchase] Error:', error);
    return { error: error.message || 'Gagal membuat draft pembelian.' };
  }
}

export async function updatePurchase({ id, supplierId, purchasedAt, items }) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!supplierId) {
      return { error: 'Supplier wajib dipilih.' };
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { error: 'Daftar barang pembelian tidak boleh kosong.' };
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: { id, storeId },
    });

    if (!existingPurchase) {
      return { error: 'Data pembelian tidak ditemukan.' };
    }

    if (existingPurchase.status !== 'DRAFT') {
      return { error: 'Hanya pembelian berstatus DRAFT yang dapat diedit.' };
    }

    let calculatedTotal = 0;
    const processedItems = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const invId = it.inventoryItemId;
      const unitId = it.purchaseUnitId;
      const qty = Number(it.quantity);
      const factor = Number(it.conversionFactor) || 1;

      // Ambil subtotal pasti yang diinput pengguna
      const subtotal =
        it.subtotal != null && !isNaN(Number(it.subtotal))
          ? Math.round(Number(it.subtotal))
          : Math.round(qty * (Number(it.unitPrice) || 0));

      if (!invId || !unitId || isNaN(qty) || qty <= 0 || isNaN(subtotal) || subtotal < 0) {
        return { error: `Baris ke-${i + 1}: Kuantitas dan total harga harus berupa angka positif.` };
      }

      // Hitung unitPrice (harga per satuan beli) dengan presisi
      const unitPrice = qty > 0 ? subtotal / qty : 0;

      // Hitung jumlah dalam satuan dasar (base quantity)
      const baseQuantity = qty * factor;

      // HPP / Biaya per base unit (misal per gram) disimpan presisi desimal
      const baseUnitCost = baseQuantity > 0 ? subtotal / baseQuantity : unitPrice;

      calculatedTotal += subtotal;

      processedItems.push({
        inventoryItemId: invId,
        purchaseUnitId: unitId,
        quantity: qty,
        unitPrice,
        baseQuantity,
        baseUnitCost,
        subtotal,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      return await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          purchasedAt: purchasedAt ? new Date(purchasedAt) : existingPurchase.purchasedAt,
          totalAmount: calculatedTotal,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });
    });

    revalidatePath('/dashboard/inventory/purchases');
    revalidatePath(`/dashboard/inventory/purchases/${id}`);
    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true, data: serializePurchase(updated) };
  } catch (error) {
    console.error('[updatePurchase] Error:', error);
    return { error: error.message || 'Gagal memperbarui draft pembelian.' };
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
    revalidatePath('/dashboard/inventory/suppliers');

    return { success: true, data: serializePurchase(result) };
  } catch (error) {
    console.error('[confirmPurchase] Error:', error);
    return { error: error.message || 'Gagal mengonfirmasi pembelian.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DELETE PURCHASE (DRAFT & CONFIRMED FOR OWNER)
// ══════════════════════════════════════════════════════════════════════════════

export async function deletePurchase(id) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const purchase = await prisma.purchase.findFirst({
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

    if (!purchase) return { error: 'Pembelian tidak ditemukan.' };

    if (purchase.status === 'CONFIRMED') {
      // Validasi ketat peran: hanya OWNER yang boleh menghapus PO CONFIRMED
      if (user.role?.name !== 'OWNER') {
        return {
          error: 'Pembelian berstatus CONFIRMED hanya dapat dihapus oleh pengguna dengan peran OWNER.',
        };
      }

      // Transaksi atomik: Rollback stok di inventoryBalance, hapus riwayat di stockMovement, lalu hapus PO
      await prisma.$transaction(async (tx) => {
        // 1. Rollback saldo inventaris untuk setiap barang dalam PO
        for (const item of purchase.items) {
          const invId = item.inventoryItemId;
          const currentBalance = item.inventoryItem?.balance;
          if (currentBalance) {
            const currentQty = Number(currentBalance.quantity || 0);
            const currentAvgCost = Number(currentBalance.averageCost || 0);
            const incomingQty = Number(item.baseQuantity || 0);
            const incomingTotal = Number(item.subtotal || 0);

            // Kurangi kembali stok sejumlah barang yang dibeli (stok boleh minus jika sudah terlanjur terjual)
            const rollbackQty = currentQty - incomingQty;
            let newAvgCost = currentAvgCost;

            if (rollbackQty > 0) {
              const remainingValue = currentQty * currentAvgCost - incomingTotal;
              if (remainingValue > 0) {
                newAvgCost = remainingValue / rollbackQty;
              } else {
                newAvgCost = currentAvgCost;
              }
            } else {
              newAvgCost = currentAvgCost;
            }

            const newStockValue = rollbackQty * newAvgCost;

            await tx.inventoryBalance.update({
              where: { inventoryItemId: invId },
              data: {
                quantity: rollbackQty,
                averageCost: newAvgCost,
                stockValue: newStockValue,
              },
            });
          }
        }

        // 2. Hapus riwayat mutasi stok terkait PO ini dari tabel stockMovement
        await tx.stockMovement.deleteMany({
          where: {
            storeId,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
          },
        });

        // 3. Hapus data baris pembelian & data faktur pembelian
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchase.delete({ where: { id } });
      });

      revalidatePath('/dashboard/inventory/purchases');
      revalidatePath('/dashboard/inventory/items');
      revalidatePath('/dashboard/inventory/movements');
      revalidatePath('/dashboard/inventory/suppliers');
      return { success: true };
    }

    // Normal draft deletion
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await prisma.purchase.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/purchases');
    revalidatePath('/dashboard/inventory/suppliers');
    return { success: true };
  } catch (error) {
    console.error('[deletePurchase] Error:', error);
    return { error: error.message || 'Gagal menghapus pembelian.' };
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
