'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import {
  getProductWithDetails,
  updateProduct,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  saveRecipe,
  getRecipeHistory,
  getProductCategories,
} from '@/app/actions/product';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, cn } from '@/lib/utils';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RECIPE'); // 'RECIPE' | 'VARIANTS' | 'EDIT_INFO'
  const [isPending, startTransition] = useTransition();

  // Recipe Formulator State
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [recipeTargetVariant, setRecipeTargetVariant] = useState(null); // null means parent product
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeHistory, setRecipeHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Variant Modal State
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    price: 0,
    availability: 'AVAILABLE',
    discontinued: false,
    inventoryItemId: '',
  });

  // Product Edit Info Form State
  const [prodForm, setProdForm] = useState({
    name: '',
    sku: '',
    price: 0,
    categoryId: '',
    availability: 'AVAILABLE',
    discontinued: false,
    inventoryItemId: '',
  });

  const loadData = async () => {
    setLoading(true);
    const [prodRes, catRes, invRes] = await Promise.all([
      getProductWithDetails(productId),
      getProductCategories(),
      getInventoryItems(),
    ]);

    if (prodRes?.error) {
      toast.error(prodRes.error);
      router.push('/dashboard/products/list');
      return;
    }

    const p = prodRes.data;
    setProduct(p);
    setCategories(catRes.data || []);
    setInventoryItems(invRes.data || []);

    setProdForm({
      name: p.name,
      sku: p.sku || '',
      price: p.price,
      categoryId: p.categoryId,
      availability: p.availability,
      discontinued: p.discontinued,
      inventoryItemId: p.inventoryItemId || '',
    });

    if (p.type === 'DIRECT_STOCK' && activeTab === 'RECIPE') {
      setActiveTab('VARIANTS');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (productId) {
      loadData();
    }
  }, [productId]);

  // ─── RECIPE FORMULATOR HANDLERS ──────────────────────────────────────────
  const openRecipeEditor = (variant = null) => {
    setRecipeTargetVariant(variant);
    const currentActiveRecipe = variant ? variant.recipe : product?.recipe;

    if (currentActiveRecipe?.activeVersion?.ingredients) {
      setRecipeIngredients(
        currentActiveRecipe.activeVersion.ingredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          quantity: ing.quantity,
        }))
      );
    } else {
      setRecipeIngredients([
        {
          inventoryItemId: inventoryItems[0]?.id || '',
          quantity: 1,
        },
      ]);
    }
    setIsEditingRecipe(true);
  };

  const addIngredientRow = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      {
        inventoryItemId: inventoryItems[0]?.id || '',
        quantity: 1,
      },
    ]);
  };

  const removeIngredientRow = (index) => {
    if (recipeIngredients.length <= 1) {
      toast.error('Resep harus memiliki minimal 1 bahan baku.');
      return;
    }
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const updateIngredientField = (index, field, value) => {
    const updated = [...recipeIngredients];
    updated[index][field] = value;
    setRecipeIngredients(updated);
  };

  const handleSaveRecipe = (e) => {
    e.preventDefault();

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan versi resep baru...');
      const res = await saveRecipe({
        productId: recipeTargetVariant ? null : product.id,
        variantId: recipeTargetVariant ? recipeTargetVariant.id : null,
        ingredients: recipeIngredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: parseFloat(i.quantity) || 0,
        })),
      });

      if (res?.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success(
        `Resep Versi ${res.data.versionNumber} berhasil disimpan & diaktifkan!`,
        { id: toastId }
      );
      setIsEditingRecipe(false);
      loadData();
    });
  };

  const viewRecipeHistory = async (variant = null) => {
    setRecipeTargetVariant(variant);
    const res = await getRecipeHistory({
      productId: variant ? null : product.id,
      variantId: variant ? variant.id : null,
    });
    if (res?.error) {
      toast.error(res.error);
    } else {
      setRecipeHistory(res.data || []);
      setShowHistoryModal(true);
    }
  };

  // ─── VARIANT CRUD HANDLERS ───────────────────────────────────────────────
  const openCreateVariantModal = () => {
    setEditingVariant(null);
    setVariantForm({
      name: '',
      sku: '',
      price: product?.price || 0,
      availability: 'AVAILABLE',
      discontinued: false,
      inventoryItemId: inventoryItems[0]?.id || '',
    });
    setVariantModalOpen(true);
  };

  const openEditVariantModal = (v) => {
    setEditingVariant(v);
    setVariantForm({
      name: v.name,
      sku: v.sku || '',
      price: v.price,
      availability: v.availability,
      discontinued: v.discontinued,
      inventoryItemId: v.inventoryItemId || '',
    });
    setVariantModalOpen(true);
  };

  const handleSaveVariant = (e) => {
    e.preventDefault();

    startTransition(async () => {
      let res;
      if (editingVariant) {
        const toastId = toast.loading('Menyimpan perubahan varian...');
        res = await updateProductVariant({
          id: editingVariant.id,
          name: variantForm.name,
          sku: variantForm.sku,
          price: variantForm.price,
          availability: variantForm.availability,
          discontinued: variantForm.discontinued,
          inventoryItemId: variantForm.inventoryItemId,
        });
        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }
        toast.success('Varian berhasil diperbarui!', { id: toastId });
      } else {
        const toastId = toast.loading('Menambahkan varian baru...');
        res = await createProductVariant({
          productId: product.id,
          name: variantForm.name,
          sku: variantForm.sku,
          price: variantForm.price,
          availability: variantForm.availability,
          inventoryItemId: variantForm.inventoryItemId,
        });
        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }
        toast.success(`Varian "${res.data.name}" berhasil dibuat!`, { id: toastId });
      }

      setVariantModalOpen(false);
      loadData();
    });
  };

  const handleDeleteVariant = async (variant) => {
    const Swal = (await import('sweetalert2')).default;
    const confirm = await Swal.fire({
      title: 'Hapus Varian?',
      text: `Apakah Anda yakin ingin menghapus varian "${variant.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b45309',
      cancelButtonColor: '#44403c',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      background: '#1c1917',
      color: '#fef3c7',
    });

    if (confirm.isConfirmed) {
      startTransition(async () => {
        const toastId = toast.loading('Menghapus varian...');
        const res = await deleteProductVariant(variant.id);
        if (res?.error) {
          toast.error(res.error, { id: toastId });
        } else {
          toast.success('Varian berhasil dihapus.', { id: toastId });
          loadData();
        }
      });
    }
  };

  // ─── PRODUCT INFO HANDLER ────────────────────────────────────────────────
  const handleSaveProductInfo = (e) => {
    e.preventDefault();

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan informasi produk...');
      const res = await updateProduct(product.id, {
        name: prodForm.name,
        sku: prodForm.sku,
        price: prodForm.price,
        categoryId: prodForm.categoryId,
        type: product.type,
        availability: prodForm.availability,
        discontinued: prodForm.discontinued,
        inventoryItemId: product.type === 'DIRECT_STOCK' ? prodForm.inventoryItemId : null,
      });

      if (res?.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success('Informasi produk berhasil diperbarui!', { id: toastId });
      loadData();
    });
  };

  if (loading || !product) {
    return (
      <div className="p-8 text-center text-stone-500 text-xs">
        Memuat detail konfigurasi produk...
      </div>
    );
  }

  // Live calculation of estimated HPP during recipe editing
  const liveEstimatedHpp = recipeIngredients.reduce((sum, ing) => {
    const item = inventoryItems.find((i) => i.id === ing.inventoryItemId);
    const avg = item?.balance ? Number(item.balance.averageCost) : 0;
    const qty = parseFloat(ing.quantity) || 0;
    return sum + qty * avg;
  }, 0);

  const activeRecipe = product.recipe;
  const targetPrice = recipeTargetVariant ? recipeTargetVariant.price : product.price;
  const currentHpp = isEditingRecipe
    ? liveEstimatedHpp
    : activeRecipe?.activeVersion?.estimatedHpp || 0;
  const marginPercentage =
    targetPrice > 0 ? (((targetPrice - currentHpp) / targetPrice) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/dashboard/products/list" className="hover:text-amber-400 transition-colors">
              &larr; Daftar Menu Produk
            </Link>
            <span>/</span>
            <span className="text-amber-200">{product.categoryName}</span>
          </div>
          <h1 className="text-xl font-bold text-amber-50 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              </svg>
            </span>
            {product.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border',
              product.type === 'RECIPE'
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                : 'bg-blue-950/60 text-blue-300 border-blue-800/40'
            )}
          >
            Tipe: {product.type === 'RECIPE' ? 'Resep Komposisi' : 'Stok Langsung'}
          </span>
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border',
              product.availability === 'AVAILABLE'
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/40'
            )}
          >
            {product.availability === 'AVAILABLE' ? 'Tersedia' : 'Habis'}
          </span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Harga Jual Pokok</p>
          <p className="text-xl font-bold font-mono text-amber-300 mt-1">
            {formatRupiah(product.price)}
          </p>
        </div>

        {product.type === 'RECIPE' ? (
          <>
            <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
              <p className="text-[11px] font-semibold text-stone-400">Estimasi HPP (WAC)</p>
              <p className="text-xl font-bold font-mono text-amber-100 mt-1">
                {formatRupiah(product.recipe?.activeVersion?.estimatedHpp || 0)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-900/60 border border-emerald-900/30">
              <p className="text-[11px] font-semibold text-emerald-400">Margin Keuntungan</p>
              <p className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {product.price > 0 && product.recipe?.activeVersion?.estimatedHpp
                  ? `${(
                      ((product.price - product.recipe.activeVersion.estimatedHpp) /
                        product.price) *
                      100
                    ).toFixed(1)}%`
                  : '-'}
              </p>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
            <p className="text-[11px] font-semibold text-stone-400">Bahan Baku Terhubung</p>
            <p className="text-sm font-bold text-amber-100 mt-1 truncate">
              {product.inventoryItem ? product.inventoryItem.name : 'Belum dihubungkan'}
            </p>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
          <p className="text-[11px] font-semibold text-stone-400">Jumlah Varian</p>
          <p className="text-xl font-bold font-mono text-stone-200 mt-1">
            {product.variants?.length || 0} Varian
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-stone-800 gap-2">
        {product.type === 'RECIPE' && (
          <button
            onClick={() => {
              setActiveTab('RECIPE');
              setIsEditingRecipe(false);
            }}
            className={cn(
              'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2',
              activeTab === 'RECIPE'
                ? 'border-amber-500 text-amber-400 bg-stone-900/50'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Formulasi Resep (HPP)
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('VARIANTS');
            setIsEditingRecipe(false);
          }}
          className={cn(
            'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2',
            activeTab === 'VARIANTS'
              ? 'border-amber-500 text-amber-400 bg-stone-900/50'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Daftar Varian Produk ({product.variants?.length || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab('EDIT_INFO');
            setIsEditingRecipe(false);
          }}
          className={cn(
            'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2',
            activeTab === 'EDIT_INFO'
              ? 'border-amber-500 text-amber-400 bg-stone-900/50'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Edit Info Menu
        </button>
      </div>

      {/* ─── TAB 1: FORMULASI RESEP ────────────────────────────────────────────── */}
      {activeTab === 'RECIPE' && product.type === 'RECIPE' && (
        <div className="space-y-6">
          {!isEditingRecipe ? (
            <div className="bg-stone-900/70 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-amber-50">
                      Resep Aktif: {activeRecipe ? activeRecipe.name : product.name}
                    </h2>
                    {activeRecipe?.activeVersion && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                        Versi {activeRecipe.activeVersion.versionNumber} (Aktif)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Bahan baku ini akan otomatis dipotong secara proporsional dari stok inventaris saat pesanan kasir dibayar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewRecipeHistory(null)}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold border border-stone-700 transition-all"
                  >
                    Riwayat Versi
                  </button>
                  <button
                    onClick={() => openRecipeEditor(null)}
                    className="px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {activeRecipe ? 'Perbarui Formula Resep' : 'Susun Resep Baru'}
                  </button>
                </div>
              </div>

              {/* Ingredients List Table */}
              {activeRecipe?.activeVersion?.ingredients?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-300">
                    <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Bahan Baku (Inventaris)</th>
                        <th className="py-3 px-4 font-semibold">Takaran per Porsi</th>
                        <th className="py-3 px-4 font-semibold">Biaya Rata-rata (WAC)</th>
                        <th className="py-3 px-4 font-semibold text-right">Subtotal HPP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60 font-mono">
                      {activeRecipe.activeVersion.ingredients.map((ing) => (
                        <tr key={ing.id} className="hover:bg-stone-800/30 transition-colors">
                          <td className="py-3 px-4 font-sans font-semibold text-amber-50">
                            {ing.inventoryItemName}
                          </td>
                          <td className="py-3 px-4 text-stone-200">
                            {ing.quantity} {ing.baseUnitCode}
                          </td>
                          <td className="py-3 px-4 text-stone-400">
                            {formatRupiah(ing.averageCost)} / {ing.baseUnitCode}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-300">
                            {formatRupiah(ing.subtotalHpp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-stone-800 bg-stone-950/60">
                      <tr>
                        <td colSpan="3" className="py-3 px-4 font-bold text-amber-100 text-right uppercase text-[11px]">
                          Total Estimasi HPP per Porsi:
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-300 text-sm">
                          {formatRupiah(activeRecipe.activeVersion.estimatedHpp)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Menu ini belum memiliki komposisi resep. Klik tombol "Susun Resep Baru" di atas.
                </div>
              )}
            </div>
          ) : (
            /* ─── RECIPE BUILDER / EDITOR ────────────────────────────────────── */
            <form onSubmit={handleSaveRecipe} className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-800">
                <div>
                  <h2 className="text-base font-bold text-amber-50">
                    Formulasi Versi Resep Baru: {recipeTargetVariant ? `${product.name} (${recipeTargetVariant.name})` : product.name}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Menyimpan resep ini akan membuat Versi baru yang aktif tanpa menghapus riwayat versi sebelumnya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingRecipe(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-xs font-semibold"
                >
                  Batal
                </button>
              </div>

              {/* Dynamic Ingredients Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                    Daftar Komposisi Bahan Baku *
                  </label>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="px-3 py-1 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-xs font-semibold flex items-center gap-1"
                  >
                    + Tambah Baris Bahan
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeIngredients.map((ing, idx) => {
                    const selectedItem = inventoryItems.find((i) => i.id === ing.inventoryItemId);
                    const avg = selectedItem?.balance ? Number(selectedItem.balance.averageCost) : 0;
                    const subtotal = (parseFloat(ing.quantity) || 0) * avg;

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800 flex flex-col sm:flex-row items-center gap-3"
                      >
                        {/* Select Inventory Item */}
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-[10px] text-stone-500 font-semibold mb-1">
                            Bahan Baku
                          </label>
                          <select
                            value={ing.inventoryItemId}
                            onChange={(e) => updateIngredientField(idx, 'inventoryItemId', e.target.value)}
                            disabled={isPending}
                            className="w-full px-3 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            required
                          >
                            {inventoryItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({it.category?.name || 'Inventaris'}) — Unit: {it.baseUnit?.code}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Input */}
                        <div className="w-full sm:w-44">
                          <label className="block text-[10px] text-stone-500 font-semibold mb-1">
                            Takaran ({selectedItem?.baseUnit?.code || 'Unit'})
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0.000001"
                              value={ing.quantity}
                              onChange={(e) => updateIngredientField(idx, 'quantity', e.target.value)}
                              disabled={isPending}
                              className="w-full pl-3 pr-10 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                              required
                            />
                            <span className="absolute right-3 top-2 text-[11px] text-stone-400 font-mono">
                              {selectedItem?.baseUnit?.code}
                            </span>
                          </div>
                        </div>

                        {/* Subtotal Cost Preview */}
                        <div className="w-full sm:w-36 text-right font-mono">
                          <label className="block text-[10px] text-stone-500 font-semibold mb-1 text-right">
                            Subtotal Biaya
                          </label>
                          <p className="text-xs font-bold text-amber-300 py-2">
                            {formatRupiah(subtotal)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <div className="pt-4 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => removeIngredientRow(idx)}
                            className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
                            title="Hapus baris"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Calculations Footer */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                <div>
                  <p className="text-xs text-amber-200">
                    Estimasi HPP Resep Baru: <strong className="text-amber-300 font-extrabold text-sm">{formatRupiah(liveEstimatedHpp)}</strong>
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Harga Jual: {formatRupiah(targetPrice)} &bull; Margin Keuntungan:{' '}
                    <span className="text-emerald-400 font-bold">{marginPercentage}%</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingRecipe(false)}
                    className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
                  >
                    {isPending ? 'Menyimpan Resep...' : 'Simpan & Terapkan Resep'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ─── TAB 2: DAFTAR VARIAN PRODUK ──────────────────────────────────────── */}
      {activeTab === 'VARIANTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-amber-50">Varian Produk ({product.name})</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Tambahkan pilihan varian seperti Hot/Iced, Regular/Large, atau ukuran porsi lain.
              </p>
            </div>

            <button
              onClick={openCreateVariantModal}
              className="px-4 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all flex items-center justify-center gap-1.5"
            >
              + Tambah Varian Baru
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.variants?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-stone-500 text-xs rounded-2xl bg-stone-900/40 border border-stone-800">
                Belum ada varian untuk produk ini. Menu akan dijual dengan harga dan formulasi default produk induk.
              </div>
            ) : (
              product.variants.map((v) => (
                <div
                  key={v.id}
                  className="p-5 rounded-3xl bg-stone-900/70 border border-stone-800 flex flex-col justify-between gap-4 shadow-xl"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-amber-50">{v.name}</h3>
                        {v.sku && (
                          <p className="text-[11px] font-mono text-stone-500">SKU: {v.sku}</p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-full font-mono font-extrabold text-amber-300 text-xs bg-stone-800 border border-stone-700">
                        {formatRupiah(v.price)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                          v.availability === 'AVAILABLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        )}
                      >
                        {v.availability === 'AVAILABLE' ? 'Tersedia' : 'Habis'}
                      </span>
                      {v.discontinued && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-400 border border-stone-700">
                          Discontinued
                        </span>
                      )}
                    </div>

                    {/* Direct stock linkage or Recipe info */}
                    {product.type === 'DIRECT_STOCK' && (
                      <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 text-[11px] text-stone-400">
                        Link Inventaris:{' '}
                        <span className="font-semibold text-amber-200">
                          {v.inventoryItem ? v.inventoryItem.name : 'Belum dihubungkan'}
                        </span>{' '}
                        ({v.inventoryItem?.currentQuantity || 0} {v.inventoryItem?.baseUnitCode})
                      </div>
                    )}

                    {product.type === 'RECIPE' && (
                      <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] flex items-center justify-between">
                        <span className="text-stone-400">
                          Resep Varian:{' '}
                          {v.recipe?.activeVersion ? (
                            <span className="text-amber-200 font-semibold font-mono">
                              Versi {v.recipe.activeVersion.versionNumber} ({formatRupiah(v.recipe.activeVersion.estimatedHpp)})
                            </span>
                          ) : (
                            <span className="text-stone-500 italic">Ikut resep induk</span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            setActiveTab('RECIPE');
                            openRecipeEditor(v);
                          }}
                          className="text-amber-400 hover:text-amber-300 font-semibold underline text-[10px]"
                        >
                          Atur Resep Khusus &rarr;
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800/80">
                    <button
                      onClick={() => openEditVariantModal(v)}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-xs font-semibold transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVariant(v)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/30 text-xs font-semibold transition-all"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: EDIT INFO MENU INDUK ──────────────────────────────────────── */}
      {activeTab === 'EDIT_INFO' && (
        <div className="bg-stone-900/70 border border-stone-800 rounded-3xl p-6 shadow-xl max-w-xl">
          <h2 className="text-sm font-bold text-amber-50 mb-4">Edit Informasi Menu Produk</h2>
          <form onSubmit={handleSaveProductInfo} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Nama Menu Produk *
              </label>
              <input
                type="text"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                disabled={isPending}
                className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  SKU (Kode Menu)
                </label>
                <input
                  type="text"
                  value={prodForm.sku}
                  onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Kategori Menu *
                </label>
                <select
                  value={prodForm.categoryId}
                  onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Harga Jual Pokok (Rp) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={prodForm.price}
                onChange={(e) => setProdForm({ ...prodForm, price: parseFloat(e.target.value) || 0 })}
                disabled={isPending}
                className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            {product.type === 'DIRECT_STOCK' && (
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Bahan Baku Inventaris (Pemotong Stok Langsung) *
                </label>
                <select
                  value={prodForm.inventoryItemId}
                  onChange={(e) => setProdForm({ ...prodForm, inventoryItemId: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">Pilih Barang Inventaris</option>
                  {inventoryItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.category?.name || 'Inventaris'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Ketersediaan Kasir
                </label>
                <select
                  value={prodForm.availability}
                  onChange={(e) => setProdForm({ ...prodForm, availability: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="AVAILABLE">Tersedia (Available)</option>
                  <option value="OUT_OF_STOCK">Habis (Out of Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Status Menu
                </label>
                <select
                  value={prodForm.discontinued ? 'true' : 'false'}
                  onChange={(e) => setProdForm({ ...prodForm, discontinued: e.target.value === 'true' })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="false">Aktif Dijual</option>
                  <option value="true">Dihentikan (Discontinued)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-800 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
              >
                {isPending ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL FORM VARIAN ─────────────────────────────────────────────────── */}
      {variantModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h2 className="text-base font-bold text-amber-50">
                {editingVariant ? `Edit Varian: ${editingVariant.name}` : 'Tambah Varian Baru'}
              </h2>
              <button
                onClick={() => setVariantModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Nama Varian *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Iced / Hot / Large / 500ml"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  disabled={isPending}
                  className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Harga Jual Varian (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={variantForm.price}
                    onChange={(e) => setVariantForm({ ...variantForm, price: parseFloat(e.target.value) || 0 })}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    SKU Varian
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional"
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {product.type === 'DIRECT_STOCK' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Link Bahan Baku Inventaris *
                  </label>
                  <select
                    value={variantForm.inventoryItemId}
                    onChange={(e) => setVariantForm({ ...variantForm, inventoryItemId: e.target.value })}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Pilih Bahan Baku</option>
                    {inventoryItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.category?.name || 'Inventaris'}) &bull; Stok: {it.balance?.quantity || 0} {it.baseUnit?.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Ketersediaan
                  </label>
                  <select
                    value={variantForm.availability}
                    onChange={(e) => setVariantForm({ ...variantForm, availability: e.target.value })}
                    disabled={isPending}
                    className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="AVAILABLE">Tersedia</option>
                    <option value="OUT_OF_STOCK">Habis</option>
                  </select>
                </div>

                {editingVariant && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <select
                      value={variantForm.discontinued ? 'true' : 'false'}
                      onChange={(e) => setVariantForm({ ...variantForm, discontinued: e.target.value === 'true' })}
                      disabled={isPending}
                      className="w-full px-3.5 py-2 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="false">Aktif</option>
                      <option value="true">Discontinued</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setVariantModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-linear-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Varian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL RIWAYAT VERSI RESEP ────────────────────────────────────────── */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div>
                <h2 className="text-sm font-bold text-amber-50">
                  Riwayat Formulasi Resep (HPP Historis)
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Versi resep yang pernah aktif untuk audit dan laporan HPP pesanan lampau.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {recipeHistory.length === 0 ? (
                <div className="py-8 text-center text-stone-500 text-xs">
                  Belum ada riwayat versi resep tercatat.
                </div>
              ) : (
                recipeHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all space-y-3',
                      ver.isActive
                        ? 'bg-amber-950/20 border-amber-800/50'
                        : 'bg-stone-950/60 border-stone-800/80'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-amber-200">
                          Versi {ver.versionNumber}
                        </span>
                        {ver.isActive ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            Aktif Saat Ini
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-500 text-[10px]">
                            Arsip
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {new Date(ver.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-xs">
                      {ver.ingredients?.map((ing) => (
                        <div key={ing.id} className="flex items-center justify-between text-stone-300">
                          <span className="font-sans text-[11px]">{ing.name}</span>
                          <span>
                            {ing.quantity} {ing.unitCode} ({formatRupiah(ing.quantity * ing.averageCost)})
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-stone-800/60 flex justify-between text-xs font-mono">
                      <span className="text-stone-400 font-sans">Total HPP Versi Ini:</span>
                      <span className="font-bold text-amber-300">{formatRupiah(ver.estimatedHpp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
