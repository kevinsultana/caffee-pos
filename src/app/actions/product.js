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

// ══════════════════════════════════════════════════════════════════════════════
// 3. PRODUCT VARIANT & RECIPE ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Mengambil detail lengkap satu produk beserta varian, resep aktif, dan daftar bahan baku.
 */
export async function getProductWithDetails(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const product = await prisma.product.findFirst({
      where: { id, storeId },
      include: {
        category: true,
        inventoryItem: {
          include: {
            baseUnit: true,
            balance: true,
          },
        },
        variants: {
          orderBy: { name: 'asc' },
          include: {
            inventoryItem: {
              include: {
                baseUnit: true,
                balance: true,
              },
            },
            recipes: {
              include: {
                versions: {
                  where: { isActive: true },
                  include: {
                    ingredients: {
                      include: {
                        inventoryItem: {
                          include: {
                            baseUnit: true,
                            balance: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: { orderItems: true },
            },
          },
        },
        recipes: {
          where: { variantId: null },
          include: {
            versions: {
              where: { isActive: true },
              include: {
                ingredients: {
                  include: {
                    inventoryItem: {
                      include: {
                        baseUnit: true,
                        balance: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return { error: 'Produk tidak ditemukan.' };
    }

    // Helper untuk serialisasi resep & hitung estimasi HPP
    const serializeRecipe = (recipeRecord) => {
      if (!recipeRecord) return null;
      const activeVersion = recipeRecord.versions?.[0] || null;
      if (!activeVersion) return null;

      let estimatedHpp = 0;
      const ingredients = activeVersion.ingredients.map((ing) => {
        const qty = Number(ing.quantity);
        const avgCost = ing.inventoryItem?.balance
          ? Number(ing.inventoryItem.balance.averageCost)
          : 0;
        const subtotalHpp = qty * avgCost;
        estimatedHpp += subtotalHpp;

        return {
          id: ing.id,
          inventoryItemId: ing.inventoryItemId,
          inventoryItemName: ing.inventoryItem?.name || '',
          baseUnitCode: ing.inventoryItem?.baseUnit?.code || '',
          quantity: qty,
          averageCost: avgCost,
          subtotalHpp,
        };
      });

      return {
        id: recipeRecord.id,
        name: recipeRecord.name,
        activeVersion: {
          id: activeVersion.id,
          versionNumber: activeVersion.versionNumber,
          createdAt: activeVersion.createdAt,
          ingredients,
          estimatedHpp,
        },
      };
    };

    const serializedVariants = product.variants.map((v) => {
      const activeRecipe = v.recipes?.[0] ? serializeRecipe(v.recipes[0]) : null;
      return {
        id: v.id,
        productId: v.productId,
        name: v.name,
        sku: v.sku,
        price: Number(v.price),
        availability: v.availability,
        discontinued: v.discontinued,
        inventoryItemId: v.inventoryItemId,
        inventoryItem: v.inventoryItem
          ? {
              id: v.inventoryItem.id,
              name: v.inventoryItem.name,
              baseUnitCode: v.inventoryItem.baseUnit?.code || '',
              currentQuantity: v.inventoryItem.balance
                ? Number(v.inventoryItem.balance.quantity)
                : 0,
              averageCost: v.inventoryItem.balance
                ? Number(v.inventoryItem.balance.averageCost)
                : 0,
            }
          : null,
        recipe: activeRecipe,
        orderCount: v._count?.orderItems || 0,
      };
    });

    const parentRecipe = product.recipes?.[0]
      ? serializeRecipe(product.recipes[0])
      : null;

    const serializedProduct = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      type: product.type,
      price: Number(product.price),
      availability: product.availability,
      discontinued: product.discontinued,
      categoryId: product.categoryId,
      categoryName: product.category?.name || '',
      inventoryItemId: product.inventoryItemId,
      inventoryItem: product.inventoryItem
        ? {
            id: product.inventoryItem.id,
            name: product.inventoryItem.name,
            baseUnitCode: product.inventoryItem.baseUnit?.code || '',
            currentQuantity: product.inventoryItem.balance
              ? Number(product.inventoryItem.balance.quantity)
              : 0,
            averageCost: product.inventoryItem.balance
              ? Number(product.inventoryItem.balance.averageCost)
              : 0,
          }
        : null,
      variants: serializedVariants,
      recipe: parentRecipe,
    };

    return { data: serializedProduct };
  } catch (error) {
    console.error('[getProductWithDetails] Error:', error);
    return { error: error.message || 'Gagal memuat detail produk.' };
  }
}

/**
 * Membuat Varian Produk baru.
 */
export async function createProductVariant({
  productId,
  name,
  sku,
  price,
  availability = 'AVAILABLE',
  inventoryItemId,
}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!productId || !name?.trim()) {
      return { error: 'Produk Induk dan Nama Varian wajib diisi.' };
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return { error: 'Harga varian harus berupa angka valid dan tidak boleh negatif.' };
    }

    const parentProduct = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!parentProduct) return { error: 'Produk induk tidak ditemukan.' };

    const cleanName = name.trim();
    const cleanSku = sku?.trim() ? sku.trim() : null;

    // Cek nama varian unik per produk
    const existingName = await prisma.productVariant.findFirst({
      where: { productId, name: cleanName },
    });
    if (existingName) {
      return { error: `Varian dengan nama "${cleanName}" sudah ada pada produk ini.` };
    }

    if (cleanSku) {
      const existingSku = await prisma.productVariant.findFirst({
        where: { productId, sku: cleanSku },
      });
      if (existingSku) {
        return { error: `Varian dengan SKU "${cleanSku}" sudah ada.` };
      }
    }

    if (parentProduct.type === 'DIRECT_STOCK' && !inventoryItemId) {
      return {
        error: 'Untuk produk DIRECT_STOCK, setiap varian wajib terhubung dengan 1 Barang Inventaris.',
      };
    }

    const createdVariant = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId,
          name: cleanName,
          sku: cleanSku,
          price: priceNum,
          availability,
          inventoryItemId:
            parentProduct.type === 'DIRECT_STOCK' ? inventoryItemId : null,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'CREATE_PRODUCT_VARIANT',
          module: 'INVENTORY',
          entityType: 'ProductVariant',
          entityId: v.id,
          changeSummary: `Membuat varian baru "${v.name}" pada produk "${parentProduct.name}" seharga Rp ${priceNum.toLocaleString('id-ID')}`,
        },
      });

      return v;
    });

    revalidatePath(`/dashboard/products/list/${productId}`);
    revalidatePath('/dashboard/products/list');
    revalidatePath('/dashboard/pos');
    revalidatePath('/menu');

    return { success: true, data: createdVariant };
  } catch (error) {
    console.error('[createProductVariant] Error:', error);
    return { error: error.message || 'Gagal menambahkan varian produk.' };
  }
}

/**
 * Memperbarui data Varian Produk.
 */
export async function updateProductVariant({
  id,
  name,
  sku,
  price,
  availability,
  discontinued = false,
  inventoryItemId,
}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const targetVariant = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!targetVariant || targetVariant.product.storeId !== storeId) {
      return { error: 'Varian produk tidak ditemukan.' };
    }

    const cleanName = name ? name.trim() : targetVariant.name;
    const cleanSku = sku !== undefined ? (sku?.trim() ? sku.trim() : null) : targetVariant.sku;
    const priceNum = price !== undefined ? Number(price) : Number(targetVariant.price);

    if (isNaN(priceNum) || priceNum < 0) {
      return { error: 'Harga varian tidak valid.' };
    }

    // Cek duplikasi nama varian
    if (cleanName !== targetVariant.name) {
      const dup = await prisma.productVariant.findFirst({
        where: { productId: targetVariant.productId, name: cleanName, NOT: { id } },
      });
      if (dup) {
        return { error: `Varian dengan nama "${cleanName}" sudah digunakan.` };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.update({
        where: { id },
        data: {
          name: cleanName,
          sku: cleanSku,
          price: priceNum,
          availability: availability || targetVariant.availability,
          discontinued: Boolean(discontinued),
          inventoryItemId:
            targetVariant.product.type === 'DIRECT_STOCK'
              ? inventoryItemId || targetVariant.inventoryItemId
              : null,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'UPDATE_PRODUCT_VARIANT',
          module: 'INVENTORY',
          entityType: 'ProductVariant',
          entityId: v.id,
          changeSummary: `Memperbarui varian "${v.name}" pada produk "${targetVariant.product.name}"`,
        },
      });

      return v;
    });

    revalidatePath(`/dashboard/products/list/${targetVariant.productId}`);
    revalidatePath('/dashboard/products/list');
    revalidatePath('/dashboard/pos');
    revalidatePath('/menu');

    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateProductVariant] Error:', error);
    return { error: error.message || 'Gagal memperbarui varian produk.' };
  }
}

/**
 * Menghapus varian produk jika belum memiliki riwayat transaksi.
 */
export async function deleteProductVariant(id) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const targetVariant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        _count: {
          select: { orderItems: true, recipes: true },
        },
      },
    });

    if (!targetVariant || targetVariant.product.storeId !== storeId) {
      return { error: 'Varian tidak ditemukan.' };
    }

    if (targetVariant._count.orderItems > 0) {
      return {
        error: `Varian "${targetVariant.name}" sudah pernah terjual dalam ${targetVariant._count.orderItems} transaksi. Untuk menonaktifkannya, ubah status menjadi Discontinued.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // Hapus resep varian jika ada
      await tx.recipe.deleteMany({ where: { variantId: id } });
      await tx.productVariant.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'DELETE_PRODUCT_VARIANT',
          module: 'INVENTORY',
          entityType: 'ProductVariant',
          entityId: id,
          changeSummary: `Menghapus varian "${targetVariant.name}" dari produk "${targetVariant.product.name}"`,
        },
      });
    });

    revalidatePath(`/dashboard/products/list/${targetVariant.productId}`);
    revalidatePath('/dashboard/products/list');
    return { success: true };
  } catch (error) {
    console.error('[deleteProductVariant] Error:', error);
    return { error: error.message || 'Gagal menghapus varian.' };
  }
}

/**
 * Menyimpan Formulasi Resep (Recipe & RecipeVersion baru).
 * Menyetel versi baru sebagai isActive = true tanpa menghapus versi lama untuk menjaga riwayat HPP.
 */
export async function saveRecipe({
  productId,
  variantId,
  recipeName,
  ingredients = [],
}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    if (!productId && !variantId) {
      return { error: 'Resep harus terhubung dengan Produk atau Varian.' };
    }

    if (!ingredients || ingredients.length === 0) {
      return { error: 'Resep harus memiliki minimal 1 bahan baku inventaris.' };
    }

    // Validasi kuantitas setiap bahan
    for (const ing of ingredients) {
      const q = Number(ing.quantity);
      if (!ing.inventoryItemId || isNaN(q) || q <= 0) {
        return { error: 'Setiap bahan baku wajib dipilih dengan kuantitas lebih dari 0.' };
      }
    }

    // Ambil nama induk untuk logging audit
    let parentName = '';
    if (variantId) {
      const v = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });
      if (!v || v.product.storeId !== storeId) return { error: 'Varian tidak valid.' };
      parentName = `${v.product.name} - Varian: ${v.name}`;
    } else {
      const p = await prisma.product.findFirst({
        where: { id: productId, storeId },
      });
      if (!p) return { error: 'Produk tidak valid.' };
      parentName = p.name;
    }

    const finalRecipeName = recipeName?.trim() || `Resep: ${parentName}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cari atau buat entitas Recipe
      let recipe = await tx.recipe.findFirst({
        where: variantId ? { variantId } : { productId, variantId: null },
      });

      if (!recipe) {
        recipe = await tx.recipe.create({
          data: {
            productId: variantId ? null : productId,
            variantId: variantId || null,
            name: finalRecipeName,
          },
        });
      } else {
        // Update nama resep jika diubah
        await tx.recipe.update({
          where: { id: recipe.id },
          data: { name: finalRecipeName },
        });
      }

      // 2. Dapatkan nomor versi berikutnya
      const highestVersion = await tx.recipeVersion.findFirst({
        where: { recipeId: recipe.id },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVersionNumber = (highestVersion?.versionNumber || 0) + 1;

      // 3. Non-aktifkan semua versi lama resep ini
      await tx.recipeVersion.updateMany({
        where: { recipeId: recipe.id, isActive: true },
        data: { isActive: false },
      });

      // 4. Buat RecipeVersion baru yang AKTIF
      const newVersion = await tx.recipeVersion.create({
        data: {
          recipeId: recipe.id,
          versionNumber: nextVersionNumber,
          isActive: true,
        },
      });

      // 5. Masukkan RecipeIngredient
      await tx.recipeIngredient.createMany({
        data: ingredients.map((ing) => ({
          recipeVersionId: newVersion.id,
          inventoryItemId: ing.inventoryItemId,
          quantity: Number(ing.quantity),
        })),
      });

      // 6. Catat AuditLog
      await tx.auditLog.create({
        data: {
          storeId,
          userId: user.id,
          action: 'UPDATE_RECIPE',
          module: 'INVENTORY',
          entityType: 'Recipe',
          entityId: recipe.id,
          changeSummary: `Memperbarui formula resep untuk "${parentName}" menjadi Versi ${nextVersionNumber} dengan ${ingredients.length} bahan baku.`,
        },
      });

      return { recipeId: recipe.id, versionNumber: nextVersionNumber };
    });

    const revalId = productId || (await prisma.productVariant.findUnique({ where: { id: variantId } }))?.productId;
    if (revalId) {
      revalidatePath(`/dashboard/products/list/${revalId}`);
    }
    revalidatePath('/dashboard/products/list');
    revalidatePath('/dashboard/pos');

    return { success: true, data: result };
  } catch (error) {
    console.error('[saveRecipe] Error:', error);
    return { error: error.message || 'Gagal menyimpan formula resep.' };
  }
}

/**
 * Mengambil riwayat semua versi resep sebelumnya untuk audit & pemantauan HPP.
 */
export async function getRecipeHistory({ productId, variantId }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const recipe = await prisma.recipe.findFirst({
      where: variantId ? { variantId } : { productId, variantId: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            ingredients: {
              include: {
                inventoryItem: {
                  include: {
                    baseUnit: true,
                    balance: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!recipe) return { data: [] };

    const serializedVersions = recipe.versions.map((v) => {
      let totalHpp = 0;
      const ingredients = v.ingredients.map((ing) => {
        const qty = Number(ing.quantity);
        const avg = ing.inventoryItem?.balance
          ? Number(ing.inventoryItem.balance.averageCost)
          : 0;
        totalHpp += qty * avg;
        return {
          id: ing.id,
          name: ing.inventoryItem?.name || '',
          unitCode: ing.inventoryItem?.baseUnit?.code || '',
          quantity: qty,
          averageCost: avg,
        };
      });

      return {
        id: v.id,
        versionNumber: v.versionNumber,
        isActive: v.isActive,
        createdAt: v.createdAt,
        estimatedHpp: totalHpp,
        ingredients,
      };
    });

    return { data: serializedVersions };
  } catch (error) {
    console.error('[getRecipeHistory] Error:', error);
    return { error: error.message || 'Gagal memuat riwayat resep.' };
  }
}

