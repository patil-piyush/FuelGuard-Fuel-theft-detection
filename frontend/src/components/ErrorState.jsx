import { AlertTriangle, RotateCw } from 'lucide-react'

export default function ErrorState({
  title = 'Unable to load data.',
  detail,
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle size={20} className="text-signal-red" />
      <div>
        <p className="text-sm text-text">{title}</p>
        {detail && <p className="mt-1 text-xs text-text-faint">{detail}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded border border-hairline px-3 py-1.5 text-xs text-text-dim transition-colors hover:border-amber/40 hover:text-amber"
        >
          <RotateCw size={12} />
          Retry
        </button>
      )}
    </div>
  )
}
