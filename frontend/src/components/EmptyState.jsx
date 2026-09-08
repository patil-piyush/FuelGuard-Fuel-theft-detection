export default function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center">
      {Icon && <Icon size={20} className="text-text-faint" />}
      <p className="text-sm text-text-dim">{title}</p>
      {detail && <p className="max-w-xs text-xs text-text-faint">{detail}</p>}
    </div>
  )
}
