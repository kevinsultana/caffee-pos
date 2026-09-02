'use client';

import React from 'react';
import { formatThousand, parseThousand, cn } from '@/lib/utils';

/**
 * CurrencyInput component that automatically formats input with Indonesian thousand separators (dots).
 * Emits raw numeric value to onChange callback.
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0',
  prefix = 'Rp',
  className = '',
  containerClassName = '',
  disabled = false,
  required = false,
  id,
  name,
  autoFocus = false,
  ...props
}) {
  const displayValue = value === '' || value === undefined || value === null ? '' : formatThousand(value);

  const handleChange = (e) => {
    const rawVal = e.target.value;
    const numericVal = parseThousand(rawVal);
    if (onChange) {
      onChange(rawVal === '' ? '' : numericVal);
    }
  };

  return (
    <div className={cn('relative flex items-center', containerClassName)}>
      {prefix && (
        <span className="absolute left-3 text-slate-400 font-mono font-bold text-xs select-none pointer-events-none">
          {prefix}
        </span>
      )}
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
        autoFocus={autoFocus}
        className={cn(
          'w-full bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all',
          prefix ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
          disabled && 'bg-slate-100 text-slate-400 cursor-not-allowed',
          className
        )}
        {...props}
      />
    </div>
  );
}
