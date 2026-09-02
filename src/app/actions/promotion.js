'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

async function getAuthenticatedUserAndStore(requiredRoles = null) {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');

  if (requiredRoles && !requiredRoles.includes(user.role?.name)) {
    throw new Error('Akses ditolak. Fitur ini hanya untuk Owner atau Manager.');
  }

  return { user, storeId: user.storeId };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET ALL PROMOTIONS
// ══════════════════════════════════════════════════════════════════════════════

export async function getPromotions() {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    const promotions = await prisma.promotion.findMany({
      where: { storeId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        conditionGroup: {
          include: {
            conditions: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        discountAction: true,
        _count: {
          select: { orderPromotions: true },
        },
      },
    });

    const serialized = promotions.map((p) => ({
      ...p,
      conditionGroup: p.conditionGroup
        ? {
            ...p.conditionGroup,
            conditions: p.conditionGroup.conditions.map((c) => ({
              ...c,
              minimumPurchase: c.minimumPurchase ? Number(c.minimumPurchase) : null,
            })),
          }
        : null,
      discountAction: p.discountAction
        ? {
            ...p.discountAction,
            value: Number(p.discountAction.value),
            maxDiscount: p.discountAction.maxDiscount ? Number(p.discountAction.maxDiscount) : null,
          }
        : null,
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getPromotions] Error:', error);
    return { error: error.message || 'Gagal memuat daftar promosi.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CREATE PROMOTION (OWNER / MANAGER)
// ══════════════════════════════════════════════════════════════════════════════

export async function createPromotion({
  name,
  code,
  description,
  status = 'ACTIVE',
  priority = 0,
  stackable = false,
  startAt,
  endAt,
  usageLimit,
  scope = 'ORDER', // 'ORDER' | 'PRODUCT'
  discountType = 'PERCENTAGE', // 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue = 0,
  maxDiscount,
  minimumPurchase,
  targetProductId,
}) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore(['OWNER', 'MANAGER']);

    if (!name?.trim()) {
      return { error: 'Nama promosi wajib diisi.' };
    }

    const cleanCode = code?.trim() ? code.trim().toUpperCase() : null;
    const numValue = Number(discountValue);

    if (isNaN(numValue) || numValue <= 0) {
      return { error: 'Nilai diskon harus lebih dari 0.' };
    }

    if (discountType === 'PERCENTAGE' && numValue > 100) {
      return { error: 'Diskon persentase tidak boleh melebihi 100%.' };
    }

    if (scope === 'PRODUCT' && !targetProductId) {
      return { error: 'Promosi bertipe PRODUCT wajib memilih target produk menu.' };
    }

    // Check unique promo code in store
    if (cleanCode) {
      const existing = await prisma.promotion.findUnique({
        where: { storeId_code: { storeId, code: cleanCode } },
      });
      if (existing) {
        return { error: `Kode promo "${cleanCode}" sudah digunakan.` };
      }
    }

    // Build conditions list
    const conditionsData = [];

    // Condition 1: Minimum Purchase
    const minPurchaseNum = Number(minimumPurchase);
    if (!isNaN(minPurchaseNum) && minPurchaseNum > 0) {
      conditionsData.push({
        type: 'MINIMUM_PURCHASE',
        minimumPurchase: minPurchaseNum,
      });
    }

    // Condition 2: Target Product if scope == PRODUCT
    if (scope === 'PRODUCT' && targetProductId) {
      conditionsData.push({
        type: 'PRODUCT',
        productId: targetProductId,
      });
    }

    const maxDiscNum = Number(maxDiscount);
    const validMaxDiscount = !isNaN(maxDiscNum) && maxDiscNum > 0 ? maxDiscNum : null;
    const validUsageLimit = Number(usageLimit) > 0 ? Number(usageLimit) : null;

    const promotion = await prisma.promotion.create({
      data: {
        storeId,
        name: name.trim(),
        code: cleanCode,
        description: description?.trim() || null,
        status,
        priority: Number(priority) || 0,
        stackable: Boolean(stackable),
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : null,
        usageLimit: validUsageLimit,
        discountAction: {
          create: {
            type: discountType,
            applicationMode: 'ONCE',
            scope,
            value: numValue,
            maxDiscount: validMaxDiscount,
          },
        },
        conditionGroup: conditionsData.length > 0
          ? {
              create: {
                operator: 'ALL',
                conditions: {
                  create: conditionsData,
                },
              },
            }
          : undefined,
      },
    });

    revalidatePath('/dashboard/promotions');
    revalidatePath('/dashboard/pos');
    return { success: true, data: promotion };
  } catch (error) {
    console.error('[createPromotion] Error:', error);
    return { error: error.message || 'Gagal membuat promosi baru.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. UPDATE PROMOTION (OWNER / MANAGER)
// ══════════════════════════════════════════════════════════════════════════════

export async function updatePromotion(
  id,
  {
    name,
    code,
    description,
    status,
    priority,
    stackable,
    startAt,
    endAt,
    usageLimit,
    scope,
    discountType,
    discountValue,
    maxDiscount,
    minimumPurchase,
    targetProductId,
  }
) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore(['OWNER', 'MANAGER']);

    if (!name?.trim()) {
      return { error: 'Nama promosi wajib diisi.' };
    }

    const cleanCode = code?.trim() ? code.trim().toUpperCase() : null;
    const numValue = Number(discountValue);

    if (isNaN(numValue) || numValue <= 0) {
      return { error: 'Nilai diskon harus lebih dari 0.' };
    }

    if (discountType === 'PERCENTAGE' && numValue > 100) {
      return { error: 'Diskon persentase tidak boleh melebihi 100%.' };
    }

    if (scope === 'PRODUCT' && !targetProductId) {
      return { error: 'Promosi bertipe PRODUCT wajib memilih target produk menu.' };
    }

    // Check unique promo code in store
    if (cleanCode) {
      const existing = await prisma.promotion.findFirst({
        where: {
          storeId,
          code: cleanCode,
          NOT: { id },
        },
      });
      if (existing) {
        return { error: `Kode promo "${cleanCode}" sudah digunakan oleh promosi lain.` };
      }
    }

    const maxDiscNum = Number(maxDiscount);
    const validMaxDiscount = !isNaN(maxDiscNum) && maxDiscNum > 0 ? maxDiscNum : null;
    const validUsageLimit = Number(usageLimit) > 0 ? Number(usageLimit) : null;

    // Conditions to create
    const conditionsData = [];
    const minPurchaseNum = Number(minimumPurchase);
    if (!isNaN(minPurchaseNum) && minPurchaseNum > 0) {
      conditionsData.push({
        type: 'MINIMUM_PURCHASE',
        minimumPurchase: minPurchaseNum,
      });
    }
    if (scope === 'PRODUCT' && targetProductId) {
      conditionsData.push({
        type: 'PRODUCT',
        productId: targetProductId,
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update basic promotion fields
      await tx.promotion.update({
        where: { id },
        data: {
          name: name.trim(),
          code: cleanCode,
          description: description?.trim() || null,
          status,
          priority: Number(priority) || 0,
          stackable: Boolean(stackable),
          startAt: startAt ? new Date(startAt) : new Date(),
          endAt: endAt ? new Date(endAt) : null,
          usageLimit: validUsageLimit,
        },
      });

      // 2. Upsert DiscountAction
      await tx.discountAction.upsert({
        where: { promotionId: id },
        update: {
          type: discountType,
          scope,
          value: numValue,
          maxDiscount: validMaxDiscount,
        },
        create: {
          promotionId: id,
          type: discountType,
          scope,
          value: numValue,
          maxDiscount: validMaxDiscount,
        },
      });

      // 3. Reset condition group
      await tx.promotionConditionGroup.deleteMany({ where: { promotionId: id } });

      if (conditionsData.length > 0) {
        await tx.promotionConditionGroup.create({
          data: {
            promotionId: id,
            operator: 'ALL',
            conditions: {
              create: conditionsData,
            },
          },
        });
      }
    });

    revalidatePath('/dashboard/promotions');
    revalidatePath('/dashboard/pos');
    return { success: true };
  } catch (error) {
    console.error('[updatePromotion] Error:', error);
    return { error: error.message || 'Gagal memperbarui promosi.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DELETE PROMOTION (WITH INTEGRITY GUARD)
// ══════════════════════════════════════════════════════════════════════════════

export async function deletePromotion(id) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore(['OWNER', 'MANAGER']);

    const promotion = await prisma.promotion.findFirst({
      where: { id, storeId },
      include: {
        _count: { select: { orderPromotions: true } },
      },
    });

    if (!promotion) {
      return { error: 'Promosi tidak ditemukan.' };
    }

    if (promotion.usageCount > 0 || promotion._count.orderPromotions > 0) {
      return {
        error: `Promosi "${promotion.name}" pernah digunakan dalam ${promotion.usageCount} transaksi pesanan. Untuk menonaktifkannya, ubah status menjadi INACTIVE agar riwayat struk pesanan tetap utuh.`,
      };
    }

    await prisma.discountAction.deleteMany({ where: { promotionId: id } });
    await prisma.promotionConditionGroup.deleteMany({ where: { promotionId: id } });
    await prisma.promotion.delete({ where: { id } });

    revalidatePath('/dashboard/promotions');
    revalidatePath('/dashboard/pos');
    return { success: true };
  } catch (error) {
    console.error('[deletePromotion] Error:', error);
    return { error: error.message || 'Gagal menghapus promosi.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. VALIDATE PROMO CODE & CALCULATE DISCOUNT (ENGINE)
// ══════════════════════════════════════════════════════════════════════════════

export async function validatePromoCode({ code, cartItems }) {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();

    if (!code?.trim()) {
      return { error: 'Silakan masukkan kode promo.' };
    }

    if (!cartItems || cartItems.length === 0) {
      return { error: 'Keranjang belanja kosong.' };
    }

    const normalizedCode = code.trim().toUpperCase();
    const now = new Date();

    // 1. Cari promosi aktif berdasarkan kode
    const promo = await prisma.promotion.findFirst({
      where: {
        storeId,
        code: normalizedCode,
        status: 'ACTIVE',
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gte: now } }],
      },
      include: {
        conditionGroup: {
          include: {
            conditions: true,
          },
        },
        discountAction: true,
      },
    });

    if (!promo) {
      return { error: `Kode promo "${normalizedCode}" tidak valid atau sudah kedaluwarsa.` };
    }

    // 2. Cek Limit Pemakaian Global
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      return { error: `Kuota pemakaian kode promo "${normalizedCode}" telah habis.` };
    }

    if (!promo.discountAction) {
      return { error: 'Konfigurasi diskon promosi tidak valid.' };
    }

    const action = promo.discountAction;
    const conditions = promo.conditionGroup?.conditions || [];

    // 3. Evaluasi Subtotal Keranjang
    const subtotal = cartItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );

    // 4. Evaluasi Condition: MINIMUM_PURCHASE (dihitung dari subtotal sebelum diskon)
    const minPurchaseCondition = conditions.find((c) => c.type === 'MINIMUM_PURCHASE');
    if (minPurchaseCondition && minPurchaseCondition.minimumPurchase) {
      const minRequired = Number(minPurchaseCondition.minimumPurchase);
      if (subtotal < minRequired) {
        return {
          error: `Kode promo "${normalizedCode}" membutuhkan minimal pembelian ${minRequired.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}.`,
        };
      }
    }

    // 5. Evaluasi Discount Berdasarkan Scope
    let calculatedDiscount = 0;
    const actionValue = Number(action.value);
    const maxDiscount = action.maxDiscount ? Number(action.maxDiscount) : null;

    if (action.scope === 'PRODUCT') {
      // Cari produk yang ditargetkan dalam kondisi
      const productCondition = conditions.find((c) => c.type === 'PRODUCT');
      const targetProdId = productCondition?.productId;

      // Filter item keranjang yang sesuai target
      const eligibleItems = cartItems.filter((it) => it.productId === targetProdId);

      if (eligibleItems.length === 0) {
        return {
          error: `Kode promo "${normalizedCode}" hanya berlaku untuk menu tertentu yang belum ada di keranjang Anda.`,
        };
      }

      let eligibleSubtotal = 0;
      for (const it of eligibleItems) {
        eligibleSubtotal += Number(it.price) * Number(it.quantity);
      }

      if (action.type === 'PERCENTAGE') {
        calculatedDiscount = eligibleSubtotal * (actionValue / 100);
      } else {
        // FIXED_AMOUNT per target
        calculatedDiscount = Math.min(eligibleSubtotal, actionValue);
      }
    } else {
      // ORDER Scope (memotong subtotal seluruh pesanan)
      if (action.type === 'PERCENTAGE') {
        calculatedDiscount = subtotal * (actionValue / 100);
      } else {
        calculatedDiscount = Math.min(subtotal, actionValue);
      }
    }

    // Terapkan Maximum Discount Cap jika ada
    if (maxDiscount !== null && calculatedDiscount > maxDiscount) {
      calculatedDiscount = maxDiscount;
    }

    calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;

    return {
      success: true,
      data: {
        promoId: promo.id,
        name: promo.name,
        code: promo.code,
        scope: action.scope,
        discountType: action.type,
        discountValue: actionValue,
        maxDiscount,
        discountAmount: calculatedDiscount,
      },
    };
  } catch (error) {
    console.error('[validatePromoCode] Error:', error);
    return { error: error.message || 'Gagal memvalidasi kode promo.' };
  }
}
