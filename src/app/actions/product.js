'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. PRODUCT CATEGORY ACTIONS (Kategori Menu Jual)
// ══════════════════════════════════════════════════════════════════════════════

export async function getProductCategories() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const categories = await prisma.productCategory.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return { data: categories };
  } catch (error) {
    console.error('[getProductCategories] Error:', error);
    return { error: error.message || 'Gagal memuat kategori produk.' };
  }
}

export async function createProductCategory({ name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama kategori produk wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.productCategory.findUnique({
      where: { storeId_name: { storeId, name: cleanName } },
    });

    if (existing) {
      return { error: `Kategori produk "${cleanName}" sudah ada.` };
    }

    const category = await prisma.productCategory.create({
      data: {
        storeId,
        name: cleanName,
      },
    });

    revalidatePath('/dashboard/products/categories');
    return { success: true, data: category };
  } catch (error) {
    console.error('[createProductCategory] Error:', error);
    return { error: error.message || 'Gagal menambahkan kategori produk.' };
  }
}

export async function updateProductCategory(id, { name }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim()) {
      return { error: 'Nama kategori produk wajib diisi.' };
    }

    const cleanName = name.trim();

    const existing = await prisma.productCategory.findFirst({
      where: {
        storeId,
        name: cleanName,
        NOT: { id },
      },
    });

    if (existing) {
      return { error: `Kategori produk "${cleanName}" sudah ada.` };
    }

    const category = await prisma.productCategory.update({
      where: { id },
      data: { name: cleanName },
    });

    revalidatePath('/dashboard/products/categories');
    return { success: true, data: category };
  } catch (error) {
    console.error('[updateProductCategory] Error:', error);
    return { error: error.message || 'Gagal memperbarui kategori produk.' };
  }
}

export async function deleteProductCategory(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const category = await prisma.productCategory.findFirst({
      where: { id, storeId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return { error: 'Kategori produk tidak ditemukan.' };
    }

    if (category._count.products > 0) {
      return {
        error: `Kategori "${category.name}" tidak dapat dihapus karena masih memuat ${category._count.products} produk menu.`,
      };
    }

    await prisma.productCategory.delete({ where: { id } });

    revalidatePath('/dashboard/products/categories');
    return { success: true };
  } catch (error) {
    console.error('[deleteProductCategory] Error:', error);
    return { error: error.message || 'Gagal menghapus kategori produk.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. PRODUCT ACTIONS (Menu Jual Kasir)
// ══════════════════════════════════════════════════════════════════════════════

export async function getProducts() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const products = await prisma.product.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        category: true,
        inventoryItem: {
          include: {
            baseUnit: true,
            balance: true,
          },
        },
        variants: true,
        _count: {
          select: {
            orderItems: true,
            recipes: true,
            promotionConditions: true,
          },
        },
      },
    });

    const serializedProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
      inventoryItem: p.inventoryItem
        ? {
            ...p.inventoryItem,
            minimumStock: Number(p.inventoryItem.minimumStock),
            balance: p.inventoryItem.balance
              ? {
                  ...p.inventoryItem.balance,
                  quantity: Number(p.inventoryItem.balance.quantity),
                  averageCost: Number(p.inventoryItem.balance.averageCost),
                  stockValue: Number(p.inventoryItem.balance.stockValue),
                }
              : null,
          }
        : null,
    }));

    return { data: serializedProducts };
  } catch (error) {
    console.error('[getProducts] Error:', error);
    return { error: error.message || 'Gagal memuat daftar produk.' };
  }
}

export async function createProduct({
  name,
  sku,
  price,
  type,
  categoryId,
  availability = 'AVAILABLE',
  discontinued = false,
  inventoryItemId,
}) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim() || !categoryId || !type) {
      return { error: 'Nama Produk, Kategori, dan Tipe Produk wajib diisi.' };
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return { error: 'Harga Jual harus berupa angka valid dan tidak boleh negatif.' };
    }

    if (type === 'DIRECT_STOCK' && !inventoryItemId) {
      return { error: 'Produk bertipe DIRECT_STOCK wajib memilih 1 barang inventaris pemotong stok.' };
    }

    const cleanName = name.trim();
    const cleanSku = sku?.trim() ? sku.trim() : null;

    // Check unique name in store
    const existingName = await prisma.product.findUnique({
      where: { storeId_name: { storeId, name: cleanName } },
    });
    if (existingName) {
      return { error: `Produk dengan nama "${cleanName}" sudah ada.` };
    }

    // Check unique SKU in store if provided
    if (cleanSku) {
      const existingSku = await prisma.product.findUnique({
        where: { storeId_sku: { storeId, sku: cleanSku } },
      });
      if (existingSku) {
        return { error: `Produk dengan SKU "${cleanSku}" sudah ada.` };
      }
    }

    // Check if inventoryItem is already linked to another product
    if (inventoryItemId) {
      const existingLinked = await prisma.product.findUnique({
        where: { inventoryItemId },
      });
      if (existingLinked) {
        return {
          error: `Barang inventaris yang dipilih sudah terhubung dengan Produk lain ("${existingLinked.name}").`,
        };
      }
    }

    const product = await prisma.product.create({
      data: {
        storeId,
        categoryId,
        name: cleanName,
        sku: cleanSku,
        price: priceNum,
        type,
        availability,
        discontinued: Boolean(discontinued),
        inventoryItemId: type === 'DIRECT_STOCK' ? inventoryItemId : null,
      },
      include: {
        category: true,
        inventoryItem: true,
      },
    });

    revalidatePath('/dashboard/products/list');
    return { success: true, data: product };
  } catch (error) {
    console.error('[createProduct] Error:', error);
    return { error: error.message || 'Gagal menambahkan produk.' };
  }
}

export async function updateProduct(
  id,
  {
    name,
    sku,
    price,
    type,
    categoryId,
    availability = 'AVAILABLE',
    discontinued = false,
    inventoryItemId,
  }
) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!name?.trim() || !categoryId || !type) {
      return { error: 'Nama Produk, Kategori, dan Tipe Produk wajib diisi.' };
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return { error: 'Harga Jual harus berupa angka valid dan tidak boleh negatif.' };
    }

    if (type === 'DIRECT_STOCK' && !inventoryItemId) {
      return { error: 'Produk bertipe DIRECT_STOCK wajib memilih 1 barang inventaris pemotong stok.' };
    }

    const cleanName = name.trim();
    const cleanSku = sku?.trim() ? sku.trim() : null;

    // Check unique name in store
    const existingName = await prisma.product.findFirst({
      where: {
        storeId,
        name: cleanName,
        NOT: { id },
      },
    });
    if (existingName) {
      return { error: `Produk dengan nama "${cleanName}" sudah ada.` };
    }

    // Check unique SKU in store if provided
    if (cleanSku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          storeId,
          sku: cleanSku,
          NOT: { id },
        },
      });
      if (existingSku) {
        return { error: `Produk dengan SKU "${cleanSku}" sudah ada.` };
      }
    }

    // Check inventoryItem linkage
    if (inventoryItemId) {
      const existingLinked = await prisma.product.findFirst({
        where: {
          inventoryItemId,
          NOT: { id },
        },
      });
      if (existingLinked) {
        return {
          error: `Barang inventaris yang dipilih sudah terhubung dengan Produk lain ("${existingLinked.name}").`,
        };
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: cleanName,
        sku: cleanSku,
        price: priceNum,
        type,
        categoryId,
        availability,
        discontinued: Boolean(discontinued),
        inventoryItemId: type === 'DIRECT_STOCK' ? inventoryItemId : null,
      },
      include: {
        category: true,
        inventoryItem: true,
      },
    });

    revalidatePath('/dashboard/products/list');
    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateProduct] Error:', error);
    return { error: error.message || 'Gagal memperbarui produk.' };
  }
}

export async function deleteProduct(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const product = await prisma.product.findFirst({
      where: { id, storeId },
      include: {
        variants: true,
        _count: {
          select: {
            orderItems: true,
            recipes: true,
            promotionConditions: true,
          },
        },
      },
    });

    if (!product) {
      return { error: 'Produk tidak ditemukan.' };
    }

    if (product.variants.length > 0) {
      return {
        error: `Produk "${product.name}" memiliki ${product.variants.length} varian. Hapus varian terlebih dahulu.`,
      };
    }

    if (product._count.orderItems > 0) {
      return {
        error: `Produk "${product.name}" sudah pernah terjual dalam ${product._count.orderItems} transaksi pesanan. Untuk menonaktifkannya, ubah status menjadi "Discontinued".`,
      };
    }

    if (product._count.recipes > 0) {
      return {
        error: `Produk "${product.name}" masih memiliki formulasi resep aktif. Hapus resep terkait terlebih dahulu.`,
      };
    }

    await prisma.product.delete({ where: { id } });

    revalidatePath('/dashboard/products/list');
    return { success: true };
  } catch (error) {
    console.error('[deleteProduct] Error:', error);
    return { error: error.message || 'Gagal menghapus produk.' };
  }
}
