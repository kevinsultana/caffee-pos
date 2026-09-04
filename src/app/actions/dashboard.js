'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';
import { hasPermission } from '@/lib/permissions';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  if (user.role?.name !== 'OWNER' && !hasPermission(user, 'MENU_DASHBOARD')) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengakses Dashboard Ringkasan Bisnis.');
  }
  return { user, storeId: user.storeId };
}

function getDateRange(period = 'TODAY') {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (period === 'TODAY') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'YESTERDAY') {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'THIS_WEEK') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'THIS_MONTH') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // ALL
    start = new Date(2020, 0, 1);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Mengambil metrik analitik dashboard utama:
 * Sesuai dokumen 05-REPORTS-DASHBOARD.md
 */
export async function getDashboardMetrics(period = 'TODAY') {
  try {
    const { storeId } = await getAuthenticatedUserAndStore();
    const { start, end } = getDateRange(period);

    // Filter umum untuk order berstatus PAID dalam rentang waktu yang dipilih
    const orderWherePaid = {
      storeId,
      status: 'PAID',
      createdAt: { gte: start, lte: end },
    };

    // 1. Order Aggregates (Gross Sales, Diskon, Pajak, Service Charge, Grand Total, Order Count)
    // Dieksekusi langsung oleh PostgreSQL via prisma.order.aggregate
    const orderAggPromise = prisma.order.aggregate({
      where: orderWherePaid,
      _count: {
        id: true,
      },
      _sum: {
        productSubtotal: true,
        promotionDiscount: true,
        taxAmount: true,
        serviceChargeAmount: true,
        grandTotal: true,
      },
    });

    // 2. HPP (Cost of Goods Sold) Aggregate dari OrderItem
    // Dieksekusi langsung oleh PostgreSQL via prisma.orderItem.aggregate
    const hppAggPromise = prisma.orderItem.aggregate({
      where: {
        order: orderWherePaid,
      },
      _sum: {
        hppTotal: true,
      },
    });

    // 3. Breakdown Pembayaran (CASH vs QRIS)
    // Dikelompokkan oleh PostgreSQL via prisma.payment.groupBy
    const paymentGroupPromise = prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: orderWherePaid,
        status: 'PAID',
      },
      _sum: {
        amount: true,
      },
    });

    // 4. Top 5 Produk Terlaris (Berdasarkan Kuantitas & Pendapatan)
    // Dikelompokkan & diurutkan langsung oleh PostgreSQL via prisma.orderItem.groupBy
    const topProductsGroupPromise = prisma.orderItem.groupBy({
      by: ['productNameSnapshot'],
      where: {
        order: orderWherePaid,
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    // 5. 10 Transaksi Terbaru (Lean Select)
    const recentOrdersPromise = prisma.order.findMany({
      where: orderWherePaid,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        queueNumber: true,
        customerNameSnapshot: true,
        grandTotal: true,
        createdAt: true,
        payment: {
          select: {
            method: true,
          },
        },
      },
    });

    // 6. Low Stock Alerts (Bahan Baku Inventaris)
    const inventoryItemsPromise = prisma.inventoryItem.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        minimumStock: true,
        baseUnit: { select: { code: true } },
        balance: { select: { quantity: true } },
      },
    });

    // Jalankan seluruh query di atas secara paralel (Concurrent DB Execution)
    const [
      orderAgg,
      hppAgg,
      paymentGroups,
      topItemGroups,
      recentOrdersData,
      inventoryItems,
    ] = await Promise.all([
      orderAggPromise,
      hppAggPromise,
      paymentGroupPromise,
      topProductsGroupPromise,
      recentOrdersPromise,
      inventoryItemsPromise,
    ]);

    // Format hasil agregasi matematis
    const grossSales = Number(orderAgg._sum.productSubtotal || 0);
    const totalDiscount = Number(orderAgg._sum.promotionDiscount || 0);
    const totalTax = Number(orderAgg._sum.taxAmount || 0);
    const totalServiceCharge = Number(orderAgg._sum.serviceChargeAmount || 0);
    const totalGrandTotal = Number(orderAgg._sum.grandTotal || 0);
    const orderCount = orderAgg._count.id || 0;

    const totalHpp = Number(hppAgg._sum.hppTotal || 0);

    let cashSales = 0;
    let qrisSales = 0;
    for (const pg of paymentGroups) {
      if (pg.method === 'CASH') {
        cashSales = Number(pg._sum.amount || 0);
      } else if (pg.method === 'QRIS') {
        qrisSales = Number(pg._sum.amount || 0);
      }
    }

    const netSales = Math.max(0, grossSales - totalDiscount);
    const grossProfit = netSales - totalHpp;
    const aov = orderCount > 0 ? Math.round(netSales / orderCount) : 0;

    const topProducts = topItemGroups.map((g) => ({
      name: g.productNameSnapshot,
      quantity: g._sum.quantity || 0,
      revenue: Number(g._sum.subtotal || 0),
    }));

    const stockAlerts = inventoryItems
      .filter((it) => {
        const qty = it.balance ? Number(it.balance.quantity) : 0;
        const min = it.minimumStock ? Number(it.minimumStock) : 0;
        return qty <= min || qty < 0;
      })
      .map((it) => ({
        id: it.id,
        name: it.name,
        currentQty: it.balance ? Number(it.balance.quantity) : 0,
        minimumStock: it.minimumStock ? Number(it.minimumStock) : 0,
        unitCode: it.baseUnit?.code || '',
        isNegative: it.balance ? Number(it.balance.quantity) < 0 : false,
      }));

    const recentOrders = recentOrdersData.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      queueNumber: o.queueNumber,
      customerName: o.customerNameSnapshot,
      grandTotal: Number(o.grandTotal),
      paymentMethod: o.payment?.method || 'CASH',
      createdAt: o.createdAt,
    }));

    return {
      data: {
        period,
        grossSales,
        totalDiscount,
        netSales,
        totalHpp,
        grossProfit,
        profitMargin: netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0,
        totalTax,
        totalServiceCharge,
        totalGrandTotal,
        orderCount,
        aov,
        cashSales,
        qrisSales,
        topProducts,
        stockAlerts,
        recentOrders,
      },
    };
  } catch (error) {
    console.error('[getDashboardMetrics] Error:', error);
    return { error: error.message || 'Gagal memuat metrik dashboard.' };
  }
}
