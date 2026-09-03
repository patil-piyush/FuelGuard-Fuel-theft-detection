import { NavLink } from 'react-router-dom'
import {
  Gauge,
  Truck,
  Radio,
  LineChart,
  Bell,
  Map as MapIcon,
  Settings,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/live', label: 'Live monitoring', icon: Radio },
  { to: '/analytics', label: 'Fuel analytics', icon: LineChart },
  { to: '/events', label: 'Alerts & events', icon: Bell },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();


  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-hairline bg-panel transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="15" fill="#0A0F1A" stroke="#F2A93B" strokeWidth="1.5" />
              <path d="M8 20 A10 10 0 0 1 24 20" fill="none" stroke="#232E45" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8 20 A10 10 0 0 1 18 10.6" fill="none" stroke="#F2A93B" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="16" y1="20" x2="20" y2="13" stroke="#E5E9F0" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="16" cy="20" r="1.6" fill="#E5E9F0" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-text">FuelGuard</span>
          </div>
          <button onClick={onClose} className="text-text-dim lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
          if (to === '/settings' && role !== 'ADMIN') return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-panel-raised text-amber'
                    : 'text-text-dim hover:bg-panel-raised/60 hover:text-text'
                }`
              }
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </NavLink>
          );
        })}
      </nav>

        <div className="border-t border-hairline p-3">
          <div className="flex items-center gap-2.5 rounded px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-raised text-xs font-semibold text-amber">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text">{user?.email || 'User'}</p>
              <p className="truncate text-[11px] text-text-faint">{role || 'Loading...'}</p>
            </div>
           <button
             onClick={() => {
               logout();
               navigate('/login');
             }}
             className="mt-2 w-full rounded bg-amber px-3 py-1.5 text-sm font-medium text-black hover:bg-amber/80"
           >
             Logout
           </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-2 text-[11px] text-text-faint">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured ? 'bg-signal-green' : 'bg-text-faint'}`}
            />
            {isSupabaseConfigured ? 'Database connected' : 'Database not configured'}
          </div>
        </div>
      </aside>
    </>
  )
}
