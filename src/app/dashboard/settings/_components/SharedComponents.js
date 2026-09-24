'use client';

import { cn } from '@/lib/utils';

// ── Toggle Switch ─────────────────────────────────────────────────────────────
export function Toggle({ id, checked, onChange, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer',
        checked ? 'bg-emerald-600' : 'bg-slate-300',
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

// ── Rate Input ────────────────────────────────────────────────────────────────
export function RateInput({ id, label, value, onChange, disabled, suffix = '%', min = 0, max = 100, step = 0.01 }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
          className="w-full pr-10 pl-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono font-bold">
          {suffix}
        </span>
      </div>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
export function SettingsCard({ title, description, children, className = '' }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm', className)}>
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Align Selector ────────────────────────────────────────────────────────────
export function AlignSelector({ id, value, onChange, disabled }) {
  const options = [
    {
      id: 'LEFT',
      label: 'Kiri',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h16.5" />
        </svg>
      ),
    },
    {
      id: 'CENTER',
      label: 'Tengah',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5m-13.5 5.25h16.5" />
        </svg>
      ),
    },
    {
      id: 'RIGHT',
      label: 'Kanan',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5m-16.5 5.25h16.5" />
        </svg>
      ),
    },
  ];

  return (
    <div id={id} className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50',
            value === opt.id
              ? 'bg-white text-emerald-700 shadow-2xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
