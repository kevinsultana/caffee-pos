'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { getPosInitData, processPosCheckout } from '@/app/actions/pos';
import { validatePromoCode } from '@/app/actions/promotion';
import { getCustomers, createCustomer } from '@/app/actions/customer';
import {
  getPublicPendingOrders,
  confirmPublicQrPayment,
} from '@/app/actions/publicQr';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function PosScreenPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Mode Tab: 'CATALOG' | 'ONLINE_ORDERS'
  const [activeTab, setActiveTab] = useState('CATALOG');

  // Master Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Online Orders State
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedQrOrder, setSelectedQrOrder] = useState(null);
  const [qrCheckoutModalOpen, setQrCheckoutModalOpen] = useState(false);
  const [qrQueueNumber, setQrQueueNumber] = useState('A-01');
  const [qrPaymentMethod, setQrPaymentMethod] = useState('CASH');
  const [qrCashReceived, setQrCashReceived] = useState(0);

  // Variant Modal State
  const [variantModalProduct, setVariantModalProduct] = useState(null);

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

  // Quick Create Customer Modal State
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [isCreatingCust, setIsCreatingCust] = useState(false);

  function openCustomerModal(initialName = '') {
    setNewCustName(initialName);
    setNewCustPhone('');
    setCustomerModalOpen(true);
  }

  async function handleCreateCustomerSubmit(e) {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('Nama pelanggan wajib diisi.');
      return;
    }

    setIsCreatingCust(true);
    try {
      const res = await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        const created = res.data;
        toast.success(`Member "${created.name}" berhasil didaftarkan!`);
        setCustomers((prev) => [created, ...prev]);
        setSelectedCustomerId(created.id);
        setCustomerName(created.name);
        setCustomerPhone(created.phone || '');
        setCustomerModalOpen(false);
        setNewCustName('');
        setNewCustPhone('');
      }
    } catch (err) {
      console.error('[handleCreateCustomerSubmit] Error:', err);
      toast.error('Gagal mendaftarkan pelanggan.');
    } finally {
      setIsCreatingCust(false);
    }
  }

  async function loadData() {
    setLoading(true);
    const [initRes, pendingRes, custRes] = await Promise.all([
      getPosInitData(),
      getPublicPendingOrders(),
      getCustomers(),
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

    if (custRes.data) {
      setCustomers(custRes.data);
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

  function handleProductCardClick(product) {
    if (product.availability === 'OUT_OF_STOCK') return;

    if (product.variants && product.variants.length > 0) {
      setVariantModalProduct(product);
    } else {
      addItemToCart(product.id, product.name, product.price, null);
    }
  }

  function addItemToCart(productId, name, price, variant = null) {
    const existingIndex = cart.findIndex(
      (item) => item.productId === productId && item.variantId === (variant?.id || null)
    );

    const displayName = variant ? `${name} (${variant.name})` : name;
    const itemPrice = variant ? variant.price : price;

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId,
          variantId: variant?.id || null,
          variantName: variant?.name || null,
          name: displayName,
          price: itemPrice,
          quantity: 1,
          notes: '',
        },
      ]);
    }

    toast.success(`Ditambahkan: ${displayName}`, { duration: 1500 });
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
        customerId: selectedCustomerId || null,
        customerName: customerName.trim() || 'Pelanggan',
        customerPhone: customerPhone.trim(),
        queueNumber: queueNumber.trim(),
        paymentMethod,
        promoCode: appliedPromo?.code || '',
        cashReceived: Number(cashReceived),
        items: cart.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
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
            <div class="text-left text-xs text-slate-700 space-y-2 p-2 font-mono">
              <div class="text-center py-3 border-b border-slate-200">
                <p class="text-xs text-slate-500 font-sans">Nomor Antrean:</p>
                <p class="text-3xl font-extrabold text-emerald-600 my-1">${res.data.queueNumber}</p>
                <p class="text-xs text-slate-400">Order #${res.data.orderNumber}</p>
              </div>
              <div class="space-y-1 pt-2">
                ${
                  res.data.promotionDiscount > 0
                    ? `
                  <div class="flex justify-between text-emerald-600 font-bold">
                    <span>Diskon Promo:</span>
                    <span>-${formatRupiah(res.data.promotionDiscount)}</span>
                  </div>
                `
                    : ''
                }
                <div class="flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Tagihan:</span>
                  <span class="text-emerald-700">${formatRupiah(res.data.grandTotal)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Metode Bayar:</span>
                  <span class="font-bold">${res.data.paymentMethod}</span>
                </div>
                ${
                  res.data.paymentMethod === 'CASH'
                    ? `
                  <div class="flex justify-between">
                    <span class="text-slate-500">Uang Diterima:</span>
                    <span>${formatRupiah(res.data.cashReceived)}</span>
                  </div>
                  <div class="flex justify-between text-emerald-700 font-bold text-sm pt-1 border-t border-slate-200">
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
          confirmButtonColor: '#059669',
          background: '#ffffff',
          color: '#0f172a',
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
            <div class="text-left text-xs text-slate-700 space-y-2 p-2 font-mono">
              <div class="text-center py-3 border-b border-slate-200">
                <p class="text-xs text-slate-500 font-sans">Nomor Antrean:</p>
                <p class="text-3xl font-extrabold text-emerald-600 my-1">${res.data.queueNumber}</p>
                <p class="text-xs text-slate-400">Order #${res.data.orderNumber}</p>
              </div>
              <div class="space-y-1 pt-2">
                <div class="flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Tagihan:</span>
                  <span class="text-emerald-700">${formatRupiah(res.data.grandTotal)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Metode Bayar:</span>
                  <span class="font-bold">${res.data.paymentMethod}</span>
                </div>
                ${
                  res.data.paymentMethod === 'CASH'
                    ? `
                  <div class="flex justify-between">
                    <span class="text-slate-500">Uang Diterima:</span>
                    <span>${formatRupiah(res.data.cashReceived)}</span>
                  </div>
                  <div class="flex justify-between text-emerald-700 font-bold text-sm pt-1 border-t border-slate-200">
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
          confirmButtonColor: '#059669',
          background: '#ffffff',
          color: '#0f172a',
        });

        loadData();
      }
    });
  }

  // Filter products by category & search query
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      {/* ─── SHIFT CHECK WARNING ────────────────────────────────────────────── */}
      {!activeShift && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-bold text-amber-900">Shift Kasir Belum Dibuka</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Buka shift kasir terlebih dahulu dengan modal awal untuk memproses pesanan dan mencatat penerimaan uang kas.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/pos/shift"
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-xs"
          >
            Buka Shift Kasir &rarr;
          </Link>
        </div>
      )}

      {/* ─── TOP HEADER & MODE TABS ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs w-fit">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2',
              activeTab === 'CATALOG'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Katalog Menu POS
          </button>

          <button
            onClick={() => setActiveTab('ONLINE_ORDERS')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative',
              activeTab === 'ONLINE_ORDERS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            Pesanan QR Online
            {pendingOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Shift Capsule & Links */}
        <div className="flex items-center gap-2">
          {activeShift && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Shift Aktif &bull; Modal: <strong className="text-slate-900 font-mono">{formatRupiah(activeShift.openingCash)}</strong></span>
            </div>
          )}

          <Link
            href="/dashboard/pos/cash"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            Arus Kas (In/Out)
          </Link>
          <Link
            href="/dashboard/pos/shift"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            Kelola Shift
          </Link>
        </div>
      </div>

      {/* ─── TAB 1: KATALOG POS & KERANJANG (GRID 70% / 30%) ─────────────────── */}
      {activeTab === 'CATALOG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT 70% (COL 8): PRODUCT CATALOG */}
          <div className="lg:col-span-8 space-y-4">
            {/* Search Bar & Category Filter Carousel */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama menu atau SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                    selectedCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  )}
                >
                  Semua Menu ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                        selectedCategory === cat.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      )}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                Memuat katalog produk menu...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <p className="text-sm font-bold text-slate-700">Tidak ada menu yang cocok</p>
                <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau kategori filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.availability === 'OUT_OF_STOCK';
                  const hasVariants = p.variants && p.variants.length > 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleProductCardClick(p)}
                      className={cn(
                        'p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between select-none relative group active:scale-[0.98]',
                        isOutOfStock && 'opacity-50 pointer-events-none bg-slate-50'
                      )}
                    >
                      <div>
                        {/* Product Image Thumbnail / Placeholder */}
                        <div className="w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-100 relative mb-2.5 border border-slate-100 flex items-center justify-center">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
                              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                            </div>
                          )}

                          {/* Floating Badges */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-white/90 backdrop-blur-xs text-slate-700 shadow-2xs uppercase tracking-wider truncate max-w-21.25">
                              {p.category?.name || 'Menu'}
                            </span>
                            {hasVariants && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500 text-white shadow-2xs">
                                {p.variants.length} Varian
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Product Name */}
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                          {p.name}
                        </h3>
                      </div>

                      {/* Bottom Price & Add CTA */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2.5">
                        <span className="font-mono font-bold text-xs text-emerald-700">
                          {formatRupiah(p.price)}
                        </span>
                        <span className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shadow-2xs">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </span>
                      </div>

                      {/* Out of Stock Overlay Badge */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-2xs rounded-2xl flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs shadow-sm">
                            Habis
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 30% (COL 4): STICKY CART / RECEIPT PANEL */}
          <div className="lg:col-span-4 sticky top-4 bg-white border border-slate-200/90 rounded-2xl shadow-sm flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Keranjang ({cart.reduce((s, i) => s + i.quantity, 0)})
                  </h2>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {/* Customer / Member Selection & Queue Inputs */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Pelanggan / Member
                    </label>
                    <button
                      type="button"
                      onClick={() => openCustomerModal()}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      + Member Baru
                    </button>
                  </div>
                  <SearchableSelect
                    isCreatable
                    options={[
                      { value: '', label: '👤 Guest (Bukan Member)' },
                      ...customers.map((c) => ({
                        value: c.id,
                        label: `★ ${c.name} ${c.phone ? `(${c.phone})` : ''}`,
                      })),
                    ]}
                    value={selectedCustomerId}
                    onChange={(cid) => {
                      const idVal = cid || '';
                      setSelectedCustomerId(idVal);
                      if (idVal) {
                        const c = customers.find((cust) => cust.id === idVal);
                        if (c) {
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone || '');
                        }
                      } else {
                        setCustomerName('Pelanggan');
                        setCustomerPhone('');
                      }
                    }}
                    onCreateOption={(inputValue) => {
                      openCustomerModal(inputValue);
                    }}
                    formatCreateLabel={(inputValue) => `+ Daftarkan "${inputValue}" sebagai Member Baru`}
                    placeholder="Cari member / ketik nama baru..."
                    noOptionsMessage={({ inputValue }) =>
                      inputValue ? (
                        <div className="py-2 px-1 text-center space-y-1.5">
                          <p className="text-slate-500 text-xs">Member &quot;{inputValue}&quot; tidak ditemukan</p>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              openCustomerModal(inputValue);
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            + Daftarkan &quot;{inputValue}&quot;
                          </button>
                        </div>
                      ) : (
                        'Ketik nama atau nomor HP member...'
                      )
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Antrean
                    </label>
                    <input
                      type="text"
                      value={queueNumber}
                      onChange={(e) => setQueueNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-emerald-700 font-mono font-bold text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="A-01"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Nama Pelanggan
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Nama Pelanggan"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Cart Items List */}
            <div className="flex-1 p-3 overflow-y-auto divide-y divide-slate-100 space-y-2">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-semibold">Keranjang masih kosong</p>
                  <p className="text-[11px] text-slate-400">Pilih menu di sebelah kiri untuk menambahkan pesanan.</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="pt-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{formatRupiah(item.price)}</p>
                      </div>

                      {/* Stepper Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="w-20 text-right font-mono font-bold text-xs text-slate-900 shrink-0">
                        {formatRupiah(item.price * item.quantity)}
                      </div>
                    </div>

                    {/* Notes Input */}
                    <input
                      type="text"
                      placeholder="Catatan: misal no ice, less sugar..."
                      value={item.notes}
                      onChange={(e) => updateNotes(index, e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Promo Code Input Bar */}
            <div className="p-3 bg-slate-50/70 border-t border-slate-100">
              {appliedPromo ? (
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold font-mono">🏷️ {appliedPromo.code}</span>
                    <span>(-{formatRupiah(appliedPromo.discountAmount)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={removePromo}
                    className="text-rose-600 hover:text-rose-800 font-bold px-1"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="KODE PROMO"
                    value={inputPromoCode}
                    onChange={(e) => setInputPromoCode(e.target.value.toUpperCase())}
                    disabled={isValidatingPromo}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                  />
                  <button
                    type="submit"
                    disabled={isValidatingPromo || !inputPromoCode.trim()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isValidatingPromo ? '...' : 'Gunakan'}
                  </button>
                </form>
              )}
            </div>

            {/* Totals & Breakdown */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 font-mono">
                <span className="font-sans">Subtotal Menu:</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>

              {promotionDiscount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-mono font-bold">
                  <span className="font-sans">Diskon Promo:</span>
                  <span>-{formatRupiah(promotionDiscount)}</span>
                </div>
              )}

              {serviceChargeAmount > 0 && (
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span className="font-sans">Service Charge ({scRate}%):</span>
                  <span>{formatRupiah(serviceChargeAmount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span className="font-sans">Pajak PPN ({taxRate}%):</span>
                  <span>{formatRupiah(taxAmount)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Grand Total:
                </span>
                <span className="text-2xl font-extrabold font-mono text-emerald-700">
                  {formatRupiah(effectiveTotal)}
                </span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <div className="p-3 bg-white border-t border-slate-100">
              <button
                type="button"
                onClick={openCheckout}
                disabled={cart.length === 0 || isPending}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <span>Bayar Sekarang</span>
                <span>&bull;</span>
                <span className="font-mono">{formatRupiah(effectiveTotal)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PESANAN ONLINE (QR) ─────────────────────────────────────── */}
      {activeTab === 'ONLINE_ORDERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pesanan Masuk dari QR Code Meja
              </h2>
              <p className="text-xs text-slate-500">
                Pesanan yang dibuat oleh pelanggan via QR code akan muncul di sini secara otomatis. Kasir menerima pembayaran untuk memproses pesanan.
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-700">
                Tidak ada pesanan online yang menunggu pembayaran
              </p>
              <p className="text-xs text-slate-400">
                Saat pelanggan memesan via menu QR publik di meja, pesanan akan langsung muncul di panel ini.
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
                    className="p-5 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ord.publicQrToken}
                          </span>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            #{ord.orderNumber}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                          ⏳ {minsLeft} mnt tersisa
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {ord.customerNameSnapshot}
                        </p>
                        {ord.customerPhoneSnapshot && (
                          <p className="text-xs text-slate-500">
                            WA: {ord.customerPhoneSnapshot}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Dipesan: {formatDateTime(ord.createdAt)}
                        </p>
                      </div>

                      {/* Order Items Snapshot */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                        {ord.items.map((it) => (
                          <div key={it.id} className="flex justify-between text-slate-700">
                            <span>
                              {it.quantity}x {it.productNameSnapshot}
                            </span>
                            <span className="font-mono font-semibold">
                              {formatRupiah(it.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Total Tagihan:</span>
                        <span className="text-lg font-bold font-mono text-emerald-700">
                          {formatRupiah(ord.grandTotal)}
                        </span>
                      </div>
                      <button
                        onClick={() => openQrOrderCheckout(ord)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                      >
                        Terima Bayar &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL PEMILIHAN VARIAN (VARIANT SELECTOR) ────────────────────────── */}
      {variantModalProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{variantModalProduct.name}</h3>
                <p className="text-xs text-slate-500">Pilih salah satu varian menu:</p>
              </div>
              <button
                onClick={() => setVariantModalProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {variantModalProduct.variants?.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    addItemToCart(variantModalProduct.id, variantModalProduct.name, v.price, v);
                    setVariantModalProduct(null);
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center justify-between text-left group"
                >
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                    {v.name}
                  </span>
                  <span className="font-mono font-bold text-xs text-emerald-700">
                    {formatRupiah(v.price)}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setVariantModalProduct(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL NORMAL CHECKOUT (KASIR POS) ───────────────────────────────── */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="text-center pb-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Konfirmasi Pembayaran
              </p>
              <p className="text-3xl font-extrabold font-mono text-emerald-700 mt-1">
                {formatRupiah(effectiveTotal)}
              </p>
              <div className="text-xs text-slate-500 mt-1 space-x-2">
                <span>Antrean #{queueNumber}</span>
                <span>&bull;</span>
                <span>{customerName}</span>
                {appliedPromo && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-600 font-mono font-bold">
                      {appliedPromo.code} (-{formatRupiah(appliedPromo.discountAmount)})
                    </span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleProcessCheckout} className="space-y-4">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setCashReceived(cashPayable);
                    }}
                    className={cn(
                      'py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1',
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    💵 Tunai (CASH)
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
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    📱 QRIS (Non-Tunai)
                  </button>
                </div>
              </div>

              {/* CASH Payment Form */}
              {paymentMethod === 'CASH' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Uang Tunai Diterima (Rp) *
                    </label>
                    <CurrencyInput
                      placeholder="0"
                      value={cashReceived}
                      onChange={(val) => setCashReceived(val)}
                      className="text-2xl sm:text-3xl font-extrabold py-3 pl-12 bg-slate-50 border-slate-300 text-emerald-800 rounded-2xl"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashReceived(effectiveTotal)}
                      className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 200000].map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setCashReceived(nom)}
                        className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 font-mono"
                      >
                        {nom >= 1000 ? `${nom / 1000}k` : nom}
                      </button>
                    ))}
                  </div>

                  {/* Change Display */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <span className="text-xs text-emerald-800 font-semibold">Uang Kembalian:</span>
                    <span className="font-mono text-xl font-extrabold text-emerald-700">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                /* QRIS Static Info */
                <div className="p-5 bg-blue-50/50 border border-blue-200 rounded-2xl text-center space-y-2">
                  <div className="w-20 h-20 mx-auto bg-white rounded-xl p-1.5 flex items-center justify-center border border-blue-200 shadow-2xs">
                    <div className="w-full h-full border border-slate-800 flex flex-col justify-between p-1">
                      <div className="flex justify-between">
                        <div className="w-3 h-3 bg-slate-900" />
                        <div className="w-3 h-3 bg-slate-900" />
                      </div>
                      <div className="flex justify-between">
                        <div className="w-3 h-3 bg-slate-900" />
                        <div className="w-3 h-3 bg-slate-900" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-blue-900">QRIS Statis Toko</p>
                  <p className="text-[11px] text-blue-700">
                    Minta pelanggan memindai QRIS dan verifikasi bukti transfer di layar kasir.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || (paymentMethod === 'CASH' && Number(cashReceived) < effectiveTotal)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Memproses Transaksi...' : 'Konfirmasi & Cetak Struk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL QR ORDER CHECKOUT ────────────────────────────────────────── */}
      {qrCheckoutModalOpen && selectedQrOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="text-center pb-3 border-b border-slate-100">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {selectedQrOrder.publicQrToken}
              </span>
              <p className="text-2xl font-extrabold font-mono text-emerald-700 mt-2">
                {formatRupiah(selectedQrOrder.grandTotal)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedQrOrder.customerNameSnapshot} &bull; Order #{selectedQrOrder.orderNumber}
              </p>
            </div>

            <form onSubmit={handleProcessQrCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nomor Antrean Kasir *
                </label>
                <input
                  type="text"
                  value={qrQueueNumber}
                  onChange={(e) => setQrQueueNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Metode Bayar
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQrPaymentMethod('CASH');
                      setQrCashReceived(selectedQrOrder.grandTotal);
                    }}
                    className={cn(
                      'py-2.5 rounded-xl text-xs font-bold border transition-all',
                      qrPaymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    💵 Tunai (CASH)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQrPaymentMethod('QRIS');
                      setQrCashReceived(selectedQrOrder.grandTotal);
                    }}
                    className={cn(
                      'py-2.5 rounded-xl text-xs font-bold border transition-all',
                      qrPaymentMethod === 'QRIS'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    📱 QRIS
                  </button>
                </div>
              </div>

              {qrPaymentMethod === 'CASH' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Uang Diterima (Rp) *
                  </label>
                  <CurrencyInput
                    placeholder="0"
                    value={qrCashReceived}
                    onChange={(val) => setQrCashReceived(val)}
                    className="text-xl font-bold py-2.5 pl-10 bg-slate-50 border-slate-300 rounded-xl text-slate-900"
                    required
                  />
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between text-xs font-mono">
                    <span className="font-sans text-emerald-800">Kembalian:</span>
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(Math.max(0, Number(qrCashReceived) - selectedQrOrder.grandTotal))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQrCheckoutModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyelesaikan...' : 'Terima Pembayaran & Cetak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── MODAL: TAMBAH MEMBER / PELANGGAN CEPAT ────────────────────────── */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Daftarkan Member Baru</h3>
                  <p className="text-[11px] text-slate-500">Tambah pelanggan langsung tanpa meninggalkan kasir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCustomerSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bisa dikosongkan atau diisi untuk memudahkan pencarian di kemudian hari.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCust}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingCust ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan & Pilih Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
