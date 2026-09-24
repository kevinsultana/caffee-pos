'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  listSupabaseStorageFiles,
  deleteSupabaseStorageFile,
  uploadSupabaseStorageFile,
} from '@/app/actions/storage';
import { compressImage } from '@/lib/imageCompression';
import { formatDateTime, cn } from '@/lib/utils';

export default function StorageImagePickerModal({
  isOpen,
  onClose,
  onSelectImage,
  currentSelectedUrl = null,
  title = 'Pilih Gambar dari Supabase Storage',
}) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('all'); // 'all' | 'store-assets' | 'product-images'
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadStorageFiles();
    }
  }, [isOpen, selectedBucket]);

  async function loadStorageFiles() {
    setLoading(true);
    try {
      const res = await listSupabaseStorageFiles(selectedBucket);
      if (res.error) {
        toast.error(res.error);
      } else {
        setFiles(res.files || []);
      }
    } catch (err) {
      console.error('[loadStorageFiles]', err);
      toast.error('Gagal mengambil daftar gambar storage.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Upload Gambar Baru langsung ke Supabase Storage (kompresi max 300KB)
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Mengompres dan mengunggah gambar ke storage...');

    try {
      const { file: compressedFile, compressedSize } = await compressImage(file, {
        maxSizeKB: 300,
        outputType: file.type === 'image/png' ? 'image/png' : 'image/webp',
      });

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('bucket', selectedBucket === 'product-images' ? 'product-images' : 'store-assets');

      const res = await uploadSupabaseStorageFile(formData);

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(
          `Gambar berhasil diunggah (${(compressedSize / 1024).toFixed(0)} KB)!`,
          { id: toastId }
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadStorageFiles();

        // Otomatis pilih gambar yang baru diupload
        if (res.file?.publicUrl && onSelectImage) {
          onSelectImage(res.file.publicUrl, res.file);
        }
      }
    } catch (err) {
      console.error('[handleFileUpload]', err);
      toast.error('Gagal mengunggah gambar: ' + (err.message || 'Error'), { id: toastId });
    } finally {
      setIsUploading(false);
    }
  }

  // Handle Hapus File dari Supabase Storage
  async function handleDeleteFile(fileItem, e) {
    e.stopPropagation(); // Jangan trigger pilih gambar saat klik hapus

    const Swal = (await import('sweetalert2')).default;

    const result = await Swal.fire({
      title: 'Hapus Gambar dari Storage?',
      html: `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>Anda yakin ingin menghapus file ini secara permanen dari Supabase Storage?</p>
          <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
            <p class="font-bold text-rose-900 break-all">${fileItem.name}</p>
            <p class="text-[11px] text-rose-700 mt-0.5">Bucket: <strong>${fileItem.bucket}</strong></p>
          </div>
          <p class="text-rose-600 font-semibold">
            ⚠️ File yang dihapus dari storage tidak dapat dipulihkan. Jika gambar ini sedang digunakan pada produk atau logo, tampilannya akan otomatis direset.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);
    const toastId = toast.loading('Menghapus gambar dari Supabase Storage...');

    try {
      const res = await deleteSupabaseStorageFile(fileItem.bucket, fileItem.name);

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(res.message || 'File berhasil dihapus dari storage.', { id: toastId });
        // Jika file yang dihapus sama dengan URL terpilih, kosongkan
        if (currentSelectedUrl && currentSelectedUrl.includes(fileItem.name)) {
          if (onSelectImage) onSelectImage(null, null);
        }
        setFiles((prev) => prev.filter((f) => f.name !== fileItem.name || f.bucket !== fileItem.bucket));
      }
    } catch (err) {
      console.error('[handleDeleteFile]', err);
      toast.error('Gagal menghapus file dari storage.', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }

  // Filter pencarian
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">

        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">
                Pilih gambar yang tersimpan atau hapus file yang tidak lagi digunakan di Supabase
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

        {/* Filter Bar & Quick Upload */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 bg-white">
          {/* Bucket Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setSelectedBucket('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                selectedBucket === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semua ({files.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedBucket('store-assets')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                selectedBucket === 'store-assets'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              store-assets (Logo/Aset)
            </button>
            <button
              type="button"
              onClick={() => setSelectedBucket('product-images')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                selectedBucket === 'product-images'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              product-images (Menu)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama file..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>

            {/* Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{isUploading ? 'Mengunggah...' : 'Upload Baru'}</span>
            </button>
          </div>
        </div>

        {/* Gallery Content */}
        <div className="flex-1 p-5 overflow-y-auto min-h-75">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Memuat galeri Supabase Storage...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl">
                🖼️
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Tidak ada gambar ditemukan</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {searchQuery
                    ? 'Tidak ada file yang cocok dengan kata kunci pencarian.'
                    : 'Belum ada gambar yang tersimpan di bucket ini. Anda dapat mengunggah gambar baru sekarang.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                + Upload Gambar Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFiles.map((fileItem) => {
                const isSelected =
                  Boolean(currentSelectedUrl) &&
                  (currentSelectedUrl === fileItem.publicUrl ||
                    currentSelectedUrl.includes(fileItem.name));
                const sizeKb = (fileItem.size / 1024).toFixed(1);

                return (
                  <div
                    key={`${fileItem.bucket}-${fileItem.name}`}
                    onClick={() => {
                      if (onSelectImage) {
                        onSelectImage(fileItem.publicUrl, fileItem);
                        onClose();
                      }
                    }}
                    className={cn(
                      'group relative rounded-2xl border-2 transition-all p-2.5 flex flex-col justify-between bg-white cursor-pointer select-none',
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    )}
                  >
                    {/* Top Image Preview */}
                    <div className="relative aspect-square w-full rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileItem.publicUrl}
                        alt={fileItem.name}
                        loading="lazy"
                        className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <span>✓</span> Dipakai
                        </div>
                      )}

                      {/* Delete Button (Hover / Touch) */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFile(fileItem, e)}
                        disabled={isDeleting}
                        title="Hapus file ini dari Supabase Storage secara permanen"
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow-xs opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate" title={fileItem.name}>
                        {fileItem.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono">{sizeKb} KB</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                          fileItem.bucket === 'store-assets'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        )}>
                          {fileItem.bucket}
                        </span>
                      </div>
                    </div>

                    {/* Quick Pick CTA */}
                    <button
                      type="button"
                      className="mt-2 w-full py-1 text-[11px] font-bold rounded-lg bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 transition-colors text-center"
                    >
                      {isSelected ? '✓ Sedang Dipakai' : 'Pilih Gambar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 text-xs">
          <p className="text-slate-500">
            Total <strong>{filteredFiles.length}</strong> gambar tersedia di Supabase Storage
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
