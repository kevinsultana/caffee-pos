/**
 * lib/imageCompression.js
 * Utilitas untuk mengompres file gambar di sisi browser (client-side)
 * sebelum dikirim ke server / Supabase Storage.
 *
 * Batas maksimal ukuran: 300 KB.
 */

/**
 * Mengompres file gambar agar ukurannya tidak melebihi maxSizeKB (default: 300 KB)
 * @param {File} file - File gambar asli yang dipilih user
 * @param {Object} options - Pengaturan kompresi
 * @param {number} [options.maxSizeKB=300] - Batas ukuran maksimal file dalam KB (default 300)
 * @param {number} [options.maxWidth=1200] - Lebar maksimal dalam pixel
 * @param {number} [options.maxHeight=1200] - Tinggi maksimal dalam pixel
 * @param {string} [options.outputType='image/webp'] - Format output (default: image/webp)
 * @param {number} [options.initialQuality=0.85] - Kualitas awal (0.1 - 1.0)
 * @returns {Promise<{ file: File, originalSize: number, compressedSize: number, savingsPercent: number }>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxSizeKB = 300,
    maxWidth = 1200,
    maxHeight = 1200,
    outputType = 'image/webp',
    initialQuality = 0.85,
  } = options;

  const maxSizeBytes = maxSizeKB * 1024;

  // File SVG adalah vector, tidak perlu diolah via Canvas
  if (file.type === 'image/svg+xml') {
    if (file.size > maxSizeBytes) {
      throw new Error(`Ukuran file SVG (${(file.size / 1024).toFixed(1)}KB) melebihi batas ${maxSizeKB}KB.`);
    }
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar dari perangkat.'));
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Format gambar tidak valid atau korup.'));
      };

      img.onload = async () => {
        try {
          let { width, height } = img;

          // 1. Skala dimensi proporsional jika melebihi batas resolusi HD (1200px)
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas 2D context tidak tersedia pada browser ini.'));
          }

          // Latar putih jika format JPEG
          if (outputType === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          const toBlobPromise = (targetCanvas, q) =>
            new Promise((res) => targetCanvas.toBlob(res, outputType, q));

          // 2. Coba kompres dengan kualitas awal (default 85%)
          let quality = initialQuality;
          let blob = await toBlobPromise(canvas, quality);

          // 3. Jika ukuran masih melebihi 300KB, turunkan kualitas bertahap
          while (blob && blob.size > maxSizeBytes && quality > 0.25) {
            quality -= 0.1;
            blob = await toBlobPromise(canvas, quality);
          }

          // 4. Jika setelah menurunkan kualitas masih > 300KB, turunkan resolusi canvas
          let currentScale = 0.85;
          while (blob && blob.size > maxSizeBytes && currentScale > 0.3) {
            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = Math.max(300, Math.round(width * currentScale));
            scaledCanvas.height = Math.max(300, Math.round(height * currentScale));
            const scaledCtx = scaledCanvas.getContext('2d');

            if (outputType === 'image/jpeg') {
              scaledCtx.fillStyle = '#ffffff';
              scaledCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
            }

            scaledCtx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height);
            blob = await toBlobPromise(scaledCanvas, 0.7);
            currentScale -= 0.15;
          }

          if (!blob) {
            return reject(new Error('Gagal menghasilkan file kompresi gambar.'));
          }

          // 5. Bungkus kembali menjadi objek File dengan ekstensi .webp
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const extension = outputType === 'image/webp' ? '.webp' : '.jpg';
          const compressedFile = new File([blob], `${originalName}${extension}`, {
            type: outputType,
            lastModified: Date.now(),
          });

          const savingsPercent = file.size > compressedFile.size
            ? Math.round(((file.size - compressedFile.size) / file.size) * 100)
            : 0;

          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            savingsPercent,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
