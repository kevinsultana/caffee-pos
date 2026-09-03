'use client';

import React, { useId } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

/**
 * SearchableSelect — Wrapper komponen react-select yang disesuaikan dengan
 * Design System Schaw Cafe (Tailwind Slate/Emerald).
 *
 * Mendukung mode Creatable (pembuatan opsi baru on-the-fly) serta pencarian real-time.
 * Mengembalikan nilai primitif `value` (bukan objek { value, label }) pada onChange,
 * sehingga kompatibel 100% dengan state form standar.
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Pilih...',
  disabled = false,
  isDisabled = false,
  isClearable = false,
  isSearchable = true,
  isCreatable = false,
  onCreateOption,
  formatCreateLabel,
  className = '',
  id,
  name,
  noOptionsMessage = () => 'Tidak ada pilihan',
  ...props
}) {
  const instanceId = useId();
  const activeDisabled = disabled || isDisabled;

  // Cari opsi yang sesuai dengan nilai primitif `value`
  const selectedOption =
    value !== undefined && value !== null && value !== ''
      ? options.find((opt) => String(opt.value) === String(value)) || null
      : null;

  const handleChange = (selected) => {
    if (onChange) {
      onChange(selected ? selected.value : null);
    }
  };

  const Component = isCreatable ? CreatableSelect : Select;

  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: activeDisabled ? '#f8fafc' : '#ffffff',
      borderColor: state.isFocused ? '#10b981' : '#cbd5e1',
      borderRadius: '0.75rem', // rounded-xl (12px)
      minHeight: '38px',
      height: '38px',
      fontSize: '0.75rem', // text-xs (12px)
      boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.25)' : 'none',
      cursor: activeDisabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease-in-out',
      '&:hover': {
        borderColor: state.isFocused ? '#10b981' : '#94a3b8',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 10px',
      height: '36px',
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: '#0f172a',
      fontSize: '0.75rem',
    }),
    placeholder: (base) => ({
      ...base,
      color: '#94a3b8',
      fontSize: '0.75rem',
    }),
    singleValue: (base) => ({
      ...base,
      color: '#0f172a',
      fontSize: '0.75rem',
      fontWeight: 500,
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: '#ffffff',
      borderRadius: '0.75rem',
      overflow: 'hidden',
      boxShadow:
        '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0',
      zIndex: 99999,
      marginTop: '4px',
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '220px',
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 99999,
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.75rem',
      borderRadius: '0.5rem',
      margin: '2px 0',
      padding: '7px 10px',
      cursor: 'pointer',
      backgroundColor: state.isSelected
        ? '#059669' // emerald-600
        : state.isFocused
        ? '#ecfdf5' // emerald-50
        : '#ffffff',
      color: state.isSelected
        ? '#ffffff'
        : state.isFocused
        ? '#065f46' // emerald-800
        : '#1e293b', // slate-800
      fontWeight: state.isSelected ? 600 : 400,
      '&:active': {
        backgroundColor: '#059669',
        color: '#ffffff',
      },
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? '#10b981' : '#94a3b8',
      padding: '4px 8px',
      '&:hover': {
        color: '#10b981',
      },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: '#94a3b8',
      padding: '4px 6px',
      cursor: 'pointer',
      '&:hover': {
        color: '#ef4444',
      },
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
  };

  return (
    <div className={`relative ${className}`}>
      <Component
        instanceId={id || instanceId}
        id={id}
        name={name}
        options={options}
        value={selectedOption}
        onChange={handleChange}
        onCreateOption={onCreateOption}
        formatCreateLabel={formatCreateLabel}
        placeholder={placeholder}
        isDisabled={activeDisabled}
        isClearable={isClearable}
        isSearchable={isSearchable}
        styles={customStyles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        noOptionsMessage={noOptionsMessage}
        {...props}
      />
    </div>
  );
}
