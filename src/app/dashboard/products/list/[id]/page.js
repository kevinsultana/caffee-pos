'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import {
  getProductWithDetails,
  updateProduct,
  uploadProductImage,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  saveRecipe,
  getRecipeHistory,
  getProductCategories,
} from '@/app/actions/product';
import { getInventoryItems } from '@/app/actions/inventory';
import { formatRupiah, formatDateTime, cn } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SearchableSelect from '@/components/ui/SearchableSelect';

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
    imageUrl: null,
    price: 0,
    categoryId: '',
    availability: 'AVAILABLE',
    discontinued: false,
    inventoryItemId: '',
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

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
      imageUrl: p.imageUrl || null,
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

  // ─── RECIPE HANDLERS ─────────────────────────────────────────────────────
  const openRecipeEditor = (variant = null) => {
    setRecipeTargetVariant(variant);
    const targetRecipe = variant ? variant.recipe : product.recipe;

    if (targetRecipe && targetRecipe.activeVersion?.ingredients?.length > 0) {
      setRecipeIngredients(
        targetRecipe.activeVersion.ingredients.map((ing) => ({
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
    setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== index));
  };

  const updateIngredientField = (index, field, value) => {
    const updated = [...recipeIngredients];
    updated[index][field] = value;
    setRecipeIngredients(updated);
  };

  const handleSaveRecipe = (e) => {
    e.preventDefault();

    for (let i = 0; i < recipeIngredients.length; i++) {
      const ing = recipeIngredients[i];
      if (!ing.inventoryItemId || isNaN(parseFloat(ing.quantity)) || parseFloat(ing.quantity) <= 0) {
        toast.error(`Baris ke-${i + 1}: Kuantitas bahan harus berupa angka positif lebih dari 0.`);
        return;
      }
    }

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan versi resep baru...');
      const res = await saveRecipe({
        productId: product.id,
        variantId: recipeTargetVariant?.id || null,
        ingredients: recipeIngredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          quantity: parseFloat(ing.quantity),
        })),
      });

      if (res?.error) {
        toast.error(res.error, { id: toastId });
        return;
      }

      toast.success(
        `Resep berhasil disimpan (Versi ${res.data.activeVersion.versionNumber})!`,
        { id: toastId }
      );
      setIsEditingRecipe(false);
      loadData();
    });
  };

  const viewRecipeHistory = async (variant = null) => {
    const toastId = toast.loading('Memuat riwayat formulasi resep...');
    const res = await getRecipeHistory({
      productId: product.id,
      variantId: variant?.id || null,
    });

    if (res?.error) {
      toast.error(res.error, { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    setRecipeHistory(res.data || []);
    setShowHistoryModal(true);
  };

  // ─── VARIANT HANDLERS ────────────────────────────────────────────────────
  const openCreateVariantModal = () => {
    setEditingVariant(null);
    setVariantForm({
      name: '',
      sku: '',
      price: product.price,
      availability: 'AVAILABLE',
      discontinued: false,
      inventoryItemId: '',
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

    if (!variantForm.name.trim()) {
      toast.error('Nama varian wajib diisi.');
      return;
    }

    if (product.type === 'DIRECT_STOCK' && !variantForm.inventoryItemId) {
      toast.error('Produk DIRECT_STOCK wajib memilih barang inventaris untuk varian.');
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan varian...');

      if (editingVariant) {
        const res = await updateProductVariant(editingVariant.id, {
          name: variantForm.name.trim(),
          sku: variantForm.sku.trim() || null,
          price: Number(variantForm.price),
          availability: variantForm.availability,
          discontinued: variantForm.discontinued,
          inventoryItemId: product.type === 'DIRECT_STOCK' ? variantForm.inventoryItemId : null,
        });
        if (res?.error) {
          toast.error(res.error, { id: toastId });
          return;
        }
        toast.success(`Varian "${res.data.name}" berhasil diperbarui!`, { id: toastId });
      } else {
        const res = await createProductVariant({
          productId: product.id,
          name: variantForm.name.trim(),
          sku: variantForm.sku.trim() || null,
          price: Number(variantForm.price),
          availability: variantForm.availability,
          inventoryItemId: product.type === 'DIRECT_STOCK' ? variantForm.inventoryItemId : null,
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
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      background: '#ffffff',
      color: '#0f172a',
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

  // ─── IMAGE UPLOAD HANDLERS ──────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file harus berupa PNG, JPG, WEBP, atau SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading('Mengunggah foto produk...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadProductImage(formData);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success('Foto produk berhasil diunggah!', { id: toastId });
        setProdForm((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah foto produk.', { id: toastId });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setProdForm((prev) => ({ ...prev, imageUrl: null }));
  };

  // ─── PRODUCT INFO HANDLER ────────────────────────────────────────────────
  const handleSaveProductInfo = (e) => {
    e.preventDefault();

    startTransition(async () => {
      const toastId = toast.loading('Menyimpan informasi produk...');
      const res = await updateProduct(product.id, {
        name: prodForm.name,
        sku: prodForm.sku,
        imageUrl: prodForm.imageUrl,
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
      <div className="p-12 text-center text-slate-400 text-xs">
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
    <div className="space-y-6 max-w-7xl">
      <Toaster position="top-right" />

      {/* Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/products/list" className="hover:text-emerald-700 font-semibold transition-colors">
              &larr; Daftar Menu Produk
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">{product.categoryName}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            )}
          >
            Tipe: {product.type === 'RECIPE' ? 'Resep Komposisi' : 'Stok Langsung'}
          </span>
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border',
              product.availability === 'AVAILABLE'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-rose-100 text-rose-800 border-rose-200'
            )}
          >
            {product.availability === 'AVAILABLE' ? 'Tersedia' : 'Habis'}
          </span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga Jual Pokok</p>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatRupiah(product.price)}
          </p>
        </div>

        {product.type === 'RECIPE' ? (
          <>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimasi HPP (WAC)</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {formatRupiah(product.recipe?.activeVersion?.estimatedHpp || 0)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 shadow-xs">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Margin Keuntungan</p>
              <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
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
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bahan Baku Terhubung</p>
            <p className="text-sm font-bold text-slate-900 mt-1 truncate">
              {product.inventoryItem ? product.inventoryItem.name : 'Belum dihubungkan'}
            </p>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Varian</p>
          <p className="text-xl font-bold font-mono text-slate-900 mt-1">
            {product.variants?.length || 0} Varian
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        {product.type === 'RECIPE' && (
          <button
            onClick={() => {
              setActiveTab('RECIPE');
              setIsEditingRecipe(false);
            }}
            className={cn(
              'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2',
              activeTab === 'RECIPE'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Resep Aktif: {activeRecipe ? activeRecipe.name : product.name}
                    </h2>
                    {activeRecipe?.activeVersion && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                        Versi {activeRecipe.activeVersion.versionNumber} (Aktif)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Bahan baku ini akan otomatis dipotong secara proporsional dari stok inventaris saat pesanan kasir dibayar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewRecipeHistory(null)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-all"
                  >
                    Riwayat Versi
                  </button>
                  <button
                    onClick={() => openRecipeEditor(null)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
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
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Bahan Baku (Inventaris)</th>
                        <th className="py-3 px-4 font-semibold">Takaran per Porsi</th>
                        <th className="py-3 px-4 font-semibold">Biaya Rata-rata (WAC)</th>
                        <th className="py-3 px-4 font-semibold text-right">Subtotal HPP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {activeRecipe.activeVersion.ingredients.map((ing) => (
                        <tr key={ing.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                            {ing.inventoryItemName}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {ing.quantity} {ing.baseUnitCode}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {formatRupiah(ing.averageCost)} / {ing.baseUnitCode}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {formatRupiah(ing.subtotalHpp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan="3" className="py-3 px-4 font-bold text-slate-900 text-right uppercase text-[11px]">
                          Total Estimasi HPP per Porsi:
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 text-sm">
                          {formatRupiah(activeRecipe.activeVersion.estimatedHpp)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Menu ini belum memiliki komposisi resep. Klik tombol &quot;Susun Resep Baru&quot; di atas.
                </div>
              )}
            </div>
          ) : (
            /* ─── RECIPE BUILDER / EDITOR ────────────────────────────────────── */
            <form onSubmit={handleSaveRecipe} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Formulasi Versi Resep Baru: {recipeTargetVariant ? `${product.name} (${recipeTargetVariant.name})` : product.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menyimpan resep ini akan membuat Versi baru yang aktif tanpa menghapus riwayat versi sebelumnya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingRecipe(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold"
                >
                  Batal
                </button>
              </div>

              {/* Dynamic Ingredients Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Komposisi Bahan Baku *
                  </label>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1"
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
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3"
                      >
                        {/* Select Inventory Item */}
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                            Bahan Baku
                          </label>
                          <SearchableSelect
                            options={inventoryItems.map((it) => ({
                              value: it.id,
                              label: `${it.name} (${it.category?.name || 'Inventaris'}) — Unit: ${it.baseUnit?.code || ''}`,
                            }))}
                            value={ing.inventoryItemId}
                            onChange={(val) => updateIngredientField(idx, 'inventoryItemId', val)}
                            disabled={isPending}
                            placeholder="Pilih Bahan Baku..."
                          />
                        </div>

                        {/* Quantity Input */}
                        <div className="w-full sm:w-44">
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
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
                              className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              required
                            />
                            <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">
                              {selectedItem?.baseUnit?.code}
                            </span>
                          </div>
                        </div>

                        {/* Subtotal Cost Preview */}
                        <div className="w-full sm:w-36 text-right font-mono">
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">
                            Subtotal Biaya
                          </label>
                          <p className="text-xs font-bold text-emerald-700 py-1.5">
                            {formatRupiah(subtotal)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <div className="pt-2 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => removeIngredientRow(idx)}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
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
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                <div>
                  <p className="text-xs text-emerald-900">
                    Estimasi HPP Resep Baru: <strong className="text-emerald-700 font-extrabold text-sm">{formatRupiah(liveEstimatedHpp)}</strong>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Harga Jual: {formatRupiah(targetPrice)} &bull; Margin Keuntungan:{' '}
                    <span className="text-emerald-700 font-bold">{marginPercentage}%</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingRecipe(false)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
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
              <h2 className="text-base font-bold text-slate-900">Varian Produk ({product.name})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tambahkan pilihan varian seperti Hot/Iced, Regular/Large, atau ukuran porsi lain.
              </p>
            </div>

            <button
              onClick={openCreateVariantModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              + Tambah Varian Baru
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.variants?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs rounded-2xl bg-white border border-slate-200">
                Belum ada varian untuk produk ini. Menu akan dijual dengan harga dan formulasi default produk induk.
              </div>
            ) : (
              product.variants.map((v) => (
                <div
                  key={v.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{v.name}</h3>
                        {v.sku && (
                          <p className="text-[11px] font-mono text-slate-400">SKU: {v.sku}</p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-full font-mono font-bold text-emerald-700 text-xs bg-emerald-50 border border-emerald-200">
                        {formatRupiah(v.price)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                          v.availability === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        )}
                      >
                        {v.availability === 'AVAILABLE' ? 'Tersedia' : 'Habis'}
                      </span>
                      {v.discontinued && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Discontinued
                        </span>
                      )}
                    </div>

                    {/* Direct stock linkage or Recipe info */}
                    {product.type === 'DIRECT_STOCK' && v.inventoryItem && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-0.5">
                        <p className="font-semibold text-slate-800">
                          Direct Stock: {v.inventoryItem.name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Stok: {v.inventoryItem.balance?.quantity || 0} {v.inventoryItem.baseUnit?.code}
                        </p>
                      </div>
                    )}

                    {product.type === 'RECIPE' && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
                        <span className="text-[11px]">
                          {v.recipe?.activeVersion
                            ? `Resep Khusus: Versi ${v.recipe.activeVersion.versionNumber} (HPP: ${formatRupiah(v.recipe.activeVersion.estimatedHpp)})`
                            : 'Menggunakan Resep Induk'}
                        </span>
                        <button
                          onClick={() => openRecipeEditor(v)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          {v.recipe?.activeVersion ? 'Edit Resep' : 'Buat Resep'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditVariantModal(v)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                    >
                      Edit Varian
                    </button>
                    <button
                      onClick={() => handleDeleteVariant(v)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
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

      {/* ─── TAB 3: EDIT INFORMASI PRODUK ──────────────────────────────────────── */}
      {activeTab === 'EDIT_INFO' && (
        <form onSubmit={handleSaveProductInfo} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Informasi Dasar Produk Menu</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ubah foto, nama, kategori, harga default, atau ketersediaan menu.
            </p>
          </div>

          {/* Foto Produk */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Foto Menu Produk
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                {prodForm.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prodForm.imageUrl} alt="Foto Produk" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleImageUpload}
                disabled={isPending || isUploadingImage}
                className="hidden"
              />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending || isUploadingImage}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    {prodForm.imageUrl ? 'Ganti Foto' : 'Pilih Foto'}
                  </button>
                  {prodForm.imageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isPending || isUploadingImage}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Format PNG, JPG, WEBP maks 5MB.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Nama Menu Produk *
              </label>
              <input
                type="text"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={prodForm.sku}
                onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Harga Jual Pokok (Rp) *
              </label>
              <CurrencyInput
                placeholder="25.000"
                value={prodForm.price}
                onChange={(val) => setProdForm({ ...prodForm, price: val })}
                disabled={isPending}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Kategori Menu *
              </label>
              <SearchableSelect
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={prodForm.categoryId}
                onChange={(val) => setProdForm({ ...prodForm, categoryId: val })}
                placeholder="Pilih Kategori Menu..."
              />
            </div>
          </div>

          {product.type === 'DIRECT_STOCK' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Barang Inventaris Terhubung (Direct Stock)
              </label>
              <SearchableSelect
                options={inventoryItems.map((it) => ({
                  value: it.id,
                  label: `${it.name} (Stok: ${it.balance?.quantity || 0} ${it.baseUnit?.code || ''})`,
                }))}
                value={prodForm.inventoryItemId}
                onChange={(val) => setProdForm({ ...prodForm, inventoryItemId: val })}
                isClearable={true}
                placeholder="-- Pilih Barang Inventaris --"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Ketersediaan Menu
              </label>
              <SearchableSelect
                options={[
                  { value: 'AVAILABLE', label: 'AVAILABLE (Tersedia)' },
                  { value: 'OUT_OF_STOCK', label: 'OUT_OF_STOCK (Habis)' },
                ]}
                value={prodForm.availability}
                onChange={(val) => setProdForm({ ...prodForm, availability: val || 'AVAILABLE' })}
              />
            </div>
            <div className="flex items-center gap-2.5 pt-6">
              <input
                id="chk-edit-discontinued"
                type="checkbox"
                checked={prodForm.discontinued}
                onChange={(e) => setProdForm({ ...prodForm, discontinued: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="chk-edit-discontinued" className="text-xs font-semibold text-slate-700">
                Menu Dihentikan (Discontinued)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      )}

      {/* ─── MODAL ADD/EDIT VARIANT ───────────────────────────────────────────── */}
      {variantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingVariant ? 'Edit Varian Produk' : 'Tambah Varian Baru'}
              </h3>
              <button
                onClick={() => setVariantModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Varian *
                </label>
                <input
                  type="text"
                  placeholder="contoh: Hot, Iced, Large, Double Shot"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Harga Jual (Rp) *
                  </label>
                  <CurrencyInput
                    placeholder="25.000"
                    value={variantForm.price}
                    onChange={(val) => setVariantForm({ ...variantForm, price: val })}
                    disabled={isPending}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    SKU Varian
                  </label>
                  <input
                    type="text"
                    placeholder="VAR-001"
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {product.type === 'DIRECT_STOCK' && (
                <div>
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                    Pilih Bahan Baku Inventaris *
                  </label>
                  <SearchableSelect
                    options={inventoryItems.map((it) => ({
                      value: it.id,
                      label: `${it.name} (Stok: ${it.balance?.quantity || 0} ${it.baseUnit?.code || ''})`,
                    }))}
                    value={variantForm.inventoryItemId}
                    onChange={(val) => setVariantForm({ ...variantForm, inventoryItemId: val })}
                    placeholder="-- Pilih Barang Inventaris --"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Ketersediaan
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'AVAILABLE', label: 'AVAILABLE (Tersedia)' },
                      { value: 'OUT_OF_STOCK', label: 'OUT_OF_STOCK (Habis)' },
                    ]}
                    value={variantForm.availability}
                    onChange={(val) => setVariantForm({ ...variantForm, availability: val || 'AVAILABLE' })}
                  />
                </div>
                {editingVariant && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      id="chk-var-discontinued"
                      type="checkbox"
                      checked={variantForm.discontinued}
                      onChange={(e) => setVariantForm({ ...variantForm, discontinued: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="chk-var-discontinued" className="text-xs font-semibold text-slate-700">
                      Discontinued
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVariantModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Varian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL RIWAYAT RESEP ──────────────────────────────────────────────── */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Riwayat Versi Resep ({product.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Seluruh versi resep di masa lampau disimpan secara abadi untuk menjaga keakuratan HPP pesanan historis.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {recipeHistory.map((ver) => (
                <div
                  key={ver.id}
                  className={cn(
                    'p-4 rounded-2xl border space-y-2.5',
                    ver.isActive
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        Versi {ver.versionNumber}
                      </span>
                      {ver.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Aktif Digunakan
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600">
                          Arsip Historis
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatDateTime(ver.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {ver.ingredients?.map((ing) => (
                      <div key={ing.id} className="p-2 rounded-xl bg-white border border-slate-200">
                        <p className="font-semibold text-slate-800 truncate">{ing.inventoryItemName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {ing.quantity} {ing.baseUnitCode} &bull; {formatRupiah(ing.averageCost)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-mono">
                    <span className="text-slate-600 font-sans">Estimasi HPP Versi Ini:</span>
                    <span className="font-bold text-emerald-700">{formatRupiah(ver.estimatedHpp)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
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
