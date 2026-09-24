'use client';

import { SettingsCard, Toggle, RateInput } from './SharedComponents';

export default function SystemPreferencesTab({
  taxEnabled, setTaxEnabled,
  taxRate, setTaxRate,
  taxBaseIncludesServiceCharge, setTaxBaseIncludesServiceCharge,
  serviceChargeEnabled, setServiceChargeEnabled,
  serviceChargeRate, setServiceChargeRate,
  cashRoundingEnabled, setCashRoundingEnabled,
  cashRoundingUnit, setCashRoundingUnit,
  maxActiveShifts, setMaxActiveShifts,
  isSaving,
}) {
  return (
    <div className="space-y-6">
      {/* ── Pajak Restoran (PB1 / PPN) ───────────────── */}
      <SettingsCard
        title="Pajak Restoran / PPN (PB1)"
        description="Aturan penghitungan pajak pertambahan nilai pada setiap pesanan kasir POS."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Pajak</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Pajak akan otomatis dihitung pada setiap checkout penjualan</p>
          </div>
          <Toggle id="toggle-tax-enabled" checked={taxEnabled} onChange={setTaxEnabled} disabled={isSaving} />
        </div>

        {taxEnabled && (
          <>
            <RateInput
              id="input-tax-rate"
              label="Tarif Pajak (%)"
              value={taxRate}
              onChange={setTaxRate}
              disabled={isSaving}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-900">Dasar Pengenaan Pajak Termasuk Service Charge</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Jika aktif: DPP Pajak = Subtotal + Service Charge (Cascading Tax)
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

      {/* ── Service Charge ────────────────────────────── */}
      <SettingsCard
        title="Service Charge"
        description="Biaya layanan tambahan untuk operasional dine-in atau take-away."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Service Charge</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Biaya layanan akan ditambahkan ke subtotal tagihan</p>
          </div>
          <Toggle id="toggle-sc-enabled" checked={serviceChargeEnabled} onChange={setServiceChargeEnabled} disabled={isSaving} />
        </div>

        {serviceChargeEnabled && (
          <RateInput
            id="input-sc-rate"
            label="Tarif Service Charge (%)"
            value={serviceChargeRate}
            onChange={setServiceChargeRate}
            disabled={isSaving}
          />
        )}
      </SettingsCard>

      {/* ── Cash Rounding ─────────────────────────────── */}
      <SettingsCard
        title="Pembulatan Kas Tunai (Cash Rounding)"
        description="Pembulatan nilai bayar tunai ke pecahan rupiah terdekat agar mempermudah uang kembalian kasir."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900">Aktifkan Pembulatan Kas</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Total tunai dibulatkan ke kelipatan pecahan yang ditentukan</p>
          </div>
          <Toggle id="toggle-rounding-enabled" checked={cashRoundingEnabled} onChange={setCashRoundingEnabled} disabled={isSaving} />
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

      {/* ── Limit Shift Kasir ─────────────────────────── */}
      <SettingsCard
        title="Operasional & Limit Shift Kasir"
        description="Atur batasan jumlah shift aktif yang boleh berjalan bersamaan di toko ini untuk mencegah double shift dan tumpang tindih kasir."
      >
        <div className="max-w-sm space-y-3">
          <div>
            <label htmlFor="input-max-active-shifts" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Maksimal Shift Aktif Bersamaan *
            </label>
            <div className="flex items-center gap-3">
              <input
                id="input-max-active-shifts"
                type="number"
                min="1"
                max="50"
                value={maxActiveShifts}
                onChange={(e) => setMaxActiveShifts(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={isSaving}
                className="w-28 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center"
                required
              />
              <span className="text-xs text-slate-600 font-semibold">Shift Aktif</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100 text-[11px] text-amber-800 space-y-0.5">
            <p className="font-semibold flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Aturan Shift
            </p>
            <p>Nilai minimum adalah 1. Untuk toko dengan lebih dari satu kasir aktif bersamaan, naikkan nilai ini sesuai kebutuhan operasional.</p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
