'use client';

import { useState, useMemo } from 'react';
import { formatRupiah, cn } from '@/lib/utils';

export default function PromoModal({
  isOpen,
  onClose,
  promotions = [],
  cart = [],
  subtotal = 0,
  appliedPromo = null,
  onSelectPromo,
  onRemovePromo,
  onManualCodeSubmit,
  isValidating = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ELIGIBLE' | 'INELIGIBLE'
  const [manualCode, setManualCode] = useState('');

  // Evaluasi setiap promosi terhadap kondisi keranjang (cart) saat ini
  const evaluatedPromotions = useMemo(() => {
    return promotions.map((promo) => {
      const conditions = promo.conditionGroup?.conditions || [];
      const action = promo.discountAction || {};
      const missingRequirements = [];

      // 1. Cek apakah keranjang kosong
      if (cart.length === 0) {
        missingRequirements.push('Keranjang belanja masih kosong. Tambahkan menu terlebih dahulu.');
      }

      // 2. Cek Limit Penggunaan Global
      if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
        missingRequirements.push('Kuota penggunaan promo ini sudah habis.');
      }

      // 3. Cek Syarat Minimum Pembelian (MINIMUM_PURCHASE)
      const minPurchaseCond = conditions.find((c) => c.type === 'MINIMUM_PURCHASE');
      if (minPurchaseCond && minPurchaseCond.minimumPurchase) {
        const minReq = Number(minPurchaseCond.minimumPurchase);
        if (subtotal < minReq) {
          const shortage = minReq - subtotal;
          missingRequirements.push(
            `Kurang belanja ${formatRupiah(shortage)} lagi (Minimal belanja ${formatRupiah(minReq)}).`
          );
        }
      }

      // 4. Cek Syarat Target Produk (PRODUCT Scope)
      let eligibleSubtotal = subtotal;
      let targetProductInfo = null;

      if (action.scope === 'PRODUCT') {
        const prodCond = conditions.find((c) => c.type === 'PRODUCT');
        if (prodCond && prodCond.productId) {
          const targetItem = cart.find((it) => it.productId === prodCond.productId);
          targetProductInfo = prodCond.product?.name || 'Menu Spesifik';

          if (!targetItem) {
            missingRequirements.push(
              `Wajib menambahkan menu "${targetProductInfo}" ke dalam keranjang belanja.`
            );
            eligibleSubtotal = 0;
          } else {
            // Hitung subtotal hanya dari item target
            eligibleSubtotal = cart
              .filter((it) => it.productId === prodCond.productId)
              .reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
          }
        }
      }

      // Hitung Estimasi Penghematan (jika eligible)
      let estimatedSavings = 0;
      const isEligible = missingRequirements.length === 0;

      if (isEligible) {
        const actionVal = Number(action.value) || 0;
        if (action.type === 'PERCENTAGE') {
          estimatedSavings = eligibleSubtotal * (actionVal / 100);
        } else {
          estimatedSavings = Math.min(eligibleSubtotal, actionVal);
        }

        if (action.maxDiscount) {
          const cap = Number(action.maxDiscount);
          if (cap > 0 && estimatedSavings > cap) {
            estimatedSavings = cap;
          }
        }
        estimatedSavings = Math.round(estimatedSavings * 100) / 100;
      }

      const isCurrentlyApplied = appliedPromo?.code === promo.code;

      return {
        ...promo,
        isEligible,
        isCurrentlyApplied,
        missingRequirements,
        estimatedSavings,
        targetProductInfo,
      };
    });
  }, [promotions, cart, subtotal, appliedPromo]);

  // Filter berdasarkan search query dan tab filter
  const filteredPromotions = useMemo(() => {
    return evaluatedPromotions.filter((p) => {
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab =
        filterType === 'ALL' ||
        (filterType === 'ELIGIBLE' && p.isEligible) ||
        (filterType === 'INELIGIBLE' && !p.isEligible);

      return matchSearch && matchTab;
    });
  }, [evaluatedPromotions, searchQuery, filterType]);

  const eligibleCount = evaluatedPromotions.filter((p) => p.isEligible).length;
  const ineligibleCount = evaluatedPromotions.filter((p) => !p.isEligible).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg shadow-xs">
              🏷️
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pilih Promo & Voucher Diskon</h2>
              <p className="text-xs text-slate-500">
                Pilih promo yang memenuhi syarat untuk mendapatkan potongan harga pesanan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Tabs Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semua ({evaluatedPromotions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ELIGIBLE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                filterType === 'ELIGIBLE'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>Bisa Dipakai</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                {eligibleCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('INELIGIBLE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                filterType === 'INELIGIBLE'
                  ? 'bg-white text-amber-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>Belum Memenuhi</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {ineligibleCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau kode promo..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Promo List Cards */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3.5 min-h-62.5">
          {filteredPromotions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-4xl">🏷️</span>
              <p className="text-xs font-bold text-slate-600">Tidak ada promo yang sesuai</p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? 'Coba ubah kata kunci pencarian promo Anda.'
                  : 'Belum ada promosi yang aktif saat ini.'}
              </p>
            </div>
          ) : (
            filteredPromotions.map((promo) => {
              const isEligible = promo.isEligible;
              const isApplied = promo.isCurrentlyApplied;
              const action = promo.discountAction || {};

              return (
                <div
                  key={promo.id}
                  onClick={() => {
                    if (isEligible && !isApplied && onSelectPromo) {
                      onSelectPromo(promo);
                      onClose();
                    }
                  }}
                  className={cn(
                    'p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 relative select-none',
                    isApplied
                      ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-md'
                      : isEligible
                        ? 'border-slate-200 hover:border-emerald-400 hover:shadow-md bg-white cursor-pointer group active:scale-[0.99]'
                        : 'border-slate-200 bg-slate-50/70 opacity-75 cursor-not-allowed'
                  )}
                >
                  {/* Top Bar: Name, Code & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white shadow-2xs uppercase tracking-wider">
                          {promo.code}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {promo.name}
                        </h3>
                      </div>
                      {promo.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {promo.description}
                        </p>
                      )}
                    </div>

                    {/* Eligibility Badge */}
                    <div className="shrink-0">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span>✓</span> Sedang Digunakan
                        </span>
                      ) : isEligible ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <span>✓</span> Bisa Dipakai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          <span>✕</span> Belum Memenuhi Syarat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Discount Details & Benefit Preview */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-semibold">
                        {action.type === 'PERCENTAGE'
                          ? `Diskon ${action.value}%`
                          : `Potongan ${formatRupiah(action.value)}`}
                      </span>
                      {action.maxDiscount && (
                        <span className="text-[11px] text-slate-400">
                          (Maks. {formatRupiah(action.maxDiscount)})
                        </span>
                      )}
                      {action.scope === 'PRODUCT' && promo.targetProductInfo && (
                        <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          Khusus menu: <strong>{promo.targetProductInfo}</strong>
                        </span>
                      )}
                    </div>

                    {/* Potential Savings Amount */}
                    {isEligible && promo.estimatedSavings > 0 && (
                      <span className="font-mono font-extrabold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Hemat {formatRupiah(promo.estimatedSavings)}
                      </span>
                    )}
                  </div>

                  {/* Missing Requirement Alert Box (Jika tidak eligible) */}
                  {!isEligible && promo.missingRequirements.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-amber-950">
                        <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        Syarat Belum Terpenuhi:
                      </p>
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
                        {promo.missingRequirements.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    {isApplied ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemovePromo) onRemovePromo();
                        }}
                        className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Hapus Promo dari Keranjang
                      </button>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectPromo) {
                            onSelectPromo(promo);
                            onClose();
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Gunakan Promo Ini</span>
                        <span>&rarr;</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-semibold cursor-not-allowed"
                      >
                        Belum Memenuhi Syarat
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Manual Promo Code Input Option */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCode.trim()) return;
              if (onManualCodeSubmit) {
                onManualCodeSubmit(manualCode.trim().toUpperCase());
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Punya kode promo rahasia? Ketik di sini..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={isValidating || !manualCode.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isValidating ? 'Memvalidasi...' : 'Terapkan Kode'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
