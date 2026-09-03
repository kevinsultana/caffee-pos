'use client';

import { useState, useEffect, useTransition } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getPublicMenuData, createPublicQrOrder } from '@/app/actions/publicQr';
import { formatRupiah, cn } from '@/lib/utils';

export default function PublicMenuPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Category Filter
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Customer Cart
  const [cart, setCart] = useState([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // Form Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Order Success State
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 jam dalam detik

  async function loadMenu() {
    setLoading(true);
    const res = await getPublicMenuData();
    if (res.error) {
      toast.error(res.error);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();
  }, []);

  // Countdown timer untuk pesanan yang telah dikirim
  useEffect(() => {
    if (!submittedOrder) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(submittedOrder.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [submittedOrder]);

  // Cart Handlers
  function addToCart(prod) {
    if (prod.availability === 'OUT_OF_STOCK') {
      toast.error('Maaf, produk ini sedang habis.');
      return;
    }

    const existing = cart.find((i) => i.productId === prod.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          notes: '',
        },
      ]);
    }
    toast.success(`${prod.name} masuk keranjang!`, {
      duration: 1500,
      position: 'bottom-center',
      iconTheme: { primary: '#059669', secondary: '#ffffff' },
    });
  }

  function updateQty(productId, delta) {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((i) => i.productId !== productId));
    } else {
      setCart(
        cart.map((i) =>
          i.productId === productId ? { ...i, quantity: newQty } : i
        )
      );
    }
  }

  function updateNotes(productId, notes) {
    setCart(
      cart.map((i) => (i.productId === productId ? { ...i, notes } : i))
    );
  }

  // Calculations
  const subtotal = cart.reduce(
    (sum, it) => sum + it.price * it.quantity,
    0
  );

  const scRate = data?.settings?.serviceChargeEnabled ? Number(data.settings.serviceChargeRate) : 0;
  const serviceChargeAmount = Math.round(subtotal * (scRate / 100) * 100) / 100;

  const taxRate = data?.settings?.taxEnabled ? Number(data.settings.taxRate) : 0;
  const taxBase = data?.settings?.taxBaseIncludesServiceCharge
    ? subtotal + serviceChargeAmount
    : subtotal;
  const taxAmount = Math.round(taxBase * (taxRate / 100) * 100) / 100;

  const grandTotal = subtotal + serviceChargeAmount + taxAmount;
  const totalItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  function handleSubmitOrder(e) {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Silakan isi nama pemesan.');
      return;
    }

    if (cart.length === 0) {
      toast.error('Keranjang belanja masih kosong.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Mengirim pesanan ke kasir...');
      const res = await createPublicQrOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        toast.dismiss(toastId);
        setCartModalOpen(false);
        setSubmittedOrder(res.data);
        setCart([]);
      }
    });
  }

  // Loading Skeleton Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat menu Schaw Cafe...</p>
        </div>
      </div>
    );
  }

  // ─── TAMPILAN SETELAH ORDER TERKIRIM (TOKEN SCREEN) ──────────────────────
  if (submittedOrder) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-6">
          {/* Success Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pesanan Berhasil Terkirim!</h1>
            <p className="text-xs text-slate-500">
              Tunjukkan nomor token ini ke meja kasir untuk memproses pembayaran dan pesanan Anda.
            </p>
          </div>

          {/* Token Box */}
          <div className="p-6 bg-emerald-50/80 border-2 border-dashed border-emerald-300 rounded-2xl space-y-2">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest">
              Nomor Token Pesanan
            </p>
            <p className="text-4xl font-black font-mono tracking-widest text-emerald-700">
              {submittedOrder.publicQrToken}
            </p>
            <p className="text-xs text-slate-600 font-mono pt-1">
              #{submittedOrder.orderNumber} &bull; <strong className="text-slate-900">{submittedOrder.customerName}</strong>
            </p>
          </div>

          {/* Expiration Timer Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Batas Waktu Bayar Kasir:</span>
            <span className={cn('font-mono font-bold', timeLeft < 300 ? 'text-rose-600' : 'text-emerald-700')}>
              ⏳ {timeFormatted} (Maks. 1 Jam)
            </span>
          </div>

          {/* Total Tagihan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Total Pembayaran:</span>
            <span className="text-lg font-bold font-mono text-emerald-700">
              {formatRupiah(submittedOrder.grandTotal)}
            </span>
          </div>

          <button
            onClick={() => setSubmittedOrder(null)}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Buat Pesanan Baru
          </button>
        </div>
      </div>
    );
  }

  const filteredProducts = (data?.products || []).filter((p) => {
    return selectedCategory === 'ALL' || p.categoryId === selectedCategory;
  });

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800">
      <Toaster position="top-center" />

      {/* Mobile-App Frame Constraint for Desktop */}
      <div className="max-w-md mx-auto sm:max-w-xl md:max-w-2xl bg-white/80 shadow-sm border-x border-slate-200 min-h-screen relative flex flex-col pb-28">

        {/* ─── 1. STICKY HEADER ────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {data?.store?.logoUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.store.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white shadow-xs flex items-center justify-center font-bold text-sm shrink-0">
                ☕
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 leading-none truncate">
                {data?.store?.name || 'Schaw Cafe'}
              </h1>
              <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Menu Meja Digital
              </p>
            </div>
          </div>

          {/* Cart Icon in Header */}
          <button
            onClick={() => {
              if (cart.length > 0) setCartModalOpen(true);
              else toast('Keranjang Anda masih kosong.', { icon: '🛒' });
            }}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Keranjang"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            {totalItemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center animate-in zoom-in-50">
                {totalItemCount}
              </span>
            )}
          </button>
        </header>

        {/* ─── 2. CATEGORY PILLS FILTER ─────────────────────────────────────── */}
        <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
              selectedCategory === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            )}
          >
            Semua Menu
          </button>
          {data?.categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* ─── 3. PRODUCT CATALOG (2-COLUMN GRID) ───────────────────────────── */}
        <main className="flex-1 p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada produk pada kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((prod) => {
                const inCart = cart.find((i) => i.productId === prod.id);
                const isOutOfStock = prod.availability === 'OUT_OF_STOCK';

                return (
                  <div
                    key={prod.id}
                    className={cn(
                      'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-slate-200',
                      isOutOfStock && 'opacity-50 grayscale select-none'
                    )}
                  >
                    {/* Top: Photo or Placeholder */}
                    <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                      {prod.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-[10px] font-medium text-slate-400">Foto Menu</span>
                        </div>
                      )}

                      {/* Out of stock badge */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] shadow-sm tracking-wide">
                            HABIS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Info & Action */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {prod.categoryName || 'Menu'}
                        </p>
                        <h2 className="text-sm font-bold text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                          {prod.name}
                        </h2>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-emerald-600 font-bold font-mono text-xs sm:text-sm">
                          {formatRupiah(prod.price)}
                        </span>

                        {/* Button: Add or Quantity Counter */}
                        {inCart ? (
                          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg p-0.5 border border-emerald-200">
                            <button
                              type="button"
                              onClick={() => updateQty(prod.id, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-emerald-800 hover:bg-emerald-200 font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="w-4 text-center font-mono font-bold text-xs text-emerald-900">
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(prod.id, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-emerald-800 hover:bg-emerald-200 font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(prod)}
                            disabled={isOutOfStock}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-2xs transition-colors disabled:opacity-40 cursor-pointer"
                            title="Tambah ke keranjang"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ─── 4. FLOATING CART BAR (BOTTOM FIXED) ─────────────────────────── */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none p-4">
            <div className="max-w-md sm:max-w-xl md:max-w-2xl w-full pointer-events-auto">
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl shadow-slate-900/10 flex items-center justify-between gap-4">
                <div className="min-w-0 pl-1">
                  <p className="text-[11px] font-semibold text-slate-500">
                    {totalItemCount} Item Dipilih
                  </p>
                  <p className="text-base font-black font-mono text-emerald-700 leading-tight">
                    {formatRupiah(grandTotal)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCartModalOpen(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <span>Checkout</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. MODAL CHECKOUT & CUSTOMER INFO ────────────────────────────── */}
        {cartModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Rincian Pesanan</h2>
                  <p className="text-[11px] text-slate-500">Periksa kembali item pesanan Anda</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCartModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Items List with Notes */}
              <div className="flex-1 p-4 overflow-y-auto divide-y divide-slate-100 space-y-3">
                {cart.map((item) => (
                  <div key={item.productId} className="not-first:pt-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 leading-snug">{item.name}</p>
                        <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                          {formatRupiah(item.price)}
                        </p>
                      </div>

                      {/* Quantity modifier */}
                      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-white font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-xs text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Item specific notes */}
                    <input
                      type="text"
                      placeholder="Catatan menu (contoh: less sugar, es sedikit)..."
                      value={item.notes}
                      onChange={(e) => updateNotes(item.productId, e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>

              {/* Form Input Pelanggan & Kalkulasi Finansial */}
              <form onSubmit={handleSubmitOrder} className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nama Pemesan *
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama Anda..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      No. WhatsApp (Opsional)
                    </label>
                    <input
                      type="tel"
                      placeholder="0812xxxxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Subtotal, Pajak, Service Charge Breakdown */}
                <div className="pt-2 border-t border-slate-200 text-xs space-y-1 text-slate-500">
                  <div className="flex justify-between">
                    <span>Subtotal Menu:</span>
                    <span className="font-mono text-slate-800 font-semibold">{formatRupiah(subtotal)}</span>
                  </div>
                  {data?.settings?.serviceChargeEnabled && (
                    <div className="flex justify-between">
                      <span>Biaya Layanan ({data.settings.serviceChargeRate}%):</span>
                      <span className="font-mono text-slate-800">{formatRupiah(serviceChargeAmount)}</span>
                    </div>
                  )}
                  {data?.settings?.taxEnabled && (
                    <div className="flex justify-between">
                      <span>Pajak Resto ({data.settings.taxRate}%):</span>
                      <span className="font-mono text-slate-800">{formatRupiah(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-sm">
                    <span className="text-slate-900">Total Pembayaran:</span>
                    <span className="font-mono text-emerald-700 text-base">{formatRupiah(grandTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending || cart.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Mengirim Pesanan...' : 'Kirim Pesanan ke Kasir'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
