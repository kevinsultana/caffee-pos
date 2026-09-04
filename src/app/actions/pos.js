'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import { getCachedProductCategories } from '@/app/actions/product';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return { user, storeId: user.storeId };
}

function generateOrderNumber() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yy}${mm}${dd}-${rand}`;
}

/**
 * Mendapatkan master data kasir POS:
 * - Produk aktif & tersedia
 * - Kategori produk
 * - Store settings (pajak, service charge, pembulatan)
 * - Status shift aktif user
 */
export async function getPosInitData() {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    const [products, categories, store, shift] = await Promise.all([
      prisma.product.findMany({
        where: {
          storeId,
          discontinued: false,
        },
        orderBy: { name: 'asc' },
        include: {
          category: true,
          variants: {
            where: { discontinued: false },
            orderBy: { name: 'asc' },
            include: {
              inventoryItem: {
                include: {
                  baseUnit: true,
                  balance: true,
                },
              },
            },
          },
          inventoryItem: {
            include: {
              baseUnit: true,
              balance: true,
            },
          },
        },
      }),
      getCachedProductCategories(storeId),
      prisma.store.findUnique({
        where: { id: storeId },
        include: { settings: true },
      }),
      prisma.shift.findFirst({
        where: {
          storeId,
          userId: user.id,
          status: 'OPEN',
        },
      }),
    ]);

    const serializedProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
      variants: p.variants?.map((v) => ({
        ...v,
        price: Number(v.price),
        inventoryItem: v.inventoryItem
          ? {
              ...v.inventoryItem,
              balance: v.inventoryItem.balance
                ? {
                    quantity: Number(v.inventoryItem.balance.quantity),
                    averageCost: Number(v.inventoryItem.balance.averageCost),
                  }
                : null,
            }
          : null,
      })) || [],
      inventoryItem: p.inventoryItem
        ? {
            ...p.inventoryItem,
            balance: p.inventoryItem.balance
              ? {
                  quantity: Number(p.inventoryItem.balance.quantity),
                  averageCost: Number(p.inventoryItem.balance.averageCost),
                }
              : null,
          }
        : null,
    }));

    return {
      data: {
        products: serializedProducts,
        categories,
        settings: store?.settings
          ? {
              qrisImageUrl: store.settings.qrisImageUrl || null,
              taxEnabled: store.settings.taxEnabled,
              taxRate: Number(store.settings.taxRate),
              taxBaseIncludesServiceCharge: store.settings.taxBaseIncludesServiceCharge,
              serviceChargeEnabled: store.settings.serviceChargeEnabled,
              serviceChargeRate: Number(store.settings.serviceChargeRate),
              cashRoundingEnabled: store.settings.cashRoundingEnabled,
              cashRoundingUnit: Number(store.settings.cashRoundingUnit),
            }
          : {
              qrisImageUrl: null,
              taxEnabled: false,
              taxRate: 0,
              taxBaseIncludesServiceCharge: false,
              serviceChargeEnabled: false,
              serviceChargeRate: 0,
              cashRoundingEnabled: false,
              cashRoundingUnit: 0,
            },
        activeShift: shift
          ? {
              id: shift.id,
              openedAt: shift.openedAt,
              openingCash: Number(shift.openingCash),
            }
          : null,
      },
    };
  } catch (error) {
    console.error('[getPosInitData] Error:', error);
    const isSessionError = Boolean(error.message?.includes('Sesi tidak valid'));
    return {
      error: error.message || 'Gagal memuat data kasir POS.',
      sessionRevoked: isSessionError,
    };
  }
}

/**
 * Proses Transaksi Pembayaran Kasir (Checkout)
 * ATOMIC PRISMA TRANSACTION:
 * 1. Validasi shift terbuka
 * 2. Hitung Diskon Promo (jika ada kode promo yang valid)
 * 3. Hitung Pajak, Service Charge, Pembulatan
 * 4. Buat Order (PAID)
 * 5. Buat OrderItems (Snapshot HPP, Harga & Diskon)
 * 6. Buat OrderPromotion Snapshot
 * 7. Potong Stok Inventaris & Buat StockMovement (SALE) - Mengizinkan stok minus
 * 8. Buat Payment (CASH / QRIS)
 */
export async function processPosCheckout({
  customerId = null,
  customerName = 'Pelanggan',
  customerPhone = '',
  queueNumber,
  paymentMethod,
  promoCode = '',
  cashReceived = 0,
  items,
}) {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // 1. Validasi Shift Kasir
    const activeShift = await prisma.shift.findFirst({
      where: {
        storeId,
        userId: user.id,
        status: 'OPEN',
      },
    });

    if (!activeShift) {
      return { error: 'Anda belum membuka shift kasir. Silakan buka shift terlebih dahulu.' };
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { error: 'Keranjang belanja masih kosong.' };
    }

    if (!queueNumber?.trim()) {
      return { error: 'Nomor antrean (Queue Number) wajib diisi.' };
    }

    if (!['CASH', 'QRIS'].includes(paymentMethod)) {
      return { error: 'Metode pembayaran tidak valid.' };
    }

    // 2. Ambil Pengaturan Toko
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    });

    const settings = store?.settings || {
      taxEnabled: false,
      taxRate: 0,
      taxBaseIncludesServiceCharge: false,
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
      cashRoundingEnabled: false,
      cashRoundingUnit: 0,
    };

    // 3. Ambil data produk di keranjang
    const productIds = items.map((it) => it.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId },
      include: {
        inventoryItem: {
          include: { balance: true, baseUnit: true },
        },
        variants: {
          include: {
            inventoryItem: {
              include: { balance: true, baseUnit: true },
            },
            recipes: {
              include: {
                versions: {
                  where: { isActive: true },
                  include: {
                    ingredients: {
                      include: {
                        inventoryItem: {
                          include: { balance: true, baseUnit: true },
                        },
                      },
                    },
                  },
                },
              },
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
                      include: { balance: true, baseUnit: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 4. Hitung Subtotal Produk & HPP
    let productSubtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const dbProd = productMap.get(item.productId);
      if (!dbProd) {
        return { error: `Produk tidak ditemukan di database.` };
      }

      const selectedVariant = item.variantId
        ? dbProd.variants?.find((v) => v.id === item.variantId)
        : null;

      const qty = Number(item.quantity) || 1;
      const unitPrice = selectedVariant
        ? Number(selectedVariant.price)
        : Number(dbProd.price);
      const subtotal = unitPrice * qty;
      productSubtotal += subtotal;

      // Resep efektif: Prioritaskan resep varian, fallback ke resep induk
      const effectiveRecipe =
        selectedVariant?.recipes?.[0]?.versions?.[0] ||
        dbProd.recipes?.[0]?.versions?.[0] ||
        null;

      // Hitung HPP (WAC) saat ini
      let hppUnit = 0;
      if (dbProd.type === 'DIRECT_STOCK') {
        const inv = selectedVariant?.inventoryItem || dbProd.inventoryItem;
        if (inv?.balance) {
          hppUnit = Number(inv.balance.averageCost) || 0;
        }
      } else if (dbProd.type === 'RECIPE') {
        if (effectiveRecipe?.ingredients) {
          for (const ing of effectiveRecipe.ingredients) {
            const ingAvgCost = Number(ing.inventoryItem?.balance?.averageCost) || 0;
            hppUnit += Number(ing.quantity) * ingAvgCost;
          }
        }
      }
      const hppTotal = hppUnit * qty;

      orderItemsData.push({
        productId: dbProd.id,
        variantId: item.variantId || null,
        productNameSnapshot: selectedVariant
          ? `${dbProd.name} (${selectedVariant.name})`
          : dbProd.name,
        quantity: qty,
        unitPrice,
        promotionDiscount: 0,
        subtotal,
        hppUnit,
        hppTotal,
        notes: item.notes?.trim() || null,
        productRef: dbProd,
        effectiveRecipe,
      });
    }

    // 5. Evaluasi Promo Code (jika ada)
    let totalPromoDiscount = 0;
    let appliedPromoObj = null;

    if (promoCode?.trim()) {
      const normalizedCode = promoCode.trim().toUpperCase();
      const now = new Date();

      const promo = await prisma.promotion.findFirst({
        where: {
          storeId,
          code: normalizedCode,
          status: 'ACTIVE',
          startAt: { lte: now },
          OR: [{ endAt: null }, { endAt: { gte: now } }],
        },
        include: {
          conditionGroup: { include: { conditions: true } },
          discountAction: true,
        },
      });

      if (!promo) {
        return { error: `Kode promo "${normalizedCode}" tidak valid atau sudah kedaluwarsa.` };
      }

      if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
        return { error: `Kuota pemakaian kode promo "${normalizedCode}" telah habis.` };
      }

      const action = promo.discountAction;
      const conditions = promo.conditionGroup?.conditions || [];

      // Evaluasi MINIMUM_PURCHASE
      const minPurchCond = conditions.find((c) => c.type === 'MINIMUM_PURCHASE');
      if (minPurchCond?.minimumPurchase && productSubtotal < Number(minPurchCond.minimumPurchase)) {
        return {
          error: `Kode promo "${normalizedCode}" membutuhkan minimal pembelian ${Number(minPurchCond.minimumPurchase).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}.`,
        };
      }

      const actionVal = Number(action.value);
      const maxDisc = action.maxDiscount ? Number(action.maxDiscount) : null;

      if (action.scope === 'PRODUCT') {
        const prodCond = conditions.find((c) => c.type === 'PRODUCT');
        const targetProdId = prodCond?.productId;

        let eligibleSubtotal = 0;
        for (const it of orderItemsData) {
          if (it.productId === targetProdId) {
            eligibleSubtotal += it.subtotal;
          }
        }

        if (eligibleSubtotal === 0) {
          return { error: `Kode promo "${normalizedCode}" hanya berlaku untuk menu tertentu.` };
        }

        let calcDisc = action.type === 'PERCENTAGE'
          ? eligibleSubtotal * (actionVal / 100)
          : Math.min(eligibleSubtotal, actionVal);

        if (maxDisc !== null && calcDisc > maxDisc) calcDisc = maxDisc;
        totalPromoDiscount = Math.round(calcDisc * 100) / 100;

        // Distribusikan ke order items terkait
        for (const it of orderItemsData) {
          if (it.productId === targetProdId) {
            it.promotionDiscount = totalPromoDiscount;
          }
        }
      } else {
        // ORDER Scope
        let calcDisc = action.type === 'PERCENTAGE'
          ? productSubtotal * (actionVal / 100)
          : Math.min(productSubtotal, actionVal);

        if (maxDisc !== null && calcDisc > maxDisc) calcDisc = maxDisc;
        totalPromoDiscount = Math.round(calcDisc * 100) / 100;
      }

      appliedPromoObj = {
        promotionId: promo.id,
        name: promo.name,
        code: promo.code,
        scope: action.scope,
        discountType: action.type,
        value: actionVal,
        maxDiscount: maxDisc,
        discountAmount: totalPromoDiscount,
      };
    }

    // 6. Kalkulasi Finansial (Sesuai Urutan 02-PROMOTION-RULES.md)
    const taxableSubtotal = Math.max(0, productSubtotal - totalPromoDiscount);

    // Service Charge
    const scRate = settings.serviceChargeEnabled ? Number(settings.serviceChargeRate) : 0;
    const scAmount = Math.round(taxableSubtotal * (scRate / 100) * 100) / 100;

    // Tax (PPN)
    const taxRate = settings.taxEnabled ? Number(settings.taxRate) : 0;
    const taxBase = settings.taxBaseIncludesServiceCharge
      ? taxableSubtotal + scAmount
      : taxableSubtotal;
    const taxAmount = Math.round(taxBase * (taxRate / 100) * 100) / 100;

    const grandTotal = taxableSubtotal + scAmount + taxAmount;

    // Cash Rounding (Pembulatan Tunai)
    let cashPayable = grandTotal;
    let roundingAmount = 0;

    if (
      paymentMethod === 'CASH' &&
      settings.cashRoundingEnabled &&
      Number(settings.cashRoundingUnit) > 0
    ) {
      const unit = Number(settings.cashRoundingUnit);
      cashPayable = Math.round(grandTotal / unit) * unit;
      roundingAmount = cashPayable - grandTotal;
    }

    // Validasi Uang Diterima jika CASH
    const numCashReceived = Number(cashReceived);
    if (paymentMethod === 'CASH' && numCashReceived < cashPayable) {
      return {
        error: `Uang tunai yang diterima (${numCashReceived}) kurang dari total tagihan (${cashPayable}).`,
      };
    }
    const changeAmount = paymentMethod === 'CASH' ? numCashReceived - cashPayable : 0;

    const orderNumber = generateOrderNumber();

    // ── 7. EKSEKUSI PRISMA TRANSACTION ATOMIC ────────────────────────────────
    const transactionResult = await prisma.$transaction(async (tx) => {
      // a. Buat Order
      const order = await tx.order.create({
        data: {
          storeId,
          customerId: customerId || null,
          createdById: user.id,
          orderNumber,
          queueNumber: queueNumber.trim(),
          source: 'POS',
          status: 'PAID',
          customerNameSnapshot: customerName.trim() || 'Pelanggan',
          customerPhoneSnapshot: customerPhone?.trim() || null,
          productSubtotal,
          promotionDiscount: totalPromoDiscount,
          taxableSubtotal,
          serviceChargeRate: scRate,
          serviceChargeAmount: scAmount,
          taxRate,
          taxBase,
          taxAmount,
          grandTotal,
          roundingAmount,
          cashPayable,
          paidAt: new Date(),
        },
      });

      // b. Buat OrderItems dan Potong Stok Inventaris
      for (const item of orderItemsData) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            variantId: item.variantId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            promotionDiscount: item.promotionDiscount,
            subtotal: item.subtotal,
            hppUnit: item.hppUnit,
            hppTotal: item.hppTotal,
            notes: item.notes,
          },
        });

        // Potong stok inventaris:
        // 1) DIRECT_STOCK
        if (item.productRef.type === 'DIRECT_STOCK' && item.productRef.inventoryItemId) {
          const invId = item.productRef.inventoryItemId;
          const currentBal = await tx.inventoryBalance.findUnique({
            where: { inventoryItemId: invId },
          });

          const curQty = currentBal ? Number(currentBal.quantity) : 0;
          const curAvgCost = currentBal ? Number(currentBal.averageCost) : 0;
          const deltaQty = item.quantity;
          const newQty = curQty - deltaQty; // Boleh minus sesuai ERD!
          const newStockVal = newQty * curAvgCost;

          await tx.inventoryBalance.upsert({
            where: { inventoryItemId: invId },
            update: {
              quantity: newQty,
              stockValue: newStockVal,
            },
            create: {
              inventoryItemId: invId,
              quantity: newQty,
              averageCost: curAvgCost,
              stockValue: newStockVal,
            },
          });

          // Catat Stock Movement (type: SALE)
          await tx.stockMovement.create({
            data: {
              storeId,
              inventoryItemId: invId,
              type: 'SALE',
              quantityDelta: -deltaQty,
              unitCost: curAvgCost,
              totalCost: deltaQty * curAvgCost,
              referenceType: 'ORDER',
              referenceId: order.id,
              reason: `Penjualan POS #${order.orderNumber}`,
              responsibleUserId: user.id,
            },
          });
        }

        // 2) RECIPE
        if (item.productRef.type === 'RECIPE') {
          const activeRecipe = item.effectiveRecipe || item.productRef.recipes[0]?.versions[0];
          if (activeRecipe?.ingredients) {
            for (const ing of activeRecipe.ingredients) {
              const ingInvId = ing.inventoryItemId;
              const ingDeduction = Number(ing.quantity) * item.quantity;

              const currentBal = await tx.inventoryBalance.findUnique({
                where: { inventoryItemId: ingInvId },
              });

              const curQty = currentBal ? Number(currentBal.quantity) : 0;
              const curAvgCost = currentBal ? Number(currentBal.averageCost) : 0;
              const newQty = curQty - ingDeduction;
              const newStockVal = newQty * curAvgCost;

              await tx.inventoryBalance.upsert({
                where: { inventoryItemId: ingInvId },
                update: {
                  quantity: newQty,
                  stockValue: newStockVal,
                },
                create: {
                  inventoryItemId: ingInvId,
                  quantity: newQty,
                  averageCost: curAvgCost,
                  stockValue: newStockVal,
                },
              });

              await tx.stockMovement.create({
                data: {
                  storeId,
                  inventoryItemId: ingInvId,
                  type: 'SALE',
                  quantityDelta: -ingDeduction,
                  unitCost: curAvgCost,
                  totalCost: ingDeduction * curAvgCost,
                  referenceType: 'ORDER',
                  referenceId: order.id,
                  reason: `Penjualan Resep POS #${order.orderNumber}`,
                  responsibleUserId: user.id,
                },
              });
            }
          }
        }
      }

      // c. Buat OrderPromotion Snapshot (jika promo diaplikasikan)
      if (appliedPromoObj) {
        await tx.orderPromotion.create({
          data: {
            orderId: order.id,
            promotionId: appliedPromoObj.promotionId,
            sequenceNo: 1,
            promotionNameSnapshot: appliedPromoObj.name,
            promotionCodeSnapshot: appliedPromoObj.code,
            discountTypeSnapshot: appliedPromoObj.discountType,
            discountScopeSnapshot: appliedPromoObj.scope,
            valueSnapshot: appliedPromoObj.value,
            maxDiscountSnapshot: appliedPromoObj.maxDiscount,
            discountAmount: appliedPromoObj.discountAmount,
          },
        });

        // Increment usage count
        await tx.promotion.update({
          where: { id: appliedPromoObj.promotionId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // d. Buat Payment Record
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          shiftId: activeShift.id,
          method: paymentMethod,
          status: 'PAID',
          amount: grandTotal,
          cashReceived: paymentMethod === 'CASH' ? numCashReceived : null,
          changeAmount: paymentMethod === 'CASH' ? changeAmount : null,
          paidAt: new Date(),
        },
      });

      return {
        order,
        payment,
      };
    });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/pos/shift');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/movements');
    revalidatePath('/dashboard/promotions');

    return {
      success: true,
      data: {
        orderNumber: transactionResult.order.orderNumber,
        queueNumber: transactionResult.order.queueNumber,
        grandTotal,
        promotionDiscount: totalPromoDiscount,
        cashPayable,
        cashReceived: numCashReceived,
        changeAmount,
        paymentMethod,
      },
    };
  } catch (error) {
    console.error('[processPosCheckout] Error:', error);
    const isSessionError = Boolean(error.message?.includes('Sesi tidak valid'));
    return {
      error: error.message || 'Gagal memproses pembayaran kasir.',
      sessionRevoked: isSessionError,
    };
  }
}

/**
 * Mengambil riwayat transaksi Order pada shift kasir yang sedang aktif (OPEN).
 * Digunakan untuk pemantauan transaksi kasir dan cetak ulang struk thermal.
 */
export async function getShiftTransactions() {
  try {
    const { user, storeId } = await getAuthenticatedUserAndStore();

    // 1. Ambil data shift aktif saat ini
    const activeShift = await prisma.shift.findFirst({
      where: {
        storeId,
        userId: user.id,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });

    // Ambil info store & settings untuk pencetakan struk
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    });

    const storeInfo = {
      name: store?.name || 'Schaw Cafe',
      code: store?.code || 'MAIN',
      logoUrl: store?.logoUrl || null,
      printerWidth: store?.settings?.printerWidth || 58,
      taxRate: Number(store?.settings?.taxRate || 0),
      taxEnabled: store?.settings?.taxEnabled || false,
      serviceChargeRate: Number(store?.settings?.serviceChargeRate || 0),
      serviceChargeEnabled: store?.settings?.serviceChargeEnabled || false,
      timezone: store?.settings?.timezone || 'Asia/Jakarta',
    };

    if (!activeShift) {
      return {
        data: {
          shift: null,
          store: storeInfo,
          transactions: [],
        },
      };
    }

    // 2. Ambil transaksi pesanan yang pembayarannya tercatat pada shift ini
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        payment: {
          shiftId: activeShift.id,
        },
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        customer: true,
        payment: true,
        promotions: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 3. Serialisasi Decimal fields ke Number agar aman dikirim ke Client Components
    const serializedOrders = orders.map((order) => ({
      ...order,
      createdAt: order.createdAt?.toISOString?.() || null,
      updatedAt: order.updatedAt?.toISOString?.() || null,
      paidAt: order.paidAt?.toISOString?.() || null,
      productSubtotal: Number(order.productSubtotal || 0),
      promotionDiscount: Number(order.promotionDiscount || 0),
      taxableSubtotal: Number(order.taxableSubtotal || 0),
      serviceChargeRate: Number(order.serviceChargeRate || 0),
      serviceChargeAmount: Number(order.serviceChargeAmount || 0),
      taxRate: Number(order.taxRate || 0),
      taxBase: Number(order.taxBase || 0),
      taxAmount: Number(order.taxAmount || 0),
      grandTotal: Number(order.grandTotal || 0),
      roundingAmount: Number(order.roundingAmount || 0),
      cashPayable: Number(order.cashPayable || 0),
      payment: order.payment
        ? {
            ...order.payment,
            amount: Number(order.payment.amount || 0),
            cashReceived: order.payment.cashReceived ? Number(order.payment.cashReceived) : null,
            changeAmount: order.payment.changeAmount ? Number(order.payment.changeAmount) : null,
            paidAt: order.payment.paidAt?.toISOString?.() || null,
            createdAt: order.payment.createdAt?.toISOString?.() || null,
          }
        : null,
      items: (order.items || []).map((item) => ({
        ...item,
        createdAt: item.createdAt?.toISOString?.() || null,
        unitPrice: Number(item.unitPrice || 0),
        promotionDiscount: Number(item.promotionDiscount || 0),
        subtotal: Number(item.subtotal || 0),
        hppUnit: Number(item.hppUnit || 0),
        hppTotal: Number(item.hppTotal || 0),
        product: item.product
          ? {
              ...item.product,
              price: Number(item.product.price || 0),
              createdAt: item.product.createdAt?.toISOString?.() || null,
              updatedAt: item.product.updatedAt?.toISOString?.() || null,
            }
          : null,
        variant: item.variant
          ? {
              ...item.variant,
              price: Number(item.variant.price || 0),
              createdAt: item.variant.createdAt?.toISOString?.() || null,
              updatedAt: item.variant.updatedAt?.toISOString?.() || null,
            }
          : null,
      })),
      promotions: (order.promotions || []).map((promo) => ({
        ...promo,
        valueSnapshot: Number(promo.valueSnapshot || 0),
        maxDiscountSnapshot: promo.maxDiscountSnapshot ? Number(promo.maxDiscountSnapshot) : null,
        discountAmount: Number(promo.discountAmount || 0),
        createdAt: promo.createdAt?.toISOString?.() || null,
      })),
      customer: order.customer
        ? {
            ...order.customer,
            createdAt: order.customer.createdAt?.toISOString?.() || null,
            updatedAt: order.customer.updatedAt?.toISOString?.() || null,
          }
        : null,
    }));

    return {
      data: {
        shift: {
          id: activeShift.id,
          openedAt: (activeShift.openedAt || activeShift.createdAt)?.toISOString?.() || null,
          startTime: (activeShift.openedAt || activeShift.createdAt)?.toISOString?.() || null,
          openingCash: Number(activeShift.openingCash || 0),
          user: activeShift.user,
        },
        store: storeInfo,
        transactions: serializedOrders,
      },
    };
  } catch (error) {
    console.error('[getShiftTransactions] Error:', error);
    const isSessionError = Boolean(error.message?.includes('Sesi tidak valid'));
    return {
      error: error.message || 'Gagal memuat riwayat transaksi shift.',
      sessionRevoked: isSessionError,
    };
  }
}
