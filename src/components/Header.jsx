import { Menu, Search, Bell } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Header({ title, subtitle, onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-ink/95 px-4 backdrop-blur">
      <button
        onClick={onMenuClick}
        className="text-text-dim lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-text">{title}</h1>
        {subtitle && <p className="truncate text-[11px] text-text-faint">{subtitle}</p>}
      </div>

      <div className="hidden items-center gap-2 rounded border border-hairline bg-panel px-2.5 py-1.5 md:flex">
        <Search size={14} className="text-text-faint" />
        <input
          type="text"
          placeholder="Search fleet…"
          className="w-40 bg-transparent text-xs text-text placeholder:text-text-faint focus:outline-none"
        />
      </div>

      <button className="relative text-text-dim hover:text-text" aria-label="Notifications">
        <Bell size={17} />
      </button>

      <div className="hidden items-center gap-1.5 rounded border border-hairline px-2.5 py-1.5 text-[11px] sm:flex">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isSupabaseConfigured ? 'bg-signal-green' : 'bg-text-faint'
          }`}
        />
        <span className="text-text-dim">{isSupabaseConfigured ? 'System online' : 'Not connected'}</span>
      </div>

      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-raised text-xs font-semibold text-amber">
        A
      </div>
    </header>
  )
}
