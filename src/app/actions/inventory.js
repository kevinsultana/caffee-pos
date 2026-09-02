'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

const DEFAULT_SYSTEM_UNITS = [
  { code: 'g', name: 'Gram' },
  { code: 'kg', name: 'Kilogram' },
  { code: 'ml', name: 'Mililiter' },
  { code: 'L', name: 'Liter' },
  { code: 'pcs', name: 'Pieces' },
];

/**
 * Helper to get the user and their store
 */
async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. UNIT ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

export async function getUnits() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    // Auto-seed default system units if none exist for this store
    const count = await prisma.unit.count({ where: { storeId } });
    if (count === 0) {
      for (const u of DEFAULT_SYSTEM_UNITS) {
        await prisma.unit.upsert({
          where: { storeId_code: { storeId, code: u.code } },
          update: {},
          create: {
            storeId,
            code: u.code,
            name: u.name,
            isSystem: true,
          },
        });
      }
    }

    const units = await prisma.unit.findMany({
      where: { storeId },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      include: {
        _count: {
          select: {
            baseInventoryItems: true,
            purchaseConversions: true,
            purchaseItems: true,
          },
        },
      },
    });

    return { data: units };
  } catch (error) {
    console.error('[getUnits] Error:', error);
    return { error: error.message || 'Gagal memuat daftar unit satuan.' };
  }
}

export async function createUnit({ code, name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!code?.trim() || !name?.trim()) {
      return { error: 'Kode dan Nama Unit wajib diisi.' };
    }

    const cleanCode = code.trim().toLowerCase();
    const cleanName = name.trim();

    const existing = await prisma.unit.findUnique({
      where: { storeId_code: { storeId, code: cleanCode } },
    });

    if (existing) {
      return { error: `Satuan dengan kode "${cleanCode}" sudah ada.` };
    }

    const unit = await prisma.unit.create({
      data: {
        storeId,
        code: cleanCode,
        name: cleanName,
        isSystem: false,
      },
    });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true, data: unit };
  } catch (error) {
    console.error('[createUnit] Error:', error);
    return { error: error.message || 'Gagal menambahkan unit satuan.' };
  }
}

export async function updateUnit(id, { name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama Unit wajib diisi.' };
    }

    const unit = await prisma.unit.findFirst({
      where: { id, storeId },
    });

    if (!unit) {
      return { error: 'Unit satuan tidak ditemukan.' };
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: { name: name.trim() },
    });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateUnit] Error:', error);
    return { error: error.message || 'Gagal memperbarui unit satuan.' };
  }
}

export async function deleteUnit(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const unit = await prisma.unit.findFirst({
      where: { id, storeId },
      include: {
        _count: {
          select: {
            baseInventoryItems: true,
            purchaseConversions: true,
            purchaseItems: true,
          },
        },
      },
    });

    if (!unit) {
      return { error: 'Unit satuan tidak ditemukan.' };
    }

    if (unit.isSystem) {
      return { error: 'Satuan bawaan sistem tidak dapat dihapus.' };
    }

    const usedCount =
      unit._count.baseInventoryItems +
      unit._count.purchaseConversions +
      unit._count.purchaseItems;

    if (usedCount > 0) {
      return {
        error: `Satuan "${unit.code}" tidak dapat dihapus karena sedang digunakan oleh ${unit._count.baseInventoryItems} barang inventaris/resep.`,
      };
    }

    await prisma.unit.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true };
  } catch (error) {
    console.error('[deleteUnit] Error:', error);
    return { error: error.message || 'Gagal menghapus unit satuan.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. INVENTORY CATEGORY ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

export async function getInventoryCategories() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const categories = await prisma.inventoryCategory.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return { data: categories };
  } catch (error) {
    console.error('[getInventoryCategories] Error:', error);
    return { error: error.message || 'Gagal memuat kategori inventaris.' };
  }
}

export async function createInventoryCategory({ name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama kategori wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.inventoryCategory.findUnique({
      where: { storeId_name: { storeId, name: cleanName } },
    });

    if (existing) {
      return { error: `Kategori inventaris "${cleanName}" sudah ada.` };
    }

    const category = await prisma.inventoryCategory.create({
      data: {
        storeId,
        name: cleanName,
      },
    });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true, data: category };
  } catch (error) {
    console.error('[createInventoryCategory] Error:', error);
    return { error: error.message || 'Gagal menambahkan kategori inventaris.' };
  }
}

export async function updateInventoryCategory(id, { name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama kategori wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.inventoryCategory.findFirst({
      where: {
        storeId,
        name: cleanName,
        NOT: { id },
      },
    });

    if (existing) {
      return { error: `Kategori inventaris "${cleanName}" sudah ada.` };
    }

    const category = await prisma.inventoryCategory.update({
      where: { id },
      data: { name: cleanName },
    });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true, data: category };
  } catch (error) {
    console.error('[updateInventoryCategory] Error:', error);
    return { error: error.message || 'Gagal memperbarui kategori inventaris.' };
  }
}

export async function deleteInventoryCategory(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const category = await prisma.inventoryCategory.findFirst({
      where: { id, storeId },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) {
      return { error: 'Kategori inventaris tidak ditemukan.' };
    }

    if (category._count.items > 0) {
      return {
        error: `Kategori "${category.name}" tidak dapat dihapus karena masih memiliki ${category._count.items} barang inventaris.`,
      };
    }

    await prisma.inventoryCategory.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/setup');
    return { success: true };
  } catch (error) {
    console.error('[deleteInventoryCategory] Error:', error);
    return { error: error.message || 'Gagal menghapus kategori inventaris.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. INVENTORY ITEM ACTIONS (Bahan Baku / Stok Fisik)
// ══════════════════════════════════════════════════════════════════════════════

export async function getInventoryItems() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const items = await prisma.inventoryItem.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        category: true,
        baseUnit: true,
        balance: true,
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, name: true, product: { select: { name: true } } } },
        _count: {
          select: {
            recipeIngredients: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });

    // Format serialized Decimal values for clean client serialization
    const serializedItems = items.map((item) => ({
      ...item,
      minimumStock: Number(item.minimumStock),
      balance: item.balance
        ? {
            ...item.balance,
            quantity: Number(item.balance.quantity),
            averageCost: Number(item.balance.averageCost),
            stockValue: Number(item.balance.stockValue),
          }
        : { quantity: 0, averageCost: 0, stockValue: 0 },
    }));

    return { data: serializedItems };
  } catch (error) {
    console.error('[getInventoryItems] Error:', error);
    return { error: error.message || 'Gagal memuat daftar inventaris.' };
  }
}

export async function createInventoryItem({ name, categoryId, baseUnitId, minimumStock = 0 }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim() || !categoryId || !baseUnitId) {
      return { error: 'Nama Barang, Kategori, dan Base Unit wajib diisi.' };
    }

    const cleanName = name.trim();
    const minStockNum = isNaN(Number(minimumStock)) ? 0 : Number(minimumStock);

    if (minStockNum < 0) {
      return { error: 'Minimum stock tidak boleh bernilai negatif.' };
    }

    const existing = await prisma.inventoryItem.findUnique({
      where: { storeId_name: { storeId, name: cleanName } },
    });

    if (existing) {
      return { error: `Barang inventaris dengan nama "${cleanName}" sudah ada.` };
    }

    // Create Item with initialized 0 Balance
    const item = await prisma.inventoryItem.create({
      data: {
        storeId,
        categoryId,
        baseUnitId,
        name: cleanName,
        minimumStock: minStockNum,
        balance: {
          create: {
            quantity: 0,
            averageCost: 0,
            stockValue: 0,
          },
        },
      },
      include: {
        category: true,
        baseUnit: true,
        balance: true,
      },
    });

    revalidatePath('/dashboard/inventory/items');
    return { success: true, data: item };
  } catch (error) {
    console.error('[createInventoryItem] Error:', error);
    return { error: error.message || 'Gagal menambahkan barang inventaris.' };
  }
}

export async function updateInventoryItem(id, { name, categoryId, baseUnitId, minimumStock }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim() || !categoryId || !baseUnitId) {
      return { error: 'Nama Barang, Kategori, dan Base Unit wajib diisi.' };
    }

    const cleanName = name.trim();
    const minStockNum = isNaN(Number(minimumStock)) ? 0 : Number(minimumStock);

    if (minStockNum < 0) {
      return { error: 'Minimum stock tidak boleh bernilai negatif.' };
    }

    const existing = await prisma.inventoryItem.findFirst({
      where: {
        storeId,
        name: cleanName,
        NOT: { id },
      },
    });

    if (existing) {
      return { error: `Barang inventaris dengan nama "${cleanName}" sudah ada.` };
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: cleanName,
        categoryId,
        baseUnitId,
        minimumStock: minStockNum,
      },
      include: {
        category: true,
        baseUnit: true,
        balance: true,
      },
    });

    revalidatePath('/dashboard/inventory/items');
    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateInventoryItem] Error:', error);
    return { error: error.message || 'Gagal memperbarui barang inventaris.' };
  }
}

export async function deleteInventoryItem(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const item = await prisma.inventoryItem.findFirst({
      where: { id, storeId },
      include: {
        product: true,
        variant: true,
        _count: {
          select: {
            recipeIngredients: true,
            purchaseItems: true,
            stockMovements: true,
            stockOpnameItems: true,
          },
        },
      },
    });

    if (!item) {
      return { error: 'Barang inventaris tidak ditemukan.' };
    }

    if (item.product) {
      return {
        error: `Barang ini tidak dapat dihapus karena terhubung sebagai Direct Stock untuk Produk "${item.product.name}".`,
      };
    }

    if (item.variant) {
      return {
        error: `Barang ini tidak dapat dihapus karena terhubung sebagai Direct Stock untuk Varian Produk.`,
      };
    }

    if (item._count.recipeIngredients > 0) {
      return {
        error: `Barang ini tidak dapat dihapus karena digunakan dalam ${item._count.recipeIngredients} formulasi Resep.`,
      };
    }

    if (item._count.stockMovements > 0 || item._count.purchaseItems > 0) {
      return {
        error: `Barang ini memiliki riwayat mutasi stok / pembelian sehingga tidak dapat dihapus untuk menjaga integritas pembukuan.`,
      };
    }

    // Delete balance and item
    await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: id } });
    await prisma.inventoryItem.delete({ where: { id } });

    revalidatePath('/dashboard/inventory/items');
    return { success: true };
  } catch (error) {
    console.error('[deleteInventoryItem] Error:', error);
    return { error: error.message || 'Gagal menghapus barang inventaris.' };
  }
}
