'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

function generateOrderNumber() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yy}${mm}${dd}-${rand}`;
}

function generatePublicToken() {
  return 'QR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Mendapatkan store default untuk customer publik.
 */
async function getDefaultStore() {
  let store = await prisma.store.findFirst({
    include: { settings: true },
  });
  return store;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC MENU DATA (UNTUK PELANGGAN DI /menu)
// ══════════════════════════════════════════════════════════════════════════════

export async function getPublicMenuData() {
  try {
    const store = await getDefaultStore();
    if (!store) {
      return { error: 'Toko belum dikonfigurasi.' };
    }

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          storeId: store.id,
          discontinued: false,
          availability: 'AVAILABLE',
        },
        orderBy: { name: 'asc' },
        include: {
          category: true,
        },
      }),
      prisma.productCategory.findMany({
        where: { storeId: store.id },
        orderBy: { name: 'asc' },
      }),
    ]);

    const serializedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || null,
      price: Number(p.price),
      type: p.type,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.category?.name,
    }));

    return {
      data: {
        store: {
          id: store.id,
          name: store.name,
          timezone: store.timezone,
        },
        settings: store.settings
          ? {
              taxEnabled: store.settings.taxEnabled,
              taxRate: Number(store.settings.taxRate),
              taxBaseIncludesServiceCharge: store.settings.taxBaseIncludesServiceCharge,
              serviceChargeEnabled: store.settings.serviceChargeEnabled,
              serviceChargeRate: Number(store.settings.serviceChargeRate),
            }
          : null,
        categories,
        products: serializedProducts,
      },
    };
  } catch (error) {
    console.error('[getPublicMenuData] Error:', error);
    return { error: error.message || 'Gagal memuat daftar menu publik.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CREATE PUBLIC QR ORDER (PELANGGAN MEMESAN LEWAT QR)
// ══════════════════════════════════════════════════════════════════════════════

export async function createPublicQrOrder({
  customerName,
  customerPhone = '',
  notes = '',
  items,
}) {
  try {
    const store = await getDefaultStore();
    if (!store) {
      return { error: 'Toko belum dikonfigurasi.' };
    }

    if (!customerName?.trim()) {
      return { error: 'Nama pemesan wajib diisi.' };
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { error: 'Keranjang belanja Anda masih kosong.' };
    }

    const settings = store.settings || {
      taxEnabled: false,
      taxRate: 0,
      taxBaseIncludesServiceCharge: false,
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
    };

    // Ambil produk dari database
    const productIds = items.map((it) => it.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: store.id,
        discontinued: false,
        availability: 'AVAILABLE',
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let productSubtotal = 0;
    const orderItemsData = [];

    for (const it of items) {
      const dbProd = productMap.get(it.productId);
      if (!dbProd) {
        return { error: 'Salah satu produk yang dipesan sudah tidak tersedia.' };
      }

      const qty = Number(it.quantity) || 1;
      const unitPrice = Number(dbProd.price);
      const subtotal = unitPrice * qty;
      productSubtotal += subtotal;

      orderItemsData.push({
        productId: dbProd.id,
        productNameSnapshot: dbProd.name,
        quantity: qty,
        unitPrice,
        promotionDiscount: 0,
        subtotal,
        hppUnit: 0, // Akan dihitung saat kasir konfirmasi bayar
        hppTotal: 0,
        notes: it.notes?.trim() || null,
      });
    }

    const promotionDiscount = 0;
    const taxableSubtotal = productSubtotal - promotionDiscount;

    const scRate = settings.serviceChargeEnabled ? Number(settings.serviceChargeRate) : 0;
    const scAmount = Math.round(taxableSubtotal * (scRate / 100) * 100) / 100;

    const taxRate = settings.taxEnabled ? Number(settings.taxRate) : 0;
    const taxBase = settings.taxBaseIncludesServiceCharge
      ? taxableSubtotal + scAmount
      : taxableSubtotal;
    const taxAmount = Math.round(taxBase * (taxRate / 100) * 100) / 100;

    const grandTotal = taxableSubtotal + scAmount + taxAmount;

    const orderNumber = generateOrderNumber();
    const publicQrToken = generatePublicToken();

    // 1 Jam Expiration (Sesuai Aturan Source of Truth)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        orderNumber,
        source: 'PUBLIC_QR',
        status: 'PENDING_PAYMENT',
        publicQrToken,
        expiresAt,
        customerNameSnapshot: customerName.trim(),
        customerPhoneSnapshot: customerPhone.trim() || null,
        productSubtotal,
        promotionDiscount,
        taxableSubtotal,
        serviceChargeRate: scRate,
        serviceChargeAmount: scAmount,
        taxRate,
        taxBase,
        taxAmount,
        grandTotal,
        roundingAmount: 0,
        cashPayable: grandTotal,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    revalidatePath('/dashboard/pos');

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        publicQrToken: order.publicQrToken,
        customerName: order.customerNameSnapshot,
        grandTotal: Number(order.grandTotal),
        expiresAt: order.expiresAt,
        itemsCount: order.items.length,
      },
    };
  } catch (error) {
    console.error('[createPublicQrOrder] Error:', error);
    return { error: error.message || 'Gagal mengirim pesanan QR.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET PENDING PUBLIC QR ORDERS (UNTUK LAYAR KASIR POS)
// ══════════════════════════════════════════════════════════════════════════════

export async function getPublicPendingOrders() {
  try {
    const user = await verifySession();
    if (!user) throw new Error('Sesi tidak valid.');

    const now = new Date();

    // 1. Bersihkan pesanan expired (status PENDING_PAYMENT yang melewati 1 jam)
    await prisma.order.deleteMany({
      where: {
        storeId: user.storeId,
        source: 'PUBLIC_QR',
        status: 'PENDING_PAYMENT',
        expiresAt: { lte: now },
      },
    });

    // 2. Ambil pesanan yang masih aktif
    const pendingOrders = await prisma.order.findMany({
      where: {
        storeId: user.storeId,
        source: 'PUBLIC_QR',
        status: 'PENDING_PAYMENT',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });

    const serialized = pendingOrders.map((o) => ({
      ...o,
      productSubtotal: Number(o.productSubtotal),
      taxableSubtotal: Number(o.taxableSubtotal),
      serviceChargeAmount: Number(o.serviceChargeAmount),
      taxAmount: Number(o.taxAmount),
      grandTotal: Number(o.grandTotal),
      cashPayable: Number(o.cashPayable),
      items: o.items.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
      })),
    }));

    return { data: serialized };
  } catch (error) {
    console.error('[getPublicPendingOrders] Error:', error);
    return { error: error.message || 'Gagal memuat pesanan online.' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. CONFIRM & PAY PUBLIC QR ORDER (KASIR MENERIMA PEMBAYARAN)
// ══════════════════════════════════════════════════════════════════════════════

export async function confirmPublicQrPayment({
  orderId,
  queueNumber,
  paymentMethod = 'CASH',
  cashReceived = 0,
}) {
  try {
    const user = await verifySession();
    if (!user) throw new Error('Sesi tidak valid.');

    // 1. Cek shift aktif kasir
    const activeShift = await prisma.shift.findFirst({
      where: {
        storeId: user.storeId,
        userId: user.id,
        status: 'OPEN',
      },
    });

    if (!activeShift) {
      return { error: 'Anda belum membuka shift kasir. Silakan buka shift terlebih dahulu.' };
    }

    if (!queueNumber?.trim()) {
      return { error: 'Nomor antrean (Queue Number) wajib diisi.' };
    }

    const now = new Date();

    // 2. Ambil Order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return { error: 'Pesanan tidak ditemukan.' };
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return { error: 'Pesanan ini sudah pernah dibayar atau dibatalkan.' };
    }

    if (order.expiresAt && order.expiresAt <= now) {
      // Hapus jika sudah expired
      await prisma.order.delete({ where: { id: orderId } });
      return {
        error: 'Pesanan ini sudah kedaluwarsa (melebihi batas 1 jam) dan telah dibatalkan otomatis.',
      };
    }

    const grandTotal = Number(order.grandTotal);
    let cashPayable = grandTotal;
    let roundingAmount = 0;

    // Ambil store settings untuk pembulatan tunai
    const store = await prisma.store.findUnique({
      where: { id: user.storeId },
      include: { settings: true },
    });

    if (
      paymentMethod === 'CASH' &&
      store?.settings?.cashRoundingEnabled &&
      Number(store.settings.cashRoundingUnit) > 0
    ) {
      const unit = Number(store.settings.cashRoundingUnit);
      cashPayable = Math.round(grandTotal / unit) * unit;
      roundingAmount = cashPayable - grandTotal;
    }

    const numCashReceived = Number(cashReceived);
    if (paymentMethod === 'CASH' && numCashReceived < cashPayable) {
      return {
        error: `Uang tunai yang diterima (${numCashReceived}) kurang dari total tagihan (${cashPayable}).`,
      };
    }
    const changeAmount = paymentMethod === 'CASH' ? numCashReceived - cashPayable : 0;

    // 3. Ambil produk & stok inventaris
    const productIds = order.items.map((it) => it.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        inventoryItem: { include: { balance: true } },
        recipes: {
          include: {
            versions: {
              where: { isActive: true },
              include: {
                ingredients: {
                  include: { inventoryItem: { include: { balance: true } } },
                },
              },
            },
          },
        },
      },
    });

    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

    // ── 4. EKSEKUSI PRISMA TRANSACTION ATOMIC ────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // a. Update Order
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          queueNumber: queueNumber.trim(),
          createdById: user.id,
          roundingAmount,
          cashPayable,
          paidAt: new Date(),
        },
      });

      // b. Update OrderItem HPP & Potong Stok Fisik
      for (const item of order.items) {
        const dbProd = prodMap.get(item.productId);
        if (!dbProd) continue;

        let hppUnit = 0;
        if (dbProd.type === 'DIRECT_STOCK' && dbProd.inventoryItem?.balance) {
          hppUnit = Number(dbProd.inventoryItem.balance.averageCost) || 0;
        } else if (dbProd.type === 'RECIPE') {
          const activeRec = dbProd.recipes[0]?.versions[0];
          if (activeRec?.ingredients) {
            for (const ing of activeRec.ingredients) {
              const ingAvg = Number(ing.inventoryItem?.balance?.averageCost) || 0;
              hppUnit += Number(ing.quantity) * ingAvg;
            }
          }
        }
        const hppTotal = hppUnit * item.quantity;

        // Update HPP di order item
        await tx.orderItem.update({
          where: { id: item.id },
          data: { hppUnit, hppTotal },
        });

        // Potong stok inventaris:
        if (dbProd.type === 'DIRECT_STOCK' && dbProd.inventoryItemId) {
          const invId = dbProd.inventoryItemId;
          const currentBal = await tx.inventoryBalance.findUnique({
            where: { inventoryItemId: invId },
          });

          const curQty = currentBal ? Number(currentBal.quantity) : 0;
          const curAvgCost = currentBal ? Number(currentBal.averageCost) : 0;
          const deltaQty = item.quantity;
          const newQty = curQty - deltaQty;
          const newStockVal = newQty * curAvgCost;

          await tx.inventoryBalance.upsert({
            where: { inventoryItemId: invId },
            update: { quantity: newQty, stockValue: newStockVal },
            create: {
              inventoryItemId: invId,
              quantity: newQty,
              averageCost: curAvgCost,
              stockValue: newStockVal,
            },
          });

          await tx.stockMovement.create({
            data: {
              storeId: user.storeId,
              inventoryItemId: invId,
              type: 'SALE',
              quantityDelta: -deltaQty,
              unitCost: curAvgCost,
              totalCost: deltaQty * curAvgCost,
              referenceType: 'ORDER',
              referenceId: order.id,
              reason: `Penjualan Public QR #${order.orderNumber}`,
              responsibleUserId: user.id,
            },
          });
        }

        if (dbProd.type === 'RECIPE') {
          const activeRec = dbProd.recipes[0]?.versions[0];
          if (activeRec?.ingredients) {
            for (const ing of activeRec.ingredients) {
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
                update: { quantity: newQty, stockValue: newStockVal },
                create: {
                  inventoryItemId: ingInvId,
                  quantity: newQty,
                  averageCost: curAvgCost,
                  stockValue: newStockVal,
                },
              });

              await tx.stockMovement.create({
                data: {
                  storeId: user.storeId,
                  inventoryItemId: ingInvId,
                  type: 'SALE',
                  quantityDelta: -ingDeduction,
                  unitCost: curAvgCost,
                  totalCost: ingDeduction * curAvgCost,
                  referenceType: 'ORDER',
                  referenceId: order.id,
                  reason: `Penjualan Public QR Resep #${order.orderNumber}`,
                  responsibleUserId: user.id,
                },
              });
            }
          }
        }
      }

      // c. Buat Payment Record
      await tx.payment.create({
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
    });

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/pos/shift');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/movements');

    return {
      success: true,
      data: {
        orderNumber: order.orderNumber,
        queueNumber: queueNumber.trim(),
        grandTotal,
        cashPayable,
        cashReceived: numCashReceived,
        changeAmount,
        paymentMethod,
      },
    };
  } catch (error) {
    console.error('[confirmPublicQrPayment] Error:', error);
    return { error: error.message || 'Gagal mengonfirmasi pembayaran pesanan QR.' };
  }
}
