'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPosInitData, processPosCheckout } from '@/app/actions/pos';
import { validatePromoCode } from '@/app/actions/promotion';
import {
  getPublicPendingOrders,
  confirmPublicQrPayment,
} from '@/app/actions/publicQr';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';

export default function PosScreenPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Mode Tab: 'CATALOG' | 'ONLINE_ORDERS'
  const [activeTab, setActiveTab] = useState('CATALOG');

  // Master Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeShift, setActiveShift] = useState(null);

  // Online Orders State
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedQrOrder, setSelectedQrOrder] = useState(null);
  const [qrCheckoutModalOpen, setQrCheckoutModalOpen] = useState(false);
  const [qrQueueNumber, setQrQueueNumber] = useState('A-01');
  const [qrPaymentMethod, setQrPaymentMethod] = useState('CASH');
  const [qrCashReceived, setQrCashReceived] = useState(0);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('Pelanggan');
  const [customerPhone, setCustomerPhone] = useState('');
  const [queueNumber, setQueueNumber] = useState('A-01');

  // Promo Code State
  const [inputPromoCode, setInputPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'QRIS'
  const [cashReceived, setCashReceived] = useState(0);

  async function loadData() {
    setLoading(true);
    const [initRes, pendingRes] = await Promise.all([
      getPosInitData(),
      getPublicPendingOrders(),
    ]);

    if (initRes.error) {
      toast.error(initRes.error);
    } else {
      setProducts(initRes.data.products || []);
      setCategories(initRes.data.categories || []);
      setSettings(initRes.data.settings);
      setActiveShift(initRes.data.activeShift);
    }

    if (pendingRes.data) {
      setPendingOrders(pendingRes.data);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // Poll pending orders every 30s
    const timer = setInterval(async () => {
      const res = await getPublicPendingOrders();
      if (res.data) setPendingOrders(res.data);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // CART OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════

  function addToCart(product) {
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          notes: '',
        },
      ]);
    }
  }

  function updateQuantity(index, delta) {
    const newCart = [...cart];
    const newQty = newCart[index].quantity + delta;

    if (newQty <= 0) {
      setCart(newCart.filter((_, idx) => idx !== index));
    } else {
      newCart[index].quantity = newQty;
      setCart(newCart);
    }
  }

  function updateNotes(index, notes) {
    const newCart = [...cart];
    newCart[index].notes = notes;
    setCart(newCart);
  }

  function clearCart() {
    setCart([]);
    setAppliedPromo(null);
    setInputPromoCode('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROMO CODE APPLICATION
  // ══════════════════════════════════════════════════════════════════════════

  async function handleApplyPromo(e) {
    e.preventDefault();
    if (!inputPromoCode.trim()) {
      toast.error('Masukkan kode promo terlebih dahulu.');
      return;
    }

    if (cart.length === 0) {
      toast.error('Keranjang masih kosong.');
      return;
    }

    setIsValidatingPromo(true);
    const res = await validatePromoCode({
      code: inputPromoCode.trim(),
      cartItems: cart,
    });

    if (res.error) {
      toast.error(res.error, { duration: 4000 });
      setAppliedPromo(null);
    } else {
      setAppliedPromo(res.data);
      toast.success(
        `Kode promo "${res.data.code}" aktif! Hemat ${formatRupiah(res.data.discountAmount)}`
      );
    }
    setIsValidatingPromo(false);
  }

  function removePromo() {
    setAppliedPromo(null);
    setInputPromoCode('');
    toast('Kode promo dihapus.', { icon: 'ℹ️' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCIAL CALCULATIONS (STORE SETTINGS COMPLIANT)
  // ══════════════════════════════════════════════════════════════════════════

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const promotionDiscount = appliedPromo ? Number(appliedPromo.discountAmount) : 0;
  const taxableSubtotal = Math.max(0, subtotal - promotionDiscount);

  const scRate = settings?.serviceChargeEnabled ? Number(settings.serviceChargeRate) : 0;
  const serviceChargeAmount = Math.round(taxableSubtotal * (scRate / 100) * 100) / 100;

  const taxRate = settings?.taxEnabled ? Number(settings.taxRate) : 0;
  const taxBase = settings?.taxBaseIncludesServiceCharge
    ? taxableSubtotal + serviceChargeAmount
    : taxableSubtotal;
  const taxAmount = Math.round(taxBase * (taxRate / 100) * 100) / 100;

  const rawGrandTotal = taxableSubtotal + serviceChargeAmount + taxAmount;

  // Cash rounding
  let cashPayable = rawGrandTotal;
  let roundingAmount = 0;
  if (
    paymentMethod === 'CASH' &&
    settings?.cashRoundingEnabled &&
    Number(settings.cashRoundingUnit) > 0
  ) {
    const unit = Number(settings.cashRoundingUnit);
    cashPayable = Math.round(rawGrandTotal / unit) * unit;
    roundingAmount = cashPayable - rawGrandTotal;
  }

  const effectiveTotal = paymentMethod === 'CASH' ? cashPayable : rawGrandTotal;
  const changeAmount =
    paymentMethod === 'CASH' && Number(cashReceived) >= effectiveTotal
      ? Number(cashReceived) - effectiveTotal
      : 0;

  // ══════════════════════════════════════════════════════════════════════════
  // CHECKOUT HANDLERS (NORMAL POS)
  // ══════════════════════════════════════════════════════════════════════════

  function openCheckout() {
    if (cart.length === 0) {
      toast.error('Keranjang belanja masih kosong.');
      return;
    }
    if (!queueNumber.trim()) {
      toast.error('Nomor antrean wajib diisi.');
      return;
    }
    setCashReceived(effectiveTotal);
    setCheckoutModalOpen(true);
  }

  function handleProcessCheckout(e) {
    e.preventDefault();

    if (paymentMethod === 'CASH' && Number(cashReceived) < effectiveTotal) {
      toast.error('Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Memproses transaksi penjualan...');

      const payload = {
        customerName: customerName.trim() || 'Pelanggan',
        customerPhone: customerPhone.trim(),
        queueNumber: queueNumber.trim(),
        paymentMethod,
        promoCode: appliedPromo?.code || '',
        cashReceived: Number(cashReceived),
        items: cart.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.price,
          notes: it.notes,
        })),
      };

      const res = await processPosCheckout(payload);

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.dismiss(toastId);
        setCheckoutModalOpen(false);
        clearCart();

        const nextQNum = String(parseInt(queueNumber.replace(/\D/g, '') || '1') + 1).padStart(2, '0');
        setQueueNumber(`A-${nextQNum}`);

        const Swal = (await import('sweetalert2')).default;
        await Swal.fire({
          icon: 'success',
          title: 'Pembayaran Berhasil! 🎉',
          html: `
            <div class="text-left text-sm text-stone-300 space-y-2 p-2 font-mono">
              <div class="text-center py-2 border-b border-stone-800">
                <p class="text-xs text-stone-400">Nomor Antrean:</p>
                <p class="text-3xl font-extrabold text-amber-400">${res.data.queueNumber}</p>
                <p class="text-xs text-stone-500 mt-1">Order #${res.data.orderNumber}</p>
              </div>
              <div class="space-y-1 text-xs pt-2">
                ${
                  res.data.promotionDiscount > 0
                    ? `
                  <div class="flex justify-between text-emerald-400">
                    <span>Diskon Promo:</span>
                    <span>-${formatRupiah(res.data.promotionDiscount)}</span>
                  </div>
                `
                    : ''
                }
                <div class="flex justify-between">
                  <span class="text-stone-400">Total Tagihan:</span>
                  <span class="font-bold text-amber-300">${formatRupiah(res.data.grandTotal)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-stone-400">Metode Bayar:</span>
                  <span>${res.data.paymentMethod}</span>
                </div>
                ${
                  res.data.paymentMethod === 'CASH'
                    ? `
                  <div class="flex justify-between">
                    <span class="text-stone-400">Uang Diterima:</span>
                    <span>${formatRupiah(res.data.cashReceived)}</span>
                  </div>
                  <div class="flex justify-between text-emerald-400 font-bold">
                    <span>Kembalian:</span>
                    <span>${formatRupiah(res.data.changeAmount)}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          `,
          confirmButtonText: 'Transaksi Baru',
          confirmButtonColor: '#b45309',
          background: '#1c1917',
          color: '#fef3c7',
        });

        loadData();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC QR ORDER CHECKOUT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  function openQrOrderCheckout(order) {
    setSelectedQrOrder(order);
    setQrQueueNumber(`A-${String(pendingOrders.length).padStart(2, '0')}`);
    setQrPaymentMethod('CASH');
    setQrCashReceived(order.grandTotal);
    setQrCheckoutModalOpen(true);
  }

  function handleProcessQrCheckout(e) {
    e.preventDefault();
    if (!selectedQrOrder) return;

    if (qrPaymentMethod === 'CASH' && Number(qrCashReceived) < selectedQrOrder.grandTotal) {
      toast.error('Uang tunai kurang dari total tagihan.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Memproses pembayaran pesanan QR...');
      const res = await confirmPublicQrPayment({
        orderId: selectedQrOrder.id,
        queueNumber: qrQueueNumber.trim(),
        paymentMethod: qrPaymentMethod,
        cashReceived: Number(qrCashReceived),
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.dismiss(toastId);
        setQrCheckoutModalOpen(false);
        setSelectedQrOrder(null);

        const Swal = (await import('sweetalert2')).default;
        await Swal.fire({
          icon: 'success',
          title: 'Pembayaran QR Selesai! 🎉',
          html: `
            <div class="text-left text-sm text-stone-300 space-y-2 p-2 font-mono">
              <div class="text-center py-2 border-b border-stone-800">
                <p class="text-xs text-stone-400">Nomor Antrean:</p>
                <p class="text-3xl font-extrabold text-amber-400">${res.data.queueNumber}</p>
                <p class="text-xs text-stone-500 mt-1">Order #${res.data.orderNumber}</p>
              </div>
              <div class="space-y-1 text-xs pt-2">
                <div class="flex justify-between">
                  <span class="text-stone-400">Total Tagihan:</span>
                  <span class="font-bold text-amber-300">${formatRupiah(res.data.grandTotal)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-stone-400">Metode Bayar:</span>
                  <span>${res.data.paymentMethod}</span>
                </div>
                ${
                  res.data.paymentMethod === 'CASH'
                    ? `
                  <div class="flex justify-between">
                    <span class="text-stone-400">Uang Diterima:</span>
                    <span>${formatRupiah(res.data.cashReceived)}</span>
                  </div>
                  <div class="flex justify-between text-emerald-400 font-bold">
                    <span>Kembalian:</span>
                    <span>${formatRupiah(res.data.changeAmount)}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          `,
          confirmButtonText: 'Selesai',
          confirmButtonColor: '#b45309',
          background: '#1c1917',
          color: '#fef3c7',
        });

        loadData();
      }
    });
  }

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCategory =
      selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        Memuat data kasir POS...
      </div>
    );
  }

  // ─── SHIFT NOT OPEN GUARD ────────────────────────────────────────────────
  if (!activeShift) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-5">
        <div className="inline-flex p-4 rounded-3xl bg-amber-950/40 border border-amber-800/40 text-amber-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-amber-50">Shift Kasir Belum Dibuka</h1>
        <p className="text-sm text-stone-400">
          Untuk memulai transaksi penjualan kasir, Anda wajib membuka shift dan memasukkan modal awal terlebih dahulu.
        </p>
        <Link
          href="/dashboard/pos/shift"
          className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-950 transition-all"
        >
          Buka Shift Sekarang &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── TOP MODE SWITCHER TABS ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2 bg-stone-900/90 p-1 rounded-2xl border border-stone-800">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
              activeTab === 'CATALOG'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                : 'text-stone-400 hover:text-stone-200'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Menu Kasir POS
          </button>
          <button
            onClick={() => setActiveTab('ONLINE_ORDERS')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative',
              activeTab === 'ONLINE_ORDERS'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                : 'text-stone-400 hover:text-stone-200'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            Pesanan Online QR
            {pendingOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/qr"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors hidden sm:flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
            </svg>
            Cetak QR Meja
          </Link>
          <Link
            href="/dashboard/pos/shift"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-stone-700 text-amber-300 border border-stone-700 transition-colors flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Shift Aktif
          </Link>
        </div>
      </div>

      {/* ─── TAB 1: CATALOG & NORMAL POS ───────────────────────────────────── */}
      {activeTab === 'CATALOG' ? (
        <div className="h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-4">
          {/* Left: Product Catalog */}
          <div className="flex-1 flex flex-col min-w-0 space-y-4">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Cari menu produk atau SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-900/80 border border-stone-800 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                  selectedCategory === 'ALL'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                    : 'bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800'
                )}
              >
                Semua Menu ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn(
                    'px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                    selectedCategory === c.id
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                      : 'bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-stone-500">
                  Tidak ada produk menu yang tersedia.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((prod) => {
                    return (
                      <button
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        className="group text-left p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800/80 hover:border-amber-600/60 hover:bg-stone-800/50 hover:shadow-lg transition-all flex flex-col justify-between h-36 relative overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                              {prod.category?.name}
                            </span>
                            {prod.type === 'RECIPE' ? (
                              <span className="text-[10px] text-amber-400/80 font-mono">Recipe</span>
                            ) : (
                              <span className="text-[10px] text-blue-400/80 font-mono">Direct Stock</span>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm text-amber-50 group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                            {prod.name}
                          </h3>
                        </div>

                        <div className="flex items-end justify-between pt-2 border-t border-stone-800/60">
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {formatRupiah(prod.price)}
                          </span>
                          <span className="p-1 rounded-lg bg-stone-800 group-hover:bg-amber-600 group-hover:text-white text-stone-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart & Checkout */}
          <div className="w-full lg:w-96 flex flex-col rounded-2xl border border-stone-800/80 bg-stone-900/60 overflow-hidden shadow-2xl">
            {/* Cart Header */}
            <div className="p-4 border-b border-stone-800 space-y-3 bg-stone-900/80">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-amber-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  Keranjang ({cart.reduce((s, i) => s + i.quantity, 0)})
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] font-semibold text-stone-500 hover:text-red-400 transition-colors"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {/* Queue & Customer Inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold text-stone-400 uppercase mb-1">
                    No. Antrean
                  </label>
                  <input
                    type="text"
                    value={queueNumber}
                    onChange={(e) => setQueueNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-amber-300 font-mono font-bold text-xs text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="A-01"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-stone-400 uppercase mb-1">
                    Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-amber-50 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Pelanggan"
                  />
                </div>
              </div>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 p-3 overflow-y-auto divide-y divide-stone-800/60 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  Keranjang masih kosong. Klik menu di samping untuk menambahkan.
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="not-first:pt-2 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-50 leading-tight">
                          {item.name}
                        </p>
                        <p className="text-[11px] font-mono text-stone-400">
                          {formatRupiah(item.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-amber-300">
                          {formatRupiah(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Catatan (opsional)..."
                        value={item.notes}
                        onChange={(e) => updateNotes(index, e.target.value)}
                        className="flex-1 px-2 py-1 bg-stone-800/60 border border-stone-800 rounded text-[11px] text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <div className="flex items-center gap-1.5 bg-stone-800 rounded-lg p-0.5 border border-stone-700">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-700 transition-colors text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold text-amber-100 px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white rounded hover:bg-stone-700 transition-colors text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Promo Code Input Section */}
            <div className="p-3 border-t border-stone-800/80 bg-stone-950/40 space-y-2">
              {appliedPromo ? (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-emerald-400">
                      {appliedPromo.code}
                    </span>
                    <p className="text-[11px] text-emerald-300/80">{appliedPromo.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      -{formatRupiah(appliedPromo.discountAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={removePromo}
                      className="p-1 text-stone-400 hover:text-red-400 rounded-lg transition-colors"
                      title="Hapus Promo"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Kode Promo..."
                    value={inputPromoCode}
                    onChange={(e) => setInputPromoCode(e.target.value.toUpperCase())}
                    disabled={isValidatingPromo || cart.length === 0}
                    className="flex-1 px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-xs uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isValidatingPromo || cart.length === 0 || !inputPromoCode.trim()}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-amber-600 text-amber-400 hover:text-white rounded-xl text-xs font-bold border border-stone-700 hover:border-amber-600 transition-all disabled:opacity-40"
                  >
                    {isValidatingPromo ? 'Cek...' : 'Terapkan'}
                  </button>
                </form>
              )}
            </div>

            {/* Financial Summary & Checkout Button */}
            <div className="p-4 border-t border-stone-800 bg-stone-900/90 space-y-3">
              <div className="text-xs space-y-1 text-stone-400">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-stone-200">{formatRupiah(subtotal)}</span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Diskon Promosi ({appliedPromo.code}):</span>
                    <span className="font-mono font-semibold">-{formatRupiah(promotionDiscount)}</span>
                  </div>
                )}

                {settings?.serviceChargeEnabled && (
                  <div className="flex justify-between">
                    <span>Service Charge ({settings.serviceChargeRate}%):</span>
                    <span className="font-mono text-stone-200">{formatRupiah(serviceChargeAmount)}</span>
                  </div>
                )}

                {settings?.taxEnabled && (
                  <div className="flex justify-between">
                    <span>Pajak PPN ({settings.taxRate}%):</span>
                    <span className="font-mono text-stone-200">{formatRupiah(taxAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between pt-1.5 border-t border-stone-800 font-bold text-sm">
                  <span className="text-amber-100">Total Tagihan:</span>
                  <span className="font-mono text-amber-400 text-base">
                    {formatRupiah(rawGrandTotal)}
                  </span>
                </div>
              </div>

              <button
                id="btn-checkout-pos"
                type="button"
                onClick={openCheckout}
                disabled={cart.length === 0}
                className="w-full py-3 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                Bayar / Checkout ({formatRupiah(rawGrandTotal)})
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── TAB 2: ONLINE ORDERS (PUBLIC QR) ─────────────────────────────── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-amber-50">
              Daftar Pesanan Meja (Public QR) Menunggu Pembayaran
            </h2>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="text-center py-20 bg-stone-900/40 rounded-3xl border border-stone-800/80 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-800 text-stone-500 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-400">
                Tidak ada pesanan online yang menunggu pembayaran.
              </p>
              <p className="text-xs text-stone-500">
                Pesanan yang dibuat oleh pelanggan via QR code akan muncul di sini secara otomatis.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingOrders.map((ord) => {
                const now = new Date().getTime();
                const exp = new Date(ord.expiresAt).getTime();
                const minsLeft = Math.max(0, Math.floor((exp - now) / 60000));

                return (
                  <div
                    key={ord.id}
                    className="p-5 rounded-3xl bg-stone-900/70 border border-stone-800 hover:border-amber-700/50 flex flex-col justify-between space-y-4 shadow-xl"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex px-3 py-1 rounded-xl text-xs font-black font-mono tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700/60">
                            {ord.publicQrToken}
                          </span>
                          <p className="text-xs text-stone-400 font-mono mt-1">
                            #{ord.orderNumber}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400/90 font-semibold bg-stone-800/80 px-2.5 py-1 rounded-lg">
                          ⏳ {minsLeft} mnt tersisa
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-amber-50">
                          {ord.customerNameSnapshot}
                        </p>
                        {ord.customerPhoneSnapshot && (
                          <p className="text-xs text-stone-400">
                            WA: {ord.customerPhoneSnapshot}
                          </p>
                        )}
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Dipesan: {formatDateTime(ord.createdAt)}
                        </p>
                      </div>

                      {/* Item list */}
                      <div className="p-3 bg-stone-950/60 rounded-2xl border border-stone-800/80 space-y-1.5 text-xs">
                        {ord.items?.map((it) => (
                          <div key={it.id} className="flex justify-between text-stone-300">
                            <span>
                              {it.quantity}x {it.productNameSnapshot}
                            </span>
                            <span className="font-mono text-stone-400">
                              {formatRupiah(it.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider block">
                          Total Tagihan
                        </span>
                        <span className="font-mono font-bold text-base text-amber-400">
                          {formatRupiah(ord.grandTotal)}
                        </span>
                      </div>
                      <button
                        onClick={() => openQrOrderCheckout(ord)}
                        className="px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Proses Bayar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL NORMAL CHECKOUT ─────────────────────────────────────────── */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="text-center pb-3 border-b border-stone-800">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
                Konfirmasi Pembayaran
              </p>
              <p className="text-3xl font-extrabold font-mono text-amber-400 mt-1">
                {formatRupiah(effectiveTotal)}
              </p>
              <div className="text-xs text-stone-500 mt-0.5 space-x-2">
                <span>Antrean #{queueNumber}</span>
                <span>&middot;</span>
                <span>{customerName}</span>
                {appliedPromo && (
                  <>
                    <span>&middot;</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {appliedPromo.code} (-{formatRupiah(appliedPromo.discountAmount)})
                    </span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleProcessCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Pilih Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setCashReceived(cashPayable);
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1',
                      paymentMethod === 'CASH'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400'
                    )}
                  >
                    TUNAI (CASH)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('QRIS');
                      setCashReceived(rawGrandTotal);
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1',
                      paymentMethod === 'QRIS'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400'
                    )}
                  >
                    QRIS (Non-Tunai)
                  </button>
                </div>
              </div>

              {paymentMethod === 'CASH' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest mb-1">
                      Uang Tunai Diterima (Rp)
                    </label>
                    <input
                      type="number"
                      min={effectiveTotal}
                      step="1000"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashReceived(effectiveTotal)}
                      className="py-1 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 200000].map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setCashReceived(nom)}
                        className="py-1 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700"
                      >
                        {formatRupiah(nom)}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-2xl flex items-center justify-between">
                    <span className="text-xs text-stone-400 font-medium">Uang Kembalian:</span>
                    <span className="font-mono text-lg font-extrabold text-emerald-400">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-stone-950/80 border border-blue-900/40 rounded-2xl text-center space-y-3">
                  <div className="w-28 h-28 mx-auto bg-white rounded-xl p-2 flex items-center justify-center">
                    <div className="w-full h-full border-2 border-stone-900 flex flex-col justify-between p-1">
                      <div className="flex justify-between">
                        <div className="w-4 h-4 bg-stone-900" />
                        <div className="w-4 h-4 bg-stone-900" />
                      </div>
                      <div className="text-[9px] font-bold text-stone-900">QRIS STANDAR</div>
                      <div className="flex justify-between">
                        <div className="w-4 h-4 bg-stone-900" />
                        <div className="w-2 h-2 bg-stone-900" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-stone-300">
                    Minta pelanggan memindai QRIS senilai{' '}
                    <span className="font-bold text-amber-300">{formatRupiah(rawGrandTotal)}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  disabled={isPending}
                  className="w-1/3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-pos-payment"
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Memproses...' : 'Selesaikan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL PUBLIC QR ORDER CHECKOUT ─────────────────────────────────── */}
      {qrCheckoutModalOpen && selectedQrOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="text-center pb-3 border-b border-stone-800">
              <span className="inline-flex px-3 py-1 rounded-xl text-xs font-black font-mono tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700/60">
                {selectedQrOrder.publicQrToken}
              </span>
              <p className="text-2xl font-extrabold font-mono text-amber-400 mt-2">
                {formatRupiah(selectedQrOrder.grandTotal)}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {selectedQrOrder.customerNameSnapshot} &bull; #{selectedQrOrder.orderNumber}
              </p>
            </div>

            <form onSubmit={handleProcessQrCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Tentukan Nomor Antrean (Queue No.) *
                </label>
                <input
                  type="text"
                  value={qrQueueNumber}
                  onChange={(e) => setQrQueueNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  Pilih Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQrPaymentMethod('CASH');
                      setQrCashReceived(selectedQrOrder.grandTotal);
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1',
                      qrPaymentMethod === 'CASH'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400'
                    )}
                  >
                    TUNAI (CASH)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQrPaymentMethod('QRIS');
                      setQrCashReceived(selectedQrOrder.grandTotal);
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1',
                      qrPaymentMethod === 'QRIS'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400'
                    )}
                  >
                    QRIS (Non-Tunai)
                  </button>
                </div>
              </div>

              {qrPaymentMethod === 'CASH' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-widest mb-1">
                      Uang Tunai Diterima (Rp)
                    </label>
                    <input
                      type="number"
                      min={selectedQrOrder.grandTotal}
                      step="1000"
                      value={qrCashReceived}
                      onChange={(e) => setQrCashReceived(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-amber-300 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-2xl flex items-center justify-between">
                    <span className="text-xs text-stone-400 font-medium">Uang Kembalian:</span>
                    <span className="font-mono text-lg font-extrabold text-emerald-400">
                      {formatRupiah(
                        Math.max(0, Number(qrCashReceived) - selectedQrOrder.grandTotal)
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-stone-950/80 border border-blue-900/40 rounded-2xl text-center space-y-1 text-xs text-stone-300">
                  <p className="font-semibold text-blue-300">Pembayaran QRIS</p>
                  <p>Pastikan notifikasi dana masuk telah diterima di EDC/Aplikasi kasir.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setQrCheckoutModalOpen(false)}
                  disabled={isPending}
                  className="w-1/3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Memproses...' : 'Posting & Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
