import { Loader2 } from 'lucide-react'

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-text-dim">
      <Loader2 size={16} className="animate-spin text-amber" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
