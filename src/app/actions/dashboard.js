'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';

async function getAuthenticatedUserAndStore() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
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

    // 1. Ambil Order dengan status PAID dalam rentang periode
    const paidOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Kalkulasi Metrik Penjualan & Profit
    let grossSales = 0;
    let totalDiscount = 0;
    let totalHpp = 0;
    let totalTax = 0;
    let totalServiceCharge = 0;
    let totalGrandTotal = 0;
    let cashSales = 0;
    let qrisSales = 0;

    const productSalesMap = new Map();

    for (const order of paidOrders) {
      grossSales += Number(order.productSubtotal);
      totalDiscount += Number(order.promotionDiscount);
      totalTax += Number(order.taxAmount);
      totalServiceCharge += Number(order.serviceChargeAmount);
      totalGrandTotal += Number(order.grandTotal);

      if (order.payment?.status === 'PAID') {
        if (order.payment.method === 'CASH') {
          cashSales += Number(order.payment.amount);
        } else if (order.payment.method === 'QRIS') {
          qrisSales += Number(order.payment.amount);
        }
      }

      for (const item of order.items) {
        totalHpp += Number(item.hppTotal);

        // Agregasi top products
        const prev = productSalesMap.get(item.productNameSnapshot) || {
          name: item.productNameSnapshot,
          quantity: 0,
          revenue: 0,
        };
        prev.quantity += item.quantity;
        prev.revenue += Number(item.subtotal);
        productSalesMap.set(item.productNameSnapshot, prev);
      }
    }

    const orderCount = paidOrders.length;
    const netSales = Math.max(0, grossSales - totalDiscount);
    // Gross Profit = Net Sales - HPP (Pajak & Service Charge BUKAN revenue Gross Profit)
    const grossProfit = netSales - totalHpp;
    const aov = orderCount > 0 ? Math.round(netSales / orderCount) : 0;

    // Top Selling Products (Sorted by Quantity)
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 3. Low Stock Alerts (Bahan baku yang stoknya <= minimumStock atau minus)
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { storeId },
      include: { balance: true, baseUnit: true },
    });

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

    // 4. Recent Transactions (10 transaksi terbaru)
    const recentOrders = paidOrders.slice(0, 10).map((o) => ({
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
