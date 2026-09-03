'use client';

import React from 'react';
import { formatThousand, parseThousand, cn } from '@/lib/utils';

/**
 * FormattedInput — input teks dengan auto-format pemisah ribuan Indonesia (titik).
 * Cocok untuk input integer: kuantitas bulat, batas stok, kuota, dll.
 *
 * - Menampilkan nilai terformat (contoh: "1.500" untuk angka 1500).
 * - Memanggil `onChange(rawNumber)` dengan angka murni (bukan string berformat).
 * - JANGAN gunakan untuk input desimal (resep, kuantitas pecahan, persentase).
 */
export default function FormattedInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
  required = false,
  id,
  name,
  ...props
}) {
  const displayValue =
    value === '' || value === undefined || value === null
      ? ''
      : formatThousand(value);

  const handleChange = (e) => {
    const rawVal = e.target.value;
    // Hilangkan semua karakter non-digit
    const numericVal = parseThousand(rawVal);
    if (onChange) {
      onChange(rawVal === '' ? '' : numericVal);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      name={name}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={cn(
        'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
}
