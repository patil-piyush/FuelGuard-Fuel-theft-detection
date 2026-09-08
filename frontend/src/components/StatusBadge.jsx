const STYLES = {
  online: { dot: 'bg-signal-green', text: 'text-signal-green', label: 'Online' },
  offline: { dot: 'bg-text-faint', text: 'text-text-faint', label: 'Offline' },
  warning: { dot: 'bg-amber', text: 'text-amber', label: 'Warning' },
  critical: { dot: 'bg-signal-red', text: 'text-signal-red', label: 'Critical' },
  normal: { dot: 'bg-signal-green', text: 'text-signal-green', label: 'Normal' },
  resolved: { dot: 'bg-text-faint', text: 'text-text-faint', label: 'Resolved' },
  unavailable: { dot: 'bg-text-faint', text: 'text-text-faint', label: 'Unavailable' },
}

/**
 * Small status indicator: a dot + label, in the status color.
 * status: 'online' | 'offline' | 'warning' | 'critical' | 'normal' | 'resolved' | 'unavailable'
 */
export default function StatusBadge({ status = 'unavailable', label, pulse = false }) {
  const style = STYLES[status] ?? STYLES.unavailable
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${style.dot}`} />
      </span>
      {label ?? style.label}
    </span>
  )
}
