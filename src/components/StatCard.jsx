/**
 * Top-of-dashboard summary card. `value` of null/undefined renders as
 * "N/A" — callers should pass null rather than inventing a placeholder
 * number when the underlying data isn't available yet.
 */
export default function StatCard({ icon: Icon, label, value, unit, tone = 'default', hint }) {
  const toneClass =
    {
      default: 'text-text',
      amber: 'text-amber',
      green: 'text-signal-green',
      red: 'text-signal-red',
      blue: 'text-signal-blue',
    }[tone] ?? 'text-text'

  const displayValue = value === null || value === undefined || value === '' ? 'N/A' : value

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim">{label}</span>
        {Icon && <Icon size={14} className="text-text-faint" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`readout text-2xl font-semibold ${toneClass}`}>{displayValue}</span>
        {unit && displayValue !== 'N/A' && <span className="text-xs text-text-faint">{unit}</span>}
      </div>
      {hint && <span className="text-[11px] text-text-faint">{hint}</span>}
    </div>
  )
}
