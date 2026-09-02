'use client';

import { useState, useEffect, useTransition } from 'react';
import toast from 'react-hot-toast';
import { getStoreSettings, updateStoreSettings } from '@/app/actions/settings';
import { cn } from '@/lib/utils';

// ── Sub-komponen: Toggle Switch ───────────────────────────────────────────────
function Toggle({ id, checked, onChange, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50 focus:ring-offset-2 focus:ring-offset-stone-900',
        checked ? 'bg-amber-600' : 'bg-stone-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 absolute top-0.5 left-0.5',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ── Sub-komponen: Rate Input ──────────────────────────────────────────────────
function RateInput({ id, label, value, onChange, disabled, suffix = '%', min = 0, max = 100, step = 0.01 }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="w-full pr-10 pl-4 py-2.5 bg-stone-800/60 border border-stone-700/60 rounded-xl text-amber-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-medium">
          {suffix}
        </span>
      </div>
    </div>
  );
}

// ── Sub-komponen: Section Card ────────────────────────────────────────────────
function SettingsCard({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-stone-800/60 bg-stone-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-800/60">
        <h2 className="text-sm font-semibold text-amber-50">{title}</h2>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [storeName, setStoreName] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxBaseIncludesServiceCharge, setTaxBaseIncludesServiceCharge] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [cashRoundingEnabled, setCashRoundingEnabled] = useState(false);
  const [cashRoundingUnit, setCashRoundingUnit] = useState(0);

  // Load initial settings
  useEffect(() => {
    async function load() {
      const result = await getStoreSettings();
      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }
      const { settings, storeName: name } = result.data;
      setStoreName(name);
      if (settings) {
        setTaxEnabled(settings.taxEnabled);
        setTaxRate(parseFloat(settings.taxRate) || 0);
        setTaxBaseIncludesServiceCharge(settings.taxBaseIncludesServiceCharge);
        setServiceChargeEnabled(settings.serviceChargeEnabled);
        setServiceChargeRate(parseFloat(settings.serviceChargeRate) || 0);
        setCashRoundingEnabled(settings.cashRoundingEnabled);
        setCashRoundingUnit(parseFloat(settings.cashRoundingUnit) || 0);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  function handleSave() {
    startTransition(async () => {
      const toastId = toast.loading('Menyimpan pengaturan...');
      const result = await updateStoreSettings({
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
      });

      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        toast.success('Pengaturan berhasil disimpan!', { id: toastId });
      }
    });
  }

  const isSaving = isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-6 h-6 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-stone-500">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-amber-50">Pengaturan Toko</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Konfigurasi pajak, service charge, dan pembulatan untuk{' '}
          <span className="text-amber-500 font-medium">{storeName}</span>
        </p>
      </div>

      {/* Tax Settings */}
      <SettingsCard
        title="Pajak (PPN)"
        description="Konfigurasi penerapan Pajak Pertambahan Nilai pada transaksi."
      >
        {/* Tax enabled toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-200">Aktifkan Pajak</p>
            <p className="text-xs text-stone-500 mt-0.5">Pajak akan dihitung pada setiap transaksi</p>
          </div>
          <Toggle
            id="toggle-tax-enabled"
            checked={taxEnabled}
            onChange={setTaxEnabled}
            disabled={isSaving}
          />
        </div>

        {/* Tax rate */}
        {taxEnabled && (
          <>
            <RateInput
              id="input-tax-rate"
              label="Tarif Pajak"
              value={taxRate}
              onChange={setTaxRate}
              disabled={isSaving}
            />

            {/* Tax base includes service charge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-200">Pajak termasuk Service Charge</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Jika aktif, basis pajak = subtotal + service charge
                </p>
              </div>
              <Toggle
                id="toggle-tax-base-includes-sc"
                checked={taxBaseIncludesServiceCharge}
                onChange={setTaxBaseIncludesServiceCharge}
                disabled={isSaving}
              />
            </div>
          </>
        )}
      </SettingsCard>

      {/* Service Charge Settings */}
      <SettingsCard
        title="Service Charge"
        description="Biaya layanan yang ditambahkan pada setiap transaksi."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-200">Aktifkan Service Charge</p>
            <p className="text-xs text-stone-500 mt-0.5">Biaya layanan akan ditambahkan ke total transaksi</p>
          </div>
          <Toggle
            id="toggle-sc-enabled"
            checked={serviceChargeEnabled}
            onChange={setServiceChargeEnabled}
            disabled={isSaving}
          />
        </div>

        {serviceChargeEnabled && (
          <RateInput
            id="input-sc-rate"
            label="Tarif Service Charge"
            value={serviceChargeRate}
            onChange={setServiceChargeRate}
            disabled={isSaving}
          />
        )}
      </SettingsCard>

      {/* Cash Rounding Settings */}
      <SettingsCard
        title="Pembulatan Tunai"
        description="Pembulatan nilai bayar tunai ke kelipatan tertentu."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-200">Aktifkan Pembulatan</p>
            <p className="text-xs text-stone-500 mt-0.5">Total tunai dibulatkan ke kelipatan yang ditentukan</p>
          </div>
          <Toggle
            id="toggle-rounding-enabled"
            checked={cashRoundingEnabled}
            onChange={setCashRoundingEnabled}
            disabled={isSaving}
          />
        </div>

        {cashRoundingEnabled && (
          <RateInput
            id="input-rounding-unit"
            label="Unit Pembulatan (Rp)"
            value={cashRoundingUnit}
            onChange={setCashRoundingUnit}
            disabled={isSaving}
            suffix="Rp"
            min={0}
            max={10000}
            step={500}
          />
        )}
      </SettingsCard>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          id="btn-save-settings"
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm
            bg-linear-to-r from-amber-700 to-amber-600
            hover:from-amber-600 hover:to-amber-500
            text-white shadow-lg shadow-amber-900/30
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]
            focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-stone-950"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Menyimpan...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Simpan Pengaturan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
