'use client';

import { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getPosInitData, processPosCheckout } from '@/app/actions/pos';
import { openShift } from '@/app/actions/shift';
import { validatePromoCode, getActivePosPromotions } from '@/app/actions/promotion';
import { getCustomers, createCustomer, findCustomerByPhone } from '@/app/actions/customer';
import {
  getPublicPendingOrders,
  cancelPublicQrOrder,
} from '@/app/actions/publicQr';
import ThermalReceipt from '@/components/pos/ThermalReceipt';
import { formatRupiah, formatDateTime, cn, normalizePhone } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useBluetooth, buildReceiptBytes } from '@/contexts/BluetoothPrinterContext';
import BluetoothModal from '@/components/bluetooth/BluetoothModal';
import PromoModal from '@/components/pos/PromoModal';
import CashOutModal from '@/components/pos/CashOutModal';

export default function PosScreenPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Bluetooth Printer — koneksi global dari context (persist lintas halaman)
  const { isConnected: btConnected, printBytes, btDeviceName } = useBluetooth();

  // Mode Tab: 'CATALOG' | 'ONLINE_ORDERS'
  const [activeTab, setActiveTab] = useState('CATALOG');

  // Master Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [unregisteredQrPhone, setUnregisteredQrPhone] = useState(null);
  const [isQrOrderWithoutPhone, setIsQrOrderWithoutPhone] = useState(false);

  // Thermal Printing State
  const [printOrder, setPrintOrder] = useState(null);
  const [printMode, setPrintMode] = useState('CUSTOMER');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);

  // Online Orders State
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeQrOrder, setActiveQrOrder] = useState(null);

  // Variant Modal State
  const [variantModalProduct, setVariantModalProduct] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('Pelanggan');
  const [customerPhone, setCustomerPhone] = useState('');
  const [queueInput, setQueueInput] = useState(''); // Angka antrean saja (awal kosong, wajib diisi)
  const [orderType, setOrderType] = useState('DINE_IN'); // 'DINE_IN' | 'TAKEAWAY'

  // Nomor antrean lengkap dengan prefix otomatis (A- untuk Dine In, TA- untuk Takeaway)
  const fullQueueNumber = queueInput.trim()
    ? `${orderType === 'TAKEAWAY' ? 'TA' : 'A'}-${queueInput.trim().padStart(2, '0')}`
    : '';

  // Promo Code State
  const [promotionsList, setPromotionsList] = useState([]);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [inputPromoCode, setInputPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'QRIS'
  const [cashReceived, setCashReceived] = useState(0);
  const [zoomQrisUrl, setZoomQrisUrl] = useState(null);
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);

  // Quick Create Customer Modal State
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [isCreatingCust, setIsCreatingCust] = useState(false);
  const [custModalFocusField, setCustModalFocusField] = useState('name'); // 'name' | 'phone'
  const newCustNameInputRef = useRef(null);
  const newCustPhoneInputRef = useRef(null);

  // Quick Open Shift Modal State
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [quickOpeningCash, setQuickOpeningCash] = useState(0);
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  async function handleQuickOpenShift(e) {
    e.preventDefault();
    const cash = Number(quickOpeningCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Modal awal laci kas harus berupa angka valid (minimal Rp 0).');
      return;
    }

    setIsOpeningShift(true);
    const toastId = toast.loading('Membuka shift kasir...');
    try {
      const res = await openShift({ openingCash: cash });
      if (res?.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Shift kasir berhasil dibuka! Selamat melayani pelanggan.', { id: toastId });
        setIsOpenShiftModalOpen(false);
        setQuickOpeningCash(0);
        await loadData();
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Gagal membuka shift kasir.', { id: toastId });
    } finally {
      setIsOpeningShift(false);
    }
  }

  function openCustomerModal(initialName = '', initialPhone = '', initialEmail = '', focusField = 'name') {
    setNewCustName(
      initialName || (customerName && customerName !== 'Pelanggan' ? customerName : '')
    );
    setNewCustPhone(initialPhone || customerPhone || '');
    setNewCustEmail(initialEmail || '');
    setCustModalFocusField(focusField);
    setCustomerModalOpen(true);
  }

  // Auto fokus ke input field yang sesuai saat modal customer dibuka
  useEffect(() => {
    if (customerModalOpen) {
      const timer = setTimeout(() => {
        if (custModalFocusField === 'phone') {
          newCustPhoneInputRef.current?.focus();
          newCustPhoneInputRef.current?.select?.();
        } else {
          newCustNameInputRef.current?.focus();
          newCustNameInputRef.current?.select?.();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [customerModalOpen, custModalFocusField]);

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
        email: newCustEmail.trim() || null,
      });

      if (res.error) {
        toast.error(res.error, { position: 'top-center' });
        if (res.alreadyExists && res.data) {
          setCustomers((prev) => {
            if (prev.some((c) => c.id === res.data.id)) return prev;
            return [res.data, ...prev];
          });
          setSelectedCustomerId(res.data.id);
          setCustomerName(res.data.name);
          setCustomerPhone(res.data.phone || '');
          setUnregisteredQrPhone(null);
          setIsQrOrderWithoutPhone(false);
          setCustomerModalOpen(false);
          toast.success(`Member "${res.data.name}" teridentifikasi dan dihubungkan!`, {
            position: 'top-center',
          });
        }
      } else {
        const created = res.data;
        toast.success(`Member baru "${created.name}" berhasil didaftarkan dan dihubungkan!`, {
          position: 'top-center',
        });
        setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        setSelectedCustomerId(created.id);
        setCustomerName(created.name);
        setCustomerPhone(created.phone || '');
        setUnregisteredQrPhone(null);
        setIsQrOrderWithoutPhone(false);
        setCustomerModalOpen(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustEmail('');
      }
    } catch (err) {
      console.error('[handleCreateCustomerSubmit] Error:', err);
      toast.error('Gagal mendaftarkan pelanggan.');
    } finally {
      setIsCreatingCust(false);
    }
  }

  async function loadPendingOrders() {
    try {
      const res = await getPublicPendingOrders();
      if (res?.error) {
        if (res.sessionRevoked || res.error.includes('Sesi tidak valid')) {
          try {
            sessionStorage.clear();
            localStorage.clear();
          } catch { }
          window.location.replace('/api/auth/clear-session');
          return;
        }
        toast.error(res.error);
      } else if (res.data) {
        setPendingOrders(res.data);
      }
    } catch (err) {
      console.error('[loadPendingOrders] Error:', err);
    }
  }

  async function refreshPromotions() {
    try {
      const res = await getActivePosPromotions();
      if (res.data) setPromotionsList(res.data);
    } catch (err) {
      console.warn('[refreshPromotions]', err);
    }
  }

  async function loadData() {
    setLoading(true);
    const [initRes, custRes, pendingRes, promoRes] = await Promise.all([
      getPosInitData(),
      getCustomers(),
      getPublicPendingOrders(),
      getActivePosPromotions(),
    ]);

    if (initRes.error) {
      if (initRes.sessionRevoked || initRes.error.includes('Sesi tidak valid')) {
        try {
          sessionStorage.clear();
          localStorage.clear();
        } catch { }
        window.location.replace('/api/auth/clear-session');
        return;
      }
      toast.error(initRes.error);
    } else {
      setProducts(initRes.data.products || []);
      setCategories(initRes.data.categories || []);
      setSettings(initRes.data.settings);
      if (initRes.data.storeInfo) setStoreInfo(initRes.data.storeInfo);
      setActiveShift(initRes.data.activeShift);
    }

    if (custRes.data) {
      setCustomers(custRes.data);
    }

    if (pendingRes?.data) {
      setPendingOrders(pendingRes.data);
    }

    if (promoRes?.data) {
      setPromotionsList(promoRes.data);
    }

    setLoading(false);
  }

  // Load katalog dan master data kasir saat pertama kali halaman dimuat
  useEffect(() => {
    loadData();
  }, []);

  // Hanya ambil data pesanan QR online saat kasir membuka tab ONLINE_ORDERS
  useEffect(() => {
    if (activeTab === 'ONLINE_ORDERS') {
      loadPendingOrders();
    }
  }, [activeTab]);

  // ══════════════════════════════════════════════════════════════════════════
  // CART OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════

  function handleProductCardClick(product) {
    if (!activeShift) {
      toast.error('Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu.', { id: 'shift-locked' });
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (product.availability === 'OUT_OF_STOCK') return;

    if (product.variants && product.variants.length > 0) {
      setVariantModalProduct(product);
    } else {
      addItemToCart(product.id, product.name, product.price, null);
    }
  }

  function addItemToCart(productId, name, price, variant = null) {
    if (!activeShift) {
      toast.error('Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu.', { id: 'shift-locked' });
      setIsOpenShiftModalOpen(true);
      return;
    }
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
    setActiveQrOrder(null);
    setSelectedCustomerId('');
    setUnregisteredQrPhone(null);
    setIsQrOrderWithoutPhone(false);
    setCustomerName('Pelanggan');
    setCustomerPhone('');
    setQueueInput('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROMO CODE APPLICATION
  // ══════════════════════════════════════════════════════════════════════════

  async function handleSelectPromoFromModal(promo) {
    if (!promo?.code) return;
    setIsValidatingPromo(true);
    const toastId = toast.loading(`Menerapkan promo "${promo.code}"...`);
    try {
      const res = await validatePromoCode({
        code: promo.code,
        cartItems: cart,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
        setAppliedPromo(null);
      } else {
        setAppliedPromo(res.data);
        setIsPromoModalOpen(false);
        toast.success(
          `Kode promo "${res.data.code}" aktif! Hemat ${formatRupiah(res.data.discountAmount)}`,
          { id: toastId }
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menerapkan promo.', { id: toastId });
    } finally {
      setIsValidatingPromo(false);
    }
  }

  async function handleManualCodeSubmit(code) {
    if (!code) return;
    setIsValidatingPromo(true);
    const toastId = toast.loading(`Mengecek kode promo "${code}"...`);
    try {
      const res = await validatePromoCode({
        code,
        cartItems: cart,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId, duration: 4000 });
      } else {
        setAppliedPromo(res.data);
        setIsPromoModalOpen(false);
        toast.success(
          `Kode promo "${res.data.code}" berhasil diterapkan!`,
          { id: toastId }
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menerapkan kode promo.', { id: toastId });
    } finally {
      setIsValidatingPromo(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setInputPromoCode('');
    toast.success('Penggunaan promo berhasil dibatalkan.', { icon: '🗑️' });
  }

  // Otomatis sinkronisasi & validasi ulang promo saat item di keranjang berubah
  useEffect(() => {
    if (!appliedPromo) return;

    if (cart.length === 0) {
      setAppliedPromo(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await validatePromoCode({
          code: appliedPromo.code,
          cartItems: cart,
        });

        if (!isMounted) return;

        if (res.error) {
          toast.error(`Promo "${appliedPromo.code}" tidak lagi memenuhi syarat: ${res.error}`, {
            id: 'promo-ineligible',
            duration: 4000,
          });
          setAppliedPromo(null);
        } else if (res.data) {
          setAppliedPromo((prev) => (prev ? { ...prev, ...res.data } : null));
        }
      } catch (err) {
        console.warn('[auto recalculate promo error]', err);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [cart, appliedPromo?.code]);

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCIAL CALCULATIONS (STORE SETTINGS COMPLIANT)
  // ══════════════════════════════════════════════════════════════════════════

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
  }, [cart]);

  // Hitung diskon promo secara reaktif langsung di sisi klien
  const promotionDiscount = useMemo(() => {
    if (!appliedPromo || cart.length === 0) return 0;

    // 1. Evaluasi item yang memenuhi syarat (scope PRODUCT vs ORDER)
    let eligibleSubtotal = subtotal;
    if (appliedPromo.scope === 'PRODUCT' && appliedPromo.targetProductId) {
      eligibleSubtotal = cart
        .filter((it) => it.productId === appliedPromo.targetProductId)
        .reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);

      // Jika produk target tidak ada di keranjang, diskon bernilai 0
      if (eligibleSubtotal === 0) return 0;
    }

    // 2. Evaluasi minimum pembelian
    if (appliedPromo.minimumPurchase && subtotal < Number(appliedPromo.minimumPurchase)) {
      return 0;
    }

    // 3. Hitung besaran diskon berdasarkan tipe (PERCENTAGE / FIXED_AMOUNT)
    let discount = 0;
    const actionVal = Number(appliedPromo.discountValue) || 0;

    if (appliedPromo.discountType === 'PERCENTAGE') {
      discount = eligibleSubtotal * (actionVal / 100);
    } else {
      // FIXED_AMOUNT
      discount = Math.min(eligibleSubtotal, actionVal);
    }

    // 4. Batasi dengan batas diskon maksimal (maxDiscount cap) jika ada
    if (appliedPromo.maxDiscount !== null && appliedPromo.maxDiscount !== undefined) {
      const maxCap = Number(appliedPromo.maxDiscount);
      if (maxCap > 0 && discount > maxCap) {
        discount = maxCap;
      }
    }

    return Math.round(discount * 100) / 100;
  }, [cart, subtotal, appliedPromo]);
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

  // Pecahan Uang Rupiah Dinamis (Quick Cash Suggestions)
  const suggestedCashAmounts = useMemo(() => {
    const numTotal = Number(effectiveTotal) || 0;
    if (numTotal <= 0) return [10000, 20000, 50000, 100000];

    const set = new Set();
    const standardNotes = [5000, 10000, 20000, 50000, 100000];

    // Pecahan standar lembaran rupiah yang lebih besar dari total
    for (const note of standardNotes) {
      if (note > numTotal) set.add(note);
    }

    // Jika di bawah 100k, tambahkan pembulatan ke kelipatan 10rb terdekat (misal 35rb -> 40rb)
    if (numTotal < 100000) {
      const ceil10k = Math.ceil(numTotal / 10000) * 10000;
      if (ceil10k > numTotal) set.add(ceil10k);

      // Pembulatan ke 20rb terdekat jika belum ada (misal 25rb -> 40rb)
      const ceil20k = Math.ceil(numTotal / 20000) * 20000;
      if (ceil20k > numTotal && ceil20k <= 100000 && numTotal % 20000 !== 0 && numTotal % 50000 !== 0) {
        set.add(ceil20k);
      }
    } else {
      // Jika >= 100k, sediakan kelipatan 10k, 50k & 100k berikutnya
      const ceil10k = Math.ceil(numTotal / 10000) * 10000;
      if (ceil10k > numTotal && ceil10k % 50000 !== 0) set.add(ceil10k);

      const ceil50k = Math.ceil(numTotal / 50000) * 50000;
      if (ceil50k > numTotal) set.add(ceil50k);

      const ceil100k = Math.ceil(numTotal / 100000) * 100000;
      if (ceil100k > numTotal) {
        set.add(ceil100k);
        set.add(ceil100k + 100000);
      } else {
        set.add(numTotal + 100000);
      }
    }

    const sorted = Array.from(set)
      .filter((v) => v > numTotal)
      .sort((a, b) => a - b);

    if (numTotal < 100000) {
      return sorted.filter((v) => v <= 100000);
    }
    return sorted.slice(0, 4);
  }, [effectiveTotal]);

  // ══════════════════════════════════════════════════════════════════════════
  // CHECKOUT HANDLERS (NORMAL POS)
  // ══════════════════════════════════════════════════════════════════════════

  function handleOrderTypeChange(type) {
    setOrderType(type);
  }

  function openCheckout() {
    if (!activeShift) {
      toast.error('Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu.', { id: 'shift-locked' });
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) {
      toast.error('Keranjang belanja masih kosong.');
      return;
    }
    if (!queueInput.trim()) {
      toast.error('Nomor antrean wajib diisi! Masukkan angka antrean.');
      return;
    }
    setCashReceived(effectiveTotal);
    setCheckoutModalOpen(true);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // THERMAL RECEIPT PRINTING (BLUETOOTH / USB / KIOSK AUTO-PRINT)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Konfigurasi Struk & Printer Terintegrasi (Sinkron Penuh dengan Store Settings) ──
  const effectiveStore = useMemo(() => {
    return {
      name: storeInfo?.name || 'SCHAW CAFE',
      code: storeInfo?.code || 'MAIN',
      logoUrl: storeInfo?.logoUrl || null,
      receiptLogoUrl: settings?.receiptLogoUrl || storeInfo?.receiptLogoUrl || null,
      receiptShowLogo: settings?.receiptShowLogo ?? storeInfo?.receiptShowLogo ?? true,
      receiptShowStoreName: settings?.receiptShowStoreName ?? storeInfo?.receiptShowStoreName ?? true,
      receiptHeader: settings?.receiptHeader ?? storeInfo?.receiptHeader ?? '',
      receiptHeaderAlign: settings?.receiptHeaderAlign ?? storeInfo?.receiptHeaderAlign ?? 'CENTER',
      receiptHeaderBold: Boolean(settings?.receiptHeaderBold ?? storeInfo?.receiptHeaderBold),
      receiptFooter:
        settings?.receiptFooter ??
        storeInfo?.receiptFooter ??
        'Terima kasih atas kunjungan Anda!\nSimpan struk sebagai bukti pembayaran.',
      receiptFooterAlign: settings?.receiptFooterAlign ?? storeInfo?.receiptFooterAlign ?? 'CENTER',
      receiptFooterBold: Boolean(settings?.receiptFooterBold ?? storeInfo?.receiptFooterBold),
      receiptFontSize: settings?.receiptFontSize || storeInfo?.receiptFontSize || 'NORMAL',
      receiptDoubleHeight: settings?.receiptDoubleHeight ?? storeInfo?.receiptDoubleHeight ?? true,
      receiptCols: settings?.receiptCols
        ? parseInt(settings.receiptCols, 10)
        : storeInfo?.receiptCols
          ? parseInt(storeInfo.receiptCols, 10)
          : null,
      printerWidth: settings?.printerWidth || storeInfo?.printerWidth || 58,
    };
  }, [storeInfo, settings]);

  const handlePrint = (orderToPrint, mode = 'CUSTOMER') => {
    if (!orderToPrint) {
      toast.error('Data transaksi untuk cetak tidak tersedia.');
      return;
    }

    // Pastikan nomor antrean selalu terisi dari orderToPrint atau fallback ke state queueNumber kasir
    const resolvedQueueNumber =
      orderToPrint.queueNumber ||
      orderToPrint.queue_number ||
      orderToPrint.queue ||
      orderToPrint.queueNo ||
      orderToPrint.antrean ||
      fullQueueNumber ||
      '-';

    const resolvedOrderType =
      orderToPrint.orderType ||
      (resolvedQueueNumber.toUpperCase().startsWith('TA') ? 'TAKEAWAY' : orderType);

    const safeOrderToPrint = {
      ...orderToPrint,
      queueNumber: resolvedQueueNumber,
      orderType: resolvedOrderType,
    };

    // ── Path 1: Bluetooth BLE (jika printer terhubung via context) ────────────
    if (btConnected) {
      toast.loading(
        mode === 'KITCHEN' ? 'Mengirim tiket dapur ke printer...' : 'Mengirim struk ke printer Bluetooth...',
        { id: 'pos-thermal-print', duration: 8000 }
      );

      setPrintOrder(safeOrderToPrint);
      setPrintMode(mode);

      buildReceiptBytes(safeOrderToPrint, effectiveStore, mode)
        .then((bytes) => printBytes(bytes))
        .then(() => {
          toast.success(
            mode === 'KITCHEN' ? 'Tiket dapur berhasil dicetak!' : 'Struk berhasil dicetak!',
            { id: 'pos-thermal-print', duration: 3000 }
          );
        })
        .catch((err) => {
          console.error('[BLE Print Error]', err);
          toast.error(
            'Gagal cetak via Bluetooth: ' + (err.message || 'Cek koneksi printer.'),
            { id: 'pos-thermal-print' }
          );
        });
      return;
    }

    // Printer BLE tidak terhubung — tampilkan pesan yang jelas
    toast.error(
      'Printer Bluetooth belum terhubung. Hubungkan printer di halaman Pengaturan terlebih dahulu.',
      { duration: 5000 }
    );
  };

  function handleProcessCheckout(e, forceProceed = false) {
    if (e?.preventDefault) e.preventDefault();

    if (paymentMethod === 'CASH' && Number(cashReceived) < effectiveTotal) {
      toast.error('Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }

    if (!queueInput.trim()) {
      toast.error('Nomor antrean wajib diisi! Masukkan angka antrean.');
      return;
    }

    // Pengecekan printer Bluetooth: jika belum terhubung, tampilkan modal Bluetooth connect
    if (!forceProceed && !btConnected) {
      setIsBtModalOpen(true);
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Memproses transaksi penjualan...');

      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim() || 'Pelanggan',
        customerPhone: customerPhone.trim(),
        queueNumber: fullQueueNumber,
        orderType,
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
        qrOrderId: activeQrOrder ? activeQrOrder.id : null,
      };

      const res = await processPosCheckout(payload);

      if (res.error) {
        if (res.sessionRevoked || res.error.includes('Sesi tidak valid')) {
          try {
            sessionStorage.clear();
            localStorage.clear();
          } catch { }
          window.location.replace('/api/auth/clear-session');
          return;
        }
        toast.error(res.error, { id: toastId, duration: 4500 });
      } else {
        toast.dismiss(toastId);
        setCheckoutModalOpen(false);
        clearCart();
        setQueueInput('');
        loadPendingOrders();

        // Cetak struk otomatis ke printer Bluetooth jika autoPrintEnabled aktif
        if (autoPrintEnabled && res.data.orderForPrint) {
          handlePrint(
            {
              ...res.data.orderForPrint,
              queueNumber: res.data.queueNumber || res.data.orderForPrint.queueNumber || fullQueueNumber,
              orderType: res.data.orderType || orderType,
            },
            'CUSTOMER'
          );
        }

        const Swal = (await import('sweetalert2')).default;
        const swalRes = await Swal.fire({
          icon: 'success',
          title: 'Pembayaran Berhasil! 🎉',
          html: `
            <div class="text-left text-xs text-slate-700 space-y-2 p-2 font-mono">
              <div class="text-center py-3 border-b border-slate-200">
                <p class="text-xs text-slate-500 font-sans">Nomor Antrean:</p>
                <p class="text-3xl font-extrabold text-emerald-600 my-1">${res.data.queueNumber}</p>
                <p class="text-xs text-slate-400">Order #${res.data.orderNumber} ${res.data.publicQrToken ? `&bull; QR ${res.data.publicQrToken}` : ''}</p>
              </div>
              <div class="space-y-1 pt-2">
                ${res.data.promotionDiscount > 0
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
                ${res.data.paymentMethod === 'CASH'
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
          showDenyButton: true,
          denyButtonText: '🍳 Cetak Tiket Dapur',
          denyButtonColor: '#0284c7',
          showCancelButton: true,
          cancelButtonText: '🖨️ Cetak Ulang Struk',
          cancelButtonColor: '#475569',
          confirmButtonText: 'Transaksi Baru ✓',
          confirmButtonColor: '#059669',
          background: '#ffffff',
          color: '#0f172a',
        });

        if (swalRes.isDenied && res.data.orderForPrint) {
          handlePrint(
            {
              ...res.data.orderForPrint,
              queueNumber: res.data.queueNumber || res.data.orderForPrint.queueNumber || fullQueueNumber,
              orderType: res.data.orderType || orderType,
            },
            'KITCHEN'
          );
        } else if (swalRes.dismiss === Swal.DismissReason.cancel && res.data.orderForPrint) {
          handlePrint(
            {
              ...res.data.orderForPrint,
              queueNumber: res.data.queueNumber || res.data.orderForPrint.queueNumber || fullQueueNumber,
              orderType: res.data.orderType || orderType,
            },
            'CUSTOMER'
          );
        }

        loadData();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC QR ORDER INTEGRATION (OPSI 1: LANGSUNG KE KERANJANG KASIR)
  // ══════════════════════════════════════════════════════════════════════════

  async function openQrOrderCheckout(order) {
    if (!activeShift) {
      toast.error('Shift kasir belum dibuka. Buka shift kasir terlebih dahulu untuk memproses pesanan.', { id: 'shift-locked' });
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (cart.length > 0 && !activeQrOrder) {
      const confirmReplace = window.confirm(
        'Keranjang kasir saat ini memiliki pesanan lain. Timpa isi keranjang dengan pesanan QR ini?'
      );
      if (!confirmReplace) return;
    }

    // 1. Map items dari pesanan QR ke format cart POS
    const mappedItems = order.items.map((it) => {
      const displayName = it.variantNameSnapshot
        ? `${it.productNameSnapshot} (${it.variantNameSnapshot})`
        : it.productNameSnapshot;
      return {
        productId: it.productId,
        variantId: it.variantId || null,
        variantName: it.variantNameSnapshot || null,
        name: displayName,
        price: Number(it.unitPrice),
        quantity: it.quantity,
        notes: it.notes || '',
      };
    });
    setCart(mappedItems);

    // 2. Set nama & nomor HP pelanggan dari snapshot QR
    const rawName = order.customerNameSnapshot?.trim() || 'Pelanggan';
    const rawPhone = order.customerPhoneSnapshot?.trim() || '';
    const normPhone = normalizePhone(rawPhone);

    setCustomerName(rawName);
    setCustomerPhone(normPhone || rawPhone);

    if (order.queueNumber) {
      const digitsOnly = order.queueNumber.replace(/\D/g, '');
      setQueueInput(digitsOnly);
      if (order.queueNumber.toUpperCase().startsWith('TA')) {
        setOrderType('TAKEAWAY');
      } else {
        setOrderType('DINE_IN');
      }
    }

    // 3. Pengecekan Pelanggan ke Database Customer
    if (normPhone) {
      setIsQrOrderWithoutPhone(false);
      // Cari di local list dulu
      let matched = customers.find((c) => normalizePhone(c.phone) === normPhone);

      // Jika belum ditemukan di local list, cek ke server database
      if (!matched) {
        try {
          const checkRes = await findCustomerByPhone(normPhone);
          if (checkRes?.data) {
            matched = checkRes.data;
            setCustomers((prev) => [matched, ...prev.filter((c) => c.id !== matched.id)]);
          }
        } catch (err) {
          console.error('[openQrOrderCheckout] findCustomerByPhone error:', err);
        }
      }

      if (matched) {
        // Kondisi 1: Nomor HP SUDAH Terdaftar
        setSelectedCustomerId(matched.id);
        setCustomerName(matched.name);
        setCustomerPhone(matched.phone || normPhone);
        setUnregisteredQrPhone(null);
        toast.success(
          `Pesanan QR #${order.publicQrToken} dimuat! Member "${matched.name}" teridentifikasi.`,
          { duration: 3500, position: 'top-center' }
        );
      } else {
        // Kondisi 2: Nomor HP BELUM Terdaftar (Customer Baru)
        setSelectedCustomerId('');
        setUnregisteredQrPhone(normPhone);
        toast(
          `Pesanan QR #${order.publicQrToken} dimuat. Nomor HP ${normPhone} belum terdaftar sebagai member.`,
          { icon: '💡', duration: 4000, position: 'top-center' }
        );
      }
    } else {
      // Kondisi 3: Pelanggan TIDAK Mengisi Nomor HP
      setIsQrOrderWithoutPhone(true);
      setSelectedCustomerId('');
      setUnregisteredQrPhone(null);
      setCustomerPhone('');
      toast.success(
        `Pesanan QR #${order.publicQrToken} dimuat ke keranjang kasir (Tanpa Nomor HP).`,
        { duration: 3000, position: 'top-center' }
      );
    }

    // 4. Simpan referensi pesanan QR aktif
    setActiveQrOrder(order);

    // 5. Reset promo agar kasir bisa input kode promo baru jika pelanggan memiliki voucher
    setAppliedPromo(null);
    setInputPromoCode('');

    // 6. Alihkan langsung ke tab KATALOG POS agar kasir melihat keranjang di sebelah kanan
    setActiveTab('CATALOG');
  }

  function detachQrOrder() {
    setActiveQrOrder(null);
    setIsQrOrderWithoutPhone(false);
    toast('Tautan pesanan QR dilepas. Keranjang beralih ke pesanan kasir biasa.', { icon: 'ℹ️' });
  }

  async function handleCancelPendingOrder(orderId) {
    const confirmCancel = window.confirm('Yakin ingin membatalkan dan menghapus pesanan QR ini?');
    if (!confirmCancel) return;

    try {
      const res = await cancelPublicQrOrder(orderId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Pesanan QR berhasil dibatalkan.');
        if (activeQrOrder?.id === orderId) {
          clearCart();
        }
        loadPendingOrders();
      }
    } catch (err) {
      console.error('[handleCancelPendingOrder] Error:', err);
      toast.error('Gagal membatalkan pesanan QR.');
    }
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

          {/* Quick Printer Button & Status */}
          <button
            type="button"
            onClick={() => setIsBtModalOpen(true)}
            className={cn(
              "px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer",
              btConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
            )}
            title={btConnected ? `Printer Bluetooth: ${btDeviceName} (${effectiveStore.printerWidth}mm)` : 'Hubungkan atau tes cetak printer thermal'}
          >
            <span className={cn("w-2 h-2 rounded-full", btConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            <span>🖨️ {btConnected ? (btDeviceName || 'Printer Siap') : 'Printer'}</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {effectiveStore.printerWidth}mm
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!activeShift) {
                toast.error('Buka shift kasir terlebih dahulu untuk mencatat kas keluar.');
                return;
              }
              setIsCashOutModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Catat pengeluaran kas fisik kasir (Cash Out)"
          >
            <span>💸</span>
            <span>Kas Keluar</span>
          </button>

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
        <div className="relative">
          {/* Overlay Terkunci jika shift belum dibuka */}
          {!activeShift && !loading && (
            <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[3px] rounded-3xl flex items-start justify-center pt-16 sm:pt-24 p-4">
              <div className="sticky top-24 bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">Shift Kasir Belum Dibuka</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Halaman POS terkunci. Buka shift kasir terlebih dahulu dengan memasukkan modal awal laci kas untuk dapat memilih menu pesanan dan memproses transaksi pembayaran.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpenShiftModalOpen(true)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Buka Shift Kasir Sekarang
                  </button>
                  <Link
                    href="/dashboard/pos/shift"
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Buka Halaman Manajemen Shift &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-5 items-start", !activeShift && !loading && "pointer-events-none select-none opacity-40")}>
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

                {/* Active QR Order Indicator */}
                {activeQrOrder && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-between text-xs text-amber-900 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-mono font-bold text-[11px] shrink-0">
                        {activeQrOrder.publicQrToken}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">
                          Meja: {activeQrOrder.customerNameSnapshot}
                        </p>
                        <p className="text-[10px] text-amber-800 font-mono">
                          #{activeQrOrder.orderNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={detachQrOrder}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 hover:underline shrink-0 ml-2 cursor-pointer"
                      title="Lepas tautan dan jadikan transaksi kasir biasa"
                    >
                      Lepas Tautan
                    </button>
                  </div>
                )}

                {/* Customer / Member Selection & Queue Inputs */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Pelanggan / Member
                        </label>
                        {selectedCustomerId && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Member Terverifikasi
                          </span>
                        )}
                      </div>
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
                          label: `★ ${c.name} ${c.phone ? `(${c.phone})` : ''} ${c.email ? `• ${c.email}` : ''}`.trim(),
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
                            setUnregisteredQrPhone(null);
                            setIsQrOrderWithoutPhone(false);
                            toast.success(`Member "${c.name}" berhasil dihubungkan ke pesanan!`, {
                              position: 'top-center',
                            });
                          }
                        } else {
                          const fallbackName = activeQrOrder?.customerNameSnapshot || 'Pelanggan';
                          const fallbackPhone = activeQrOrder?.customerPhoneSnapshot || '';
                          setCustomerName(fallbackName);
                          setCustomerPhone(fallbackPhone);
                          if (fallbackPhone) {
                            setUnregisteredQrPhone(normalizePhone(fallbackPhone));
                            setIsQrOrderWithoutPhone(false);
                          } else if (activeQrOrder) {
                            setIsQrOrderWithoutPhone(true);
                          }
                          toast('Pesanan dilanjutkan sebagai Guest (Bukan Member).', {
                            icon: '👤',
                            position: 'top-center',
                          });
                        }
                      }}
                      onCreateOption={(inputValue) => {
                        const isDigits = /^[0-9+\-\s]+$/.test(inputValue.trim());
                        if (isDigits) {
                          openCustomerModal(customerName !== 'Pelanggan' ? customerName : '', inputValue.trim(), '', 'name');
                        } else {
                          openCustomerModal(inputValue.trim(), '', '', 'phone');
                        }
                      }}
                      formatCreateLabel={(inputValue) => `+ Daftarkan "${inputValue}" sebagai Member Baru`}
                      placeholder={
                        isQrOrderWithoutPhone || (activeQrOrder && !customerPhone)
                          ? "Cari member (Nama / No HP) atau pilih Guest..."
                          : "Cari member / ketik nama baru..."
                      }
                      noOptionsMessage={({ inputValue }) =>
                        inputValue ? (
                          <div className="py-2 px-1 text-center space-y-1.5">
                            <p className="text-slate-500 text-xs">Member &quot;{inputValue}&quot; tidak ditemukan</p>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const isDigits = /^[0-9+\-\s]+$/.test(inputValue.trim());
                                if (isDigits) {
                                  openCustomerModal(customerName !== 'Pelanggan' ? customerName : '', inputValue.trim(), '', 'name');
                                } else {
                                  openCustomerModal(inputValue.trim(), '', '', 'phone');
                                }
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

                    {/* Banner Rekomendasi Pendaftaran Member (Kondisi 1: Pesanan QR tanpa nomor HP) */}
                    {(isQrOrderWithoutPhone || (activeQrOrder && !customerPhone && !unregisteredQrPhone)) && !selectedCustomerId && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 shadow-xs animate-in fade-in duration-200">
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5 leading-none shrink-0">💡</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-snug font-medium text-amber-900">
                              Pesanan QR <span className="font-bold text-amber-950">({customerName || 'Guest'})</span> belum terhubung member.
                            </p>
                            <p className="text-[10px] text-amber-800/80 mt-0.5">
                              Tanyakan apakah pelanggan sudah memiliki member atau daftarkan member baru.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openCustomerModal(customerName !== 'Pelanggan' ? customerName : '', '', '', 'phone')}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                + Daftarkan Member Baru
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Banner Rekomendasi Pendaftaran Member (Kondisi 2: Nomor HP dari QR belum terdaftar di DB) */}
                    {unregisteredQrPhone && !selectedCustomerId && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 shadow-xs animate-in fade-in duration-200">
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5 leading-none shrink-0">💡</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-snug font-medium text-amber-900">
                              Nomor HP <span className="font-mono font-bold text-amber-950">{unregisteredQrPhone}</span> belum terdaftar sebagai member. Tawarkan pendaftaran member kepada pelanggan.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openCustomerModal(customerName !== 'Pelanggan' ? customerName : '', unregisteredQrPhone, '', 'name')}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                + Daftarkan sebagai Member
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pilihan Dine In / Takeaway */}
                  <div>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => handleOrderTypeChange('DINE_IN')}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                          orderType === 'DINE_IN'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <span className="text-sm">🍽️</span>
                        <span>Dine In (A)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrderTypeChange('TAKEAWAY')}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                          orderType === 'TAKEAWAY'
                            ? 'bg-white text-amber-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <span className="text-sm">🥡</span>
                        <span>Takeaway (TA)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 items-center justify-between">
                        <span>Antrean <span className="text-rose-500 font-bold">*</span></span>
                        <span className={cn('text-[9px] font-bold px-1 rounded', orderType === 'TAKEAWAY' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                          {orderType === 'TAKEAWAY' ? 'TA' : 'A'}
                        </span>
                      </label>
                      <div className={cn(
                        'flex items-center rounded-xl border bg-white overflow-hidden transition-all focus-within:ring-2',
                        !queueInput.trim()
                          ? 'border-rose-300 focus-within:ring-rose-400'
                          : orderType === 'TAKEAWAY'
                            ? 'border-amber-300 focus-within:ring-amber-500'
                            : 'border-slate-200 focus-within:ring-emerald-500'
                      )}>
                        <span className={cn(
                          'px-2 py-1.5 text-xs font-black font-mono select-none border-r shrink-0',
                          orderType === 'TAKEAWAY'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        )}>
                          {orderType === 'TAKEAWAY' ? 'TA-' : 'A-'}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={queueInput}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '');
                            setQueueInput(digitsOnly);
                          }}
                          className={cn(
                            'w-full px-2 py-1.5 font-mono font-black text-xs text-center focus:outline-none bg-transparent',
                            orderType === 'TAKEAWAY' ? 'text-amber-800' : 'text-emerald-800',
                            !queueInput.trim() && 'placeholder:text-rose-300'
                          )}
                          placeholder="Wajib"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Nama Pelanggan
                        </label>
                        {customerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {customerPhone}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        readOnly={Boolean(selectedCustomerId)}
                        className={cn(
                          'w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500',
                          selectedCustomerId && 'bg-slate-50 text-slate-700 cursor-not-allowed border-slate-200/80 font-semibold'
                        )}
                        placeholder="Nama Pelanggan"
                        title={selectedCustomerId ? 'Nama terkunci sesuai data profil member' : 'Nama Pelanggan'}
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

              {/* Promo Code Trigger (Modal Popup) */}
              <div className="p-3 bg-slate-50/70 border-t border-slate-100">
                {appliedPromo ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">🏷️</span>
                      <div className="min-w-0">
                        <p className="font-bold font-mono text-emerald-950 truncate">{appliedPromo.code}</p>
                        <p className={promotionDiscount > 0 ? "text-[11px] font-bold text-emerald-700 font-mono" : "text-amber-700 text-[11px]"}>
                          {promotionDiscount > 0 ? `Hemat ${formatRupiah(promotionDiscount)}` : '(Syarat belum cukup)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          refreshPromotions();
                          setIsPromoModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={removePromo}
                        className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                        title="Batal gunakan promo"
                      >
                        <span>Batal</span>
                        <span className="text-xs">&times;</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      refreshPromotions();
                      setIsPromoModalOpen(true);
                    }}
                    className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 border border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl text-xs font-bold text-emerald-700 transition-all flex items-center justify-between shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base group-hover:scale-110 transition-transform">🏷️</span>
                      <span>Pilih Promo Diskon</span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      Lihat Promo {promotionsList.length > 0 ? `(${promotionsList.length})` : ''} &rarr;
                    </span>
                  </button>
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
                  disabled={cart.length === 0 || isPending || !activeShift}
                  className={cn(
                    "w-full py-3.5 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2",
                    !activeShift
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  )}
                >
                  {!activeShift ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Shift Kasir Belum Dibuka
                    </span>
                  ) : (
                    <>
                      <span>Bayar Sekarang</span>
                      <span>&bull;</span>
                      <span className="font-mono">{formatRupiah(effectiveTotal)}</span>
                    </>
                  )}
                </button>
              </div>
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
              onClick={loadPendingOrders}
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelPendingOrder(ord.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Batalkan / Hapus pesanan QR ini"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openQrOrderCheckout(ord)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Buka di Kasir</span>
                          <span>&rarr;</span>
                        </button>
                      </div>
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
                <span>Antrean #{fullQueueNumber || 'Belum diisi'} ({orderType === 'TAKEAWAY' ? 'Takeaway / Bungkus' : 'Dine In / Di Tempat'})</span>
                <span>&bull;</span>
                <span>{customerName}</span>
                {appliedPromo && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-600 font-mono font-bold">
                      {appliedPromo.code} (-{formatRupiah(promotionDiscount)})
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

                  {/* Quick Cash Buttons (Pecahan Lembaran Rupiah Dinamis) */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCashReceived(effectiveTotal)}
                      className={cn(
                        'flex-1 min-w-17.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center whitespace-nowrap',
                        Number(cashReceived) === Number(effectiveTotal)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                      )}
                    >
                      Uang Pas
                    </button>
                    {suggestedCashAmounts.map((nom) => {
                      const isSelected = Number(cashReceived) === nom;
                      return (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => setCashReceived(nom)}
                          className={cn(
                            'flex-1 min-w-17.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all font-mono text-center whitespace-nowrap',
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                          )}
                        >
                          {nom >= 1000 ? `${(nom / 1000).toLocaleString('id-ID')}rb` : nom}
                        </button>
                      );
                    })}
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
                /* QRIS Dynamic Display */
                <div className="p-4 bg-linear-to-b from-blue-50/60 to-slate-50 border border-blue-200/80 rounded-2xl text-center space-y-3">
                  {settings?.qrisImageUrl ? (
                    <div className="space-y-3">
                      <div className="relative mx-auto w-52 h-52 sm:w-56 sm:h-56 bg-white rounded-2xl p-2.5 border-2 border-blue-100 shadow-xs flex items-center justify-center group overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={settings.qrisImageUrl}
                          alt="QRIS Barcode"
                          className="w-full h-full object-contain cursor-pointer transition-transform duration-200 group-hover:scale-105"
                          onClick={() => setZoomQrisUrl(settings.qrisImageUrl)}
                          title="Klik untuk memperbesar QRIS"
                        />
                        <button
                          type="button"
                          onClick={() => setZoomQrisUrl(settings.qrisImageUrl)}
                          className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white text-[10px] font-semibold backdrop-blur-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                          </svg>
                          Perbesar
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/90 text-blue-950 text-xs font-bold">
                          <span>Total Tagihan:</span>
                          <span className="font-mono text-emerald-700 font-extrabold">{formatRupiah(effectiveTotal)}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Tunjukkan kode QRIS ke pelanggan untuk di-scan. Verifikasi status pembayaran sebelum konfirmasi.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 px-2 space-y-2">
                      <div className="w-12 h-12 mx-auto bg-amber-100/80 rounded-2xl border border-amber-200 flex items-center justify-center text-amber-700">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-slate-800">Barcode QRIS Belum Diunggah</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                        Silakan unggah gambar barcode QRIS toko di menu <strong className="text-slate-700">Pengaturan Toko</strong> agar gambar QRIS otomatis muncul di sini.
                      </p>
                      <a
                        href="/dashboard/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold underline underline-offset-2 pt-1"
                      >
                        Buka Pengaturan Toko &rarr;
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Status Printer & Toggle Auto-Print */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      btConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                    )} />
                    <span className="text-[11px] text-slate-600">
                      Printer Thermal: <strong className="text-slate-800">{btConnected ? (btDeviceName || 'Terhubung') : 'Belum Terhubung'}</strong>
                    </span>
                  </div>
                  {!btConnected && (
                    <button
                      type="button"
                      onClick={() => setIsBtModalOpen(true)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                    >
                      Hubungkan Printer
                    </button>
                  )}
                </div>

                <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="font-semibold block">Cetak struk kasir otomatis</span>
                    <span className="text-[10px] text-slate-500 block">
                      Kirim perintah cetak langsung ke printer thermal setelah pembayaran
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintEnabled}
                    onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || (paymentMethod === 'CASH' && Number(cashReceived) < effectiveTotal)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isPending ? (
                    'Memproses Transaksi...'
                  ) : (
                    <>
                      <span>Konfirmasi & Cetak Struk</span>
                      {!btConnected && (
                        <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" title="Printer belum terhubung" />
                      )}
                    </>
                  )}
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
                  ref={newCustNameInputRef}
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  ref={newCustPhoneInputRef}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Pelanggan <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="Contoh: pelanggan@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bisa dikosongkan atau diisi untuk pengiriman info promo dan struk digital.
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

      {/* ─── MODAL ZOOM / FULLSCREEN QRIS ─────────────────────────────────── */}
      {zoomQrisUrl && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-60 flex items-center justify-center p-4"
          onClick={() => setZoomQrisUrl(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm sm:max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pindai Pembayaran QRIS
              </span>
              <button
                type="button"
                onClick={() => setZoomQrisUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomQrisUrl}
                alt="QRIS Barcode Besar"
                className="w-full max-h-[55vh] object-contain"
              />
            </div>

            <div className="space-y-1">
              <p className="text-lg font-mono font-extrabold text-emerald-700">
                {checkoutModalOpen ? formatRupiah(effectiveTotal) : ''}
              </p>
              <p className="text-xs text-slate-500">
                Arahkan kamera smartphone ke kode QRIS di atas untuk menyelesaikan transaksi.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setZoomQrisUrl(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup Tampilan Penuh
            </button>
          </div>
        </div>
      )}

      {/* ─── Hidden Printable Thermal Receipt Container ───────────────────────── */}
      <ThermalReceipt order={printOrder} store={effectiveStore} printMode={printMode} />

      {/* ─── MODAL KONEKSI PRINTER BLUETOOTH (QUICK CONNECT) ───────────────────── */}
      <BluetoothModal
        isOpen={isBtModalOpen}
        onClose={() => setIsBtModalOpen(false)}
        userName="Kasir"
        storeInfo={effectiveStore}
        onConnectedContinue={() => {
          setIsBtModalOpen(false);
          handleProcessCheckout(null, true);
        }}
        onProceedWithoutPrinter={() => {
          setIsBtModalOpen(false);
          handleProcessCheckout(null, true);
        }}
        continueButtonText="Lanjutkan Konfirmasi & Cetak Struk"
      />

      {/* ─── MODAL BUKA SHIFT KASIR (QUICK OPEN SHIFT) ───────────────────── */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  🔓
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buka Shift Kasir Baru</h3>
                  <p className="text-[11px] text-slate-500">Mulai sesi kasir untuk melayani pesanan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleQuickOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Modal Awal Laci Kasir (Cash Drawer)
                </label>
                <CurrencyInput
                  value={quickOpeningCash}
                  onChange={(val) => setQuickOpeningCash(val)}
                  placeholder="Rp 0"
                  className="w-full text-base font-bold font-mono py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Masukkan uang fisik kembalian awal di laci kasir (boleh Rp 0 jika tanpa modal).
                </p>

                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[0, 50000, 100000, 200000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setQuickOpeningCash(amt)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer",
                        quickOpeningCash === amt
                          ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                          : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
                      )}
                    >
                      {amt === 0 ? 'Rp 0' : formatRupiah(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  disabled={isOpeningShift}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOpeningShift}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isOpeningShift ? 'Membuka Shift...' : 'Buka Shift Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DAFTAR PROMO & VOUCHER DISKON ─────────────────────────── */}
      <PromoModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        promotions={promotionsList}
        cart={cart}
        subtotal={subtotal}
        appliedPromo={appliedPromo}
        onSelectPromo={handleSelectPromoFromModal}
        onRemovePromo={removePromo}
        onManualCodeSubmit={handleManualCodeSubmit}
        isValidating={isValidatingPromo}
      />

      {/* ─── MODAL CASH OUT DI LAYAR POS ───────────────────────────────────── */}
      <CashOutModal
        isOpen={isCashOutModalOpen}
        onClose={() => setIsCashOutModalOpen(false)}
        onSuccess={loadData}
        shift={activeShift}
        initialType="CASH_OUT"
      />
    </div>
  );
}
