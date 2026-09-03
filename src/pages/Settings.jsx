import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import { User, Bell, LayoutDashboard, Database } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-text-faint" />
        <h2 className="text-sm font-medium text-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Toggle({ label, defaultChecked = false }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <label className="flex items-center justify-between text-sm text-text-dim">
      {label}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked((c) => !c)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-amber' : 'bg-hairline'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

export default function Settings() {
  const { role } = useAuth()
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Section icon={User} title="Account">
        <div>
          <p className="text-xs text-text-faint">Name</p>
          <p className="text-sm text-text">{role === 'ADMIN' ? 'Admin' : 'Fleet Manager'}</p>
        </div>
        <div>
          <p className="text-xs text-text-faint">Role</p>
          <p className="text-sm text-text">{role === 'ADMIN' ? 'Administrator — full fleet access' : 'Fleet Manager — read‑only access'}</p>
        </div>
      </Section>

      <Section icon={Bell} title="Notifications">
        <Toggle label="Alert on new theft/leak events" defaultChecked />
        <Toggle label="Alert when a vehicle goes offline" defaultChecked />
        <Toggle label="Daily fleet summary email" />
      </Section>

      <Section icon={LayoutDashboard} title="Dashboard preferences">
        <Toggle label="Show vehicle activity feed" defaultChecked />
        <Toggle label="Compact table rows" />
      </Section>

      <Section icon={Database} title="System information">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-faint">Version</span>
          <span className="readout text-text">1.0.0</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-faint">Database connection</span>
          <span className={isSupabaseConfigured ? 'text-signal-green' : 'text-signal-red'}>
            {isSupabaseConfigured ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-faint">Last synchronization</span>
          <span className="text-text-dim">{isSupabaseConfigured ? 'Live' : 'N/A'}</span>
        </div>
      </Section>
    </div>
  )
}
