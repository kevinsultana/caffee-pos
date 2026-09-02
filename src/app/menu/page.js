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
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds

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

  // Countdown timer for submitted order
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
    toast.success(`${prod.name} ditambahkan!`, { duration: 1500, position: 'bottom-center' });
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

  function handleSubmitOrder(e) {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Silakan isi nama Anda.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-300 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">Memuat menu Schaw Cafe...</p>
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
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-950/60 border border-amber-700/50 text-amber-400 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-amber-50">Pesanan Berhasil Dikirim!</h1>
            <p className="text-xs text-stone-400">
              Silakan menuju meja kasir untuk melakukan pembayaran.
            </p>
          </div>

          {/* Token Box */}
          <div className="p-5 bg-amber-950/30 border border-amber-700/60 rounded-2xl space-y-2">
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">
              Tunjukkan Token Ini ke Kasir
            </p>
            <p className="text-3xl font-black font-mono tracking-wider text-amber-300">
              {submittedOrder.publicQrToken}
            </p>
            <p className="text-xs text-stone-400 font-mono">
              #{submittedOrder.orderNumber} &bull; {submittedOrder.customerName}
            </p>
          </div>

          {/* Expiration Timer Box */}
          <div className="p-3 bg-stone-800/60 border border-stone-700/60 rounded-xl flex items-center justify-between text-xs">
            <span className="text-stone-400">Batas Waktu Bayar:</span>
            <span className={cn('font-mono font-bold', timeLeft < 300 ? 'text-red-400' : 'text-amber-300')}>
              ⏳ {timeFormatted} (Maks. 1 Jam)
            </span>
          </div>

          {/* Total Tagihan */}
          <div className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl flex justify-between items-center">
            <span className="text-xs text-stone-400">Total Pembayaran:</span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {formatRupiah(submittedOrder.grandTotal)}
            </span>
          </div>

          <button
            onClick={() => setSubmittedOrder(null)}
            className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-sm font-semibold transition-colors"
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
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col pb-24">
      <Toaster />

      {/* Top App Bar */}
      <header className="sticky top-0 z-20 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-900/60 border border-amber-700/40 flex items-center justify-center text-amber-400 font-bold text-sm">
            ☕
          </div>
          <div>
            <h1 className="text-sm font-bold text-amber-50 leading-none">
              {data?.store?.name || 'Schaw Cafe'}
            </h1>
            <p className="text-[10px] text-amber-400/80 mt-0.5 font-medium">Digital Table Menu</p>
          </div>
        </div>
        <button
          onClick={() => setCartModalOpen(true)}
          className="relative px-3 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5"
        >
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          Keranjang
          {cart.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* Category Pills Bar */}
      <div className="sticky top-13.25 z-10 bg-stone-950/95 backdrop-blur-md px-4 py-2 border-b border-stone-900 flex gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={cn(
            'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
            selectedCategory === 'ALL'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-stone-900 text-stone-400 border border-stone-800'
          )}
        >
          Semua Menu
        </button>
        {data?.categories?.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
              selectedCategory === cat.id
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-stone-900 text-stone-400 border border-stone-800'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product List */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-stone-500 text-xs">
            Menu belum tersedia pada kategori ini.
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const inCart = cart.find((i) => i.productId === prod.id);

            return (
              <div
                key={prod.id}
                className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800/80 flex items-center justify-between gap-3.5 shadow-sm hover:border-amber-700/40 transition-colors"
              >
                {/* Product Thumbnail if exists */}
                {prod.imageUrl ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-800 shrink-0 border border-stone-700/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                ) : null}

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                      {prod.categoryName}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-amber-50">{prod.name}</h2>
                  {prod.description && (
                    <p className="text-xs text-stone-400 line-clamp-1">{prod.description}</p>
                  )}
                  <p className="text-sm font-mono font-bold text-amber-400 pt-1">
                    {formatRupiah(prod.price)}
                  </p>
                </div>

                {/* Add / Qty modifier */}
                <div>
                  {inCart ? (
                    <div className="flex items-center gap-2 bg-stone-800 rounded-xl p-1 border border-stone-700">
                      <button
                        onClick={() => updateQty(prod.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-white rounded-lg hover:bg-stone-700 font-bold"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-xs text-amber-200">
                        {inCart.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(prod.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-white rounded-lg hover:bg-stone-700 font-bold"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(prod)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm shadow-amber-950 transition-all flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Tambah
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 z-30 flex justify-center">
          <div className="max-w-2xl w-full flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-stone-400">
                Total {cart.reduce((s, i) => s + i.quantity, 0)} item
              </p>
              <p className="text-base font-extrabold font-mono text-amber-400">
                {formatRupiah(grandTotal)}
              </p>
            </div>
            <button
              onClick={() => setCartModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-950 flex items-center gap-2"
            >
              Lihat Pesanan &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL KERANJANG & CHECKOUT ORDER ──────────────────────────────── */}
      {cartModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-50">Pesanan Anda</h2>
              <button
                onClick={() => setCartModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cart List */}
            <div className="flex-1 p-4 overflow-y-auto divide-y divide-stone-800/80 space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="not-first:pt-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-amber-50">{item.name}</p>
                      <p className="text-[11px] font-mono text-stone-400">
                        {formatRupiah(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-stone-800 rounded-xl p-1 border border-stone-700">
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-white rounded font-bold"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-mono font-bold text-xs text-amber-200">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-white rounded font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Catatan khusus (contoh: Kurang manis, es pisah)..."
                    value={item.notes}
                    onChange={(e) => updateNotes(item.productId, e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-800/60 border border-stone-700/60 rounded-lg text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>

            {/* Customer Inputs & Calculations */}
            <form onSubmit={handleSubmitOrder} className="p-4 border-t border-stone-800 bg-stone-900/90 space-y-3">
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 uppercase tracking-wider mb-1">
                    Nama Pemesan *
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nama Anda..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                    No. WhatsApp (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="pt-2 border-t border-stone-800/80 text-xs space-y-1 text-stone-400">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-stone-200">{formatRupiah(subtotal)}</span>
                </div>
                {data?.settings?.serviceChargeEnabled && (
                  <div className="flex justify-between">
                    <span>Service Charge ({data.settings.serviceChargeRate}%):</span>
                    <span className="font-mono text-stone-200">{formatRupiah(serviceChargeAmount)}</span>
                  </div>
                )}
                {data?.settings?.taxEnabled && (
                  <div className="flex justify-between">
                    <span>Pajak ({data.settings.taxRate}%):</span>
                    <span className="font-mono text-stone-200">{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-stone-800 font-bold text-sm">
                  <span className="text-amber-100">Total:</span>
                  <span className="font-mono text-amber-400 text-base">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || cart.length === 0}
                className="w-full py-3 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
              >
                {isPending ? 'Mengirim Pesanan...' : 'Kirim Pesanan ke Kasir'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
