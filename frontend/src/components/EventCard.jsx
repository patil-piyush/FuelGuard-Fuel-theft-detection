import { Fuel, Droplet, ShieldAlert, CircleCheck } from 'lucide-react'
import { formatClockTime, formatCoords } from '../lib/format'

const EVENT_META = {
  NORMAL: { icon: CircleCheck, color: 'text-signal-green', border: 'border-l-signal-green', label: 'Normal' },
  REFUEL: { icon: Fuel, color: 'text-purple-500', border: 'border-l-purple-500', label: 'Refuel' },
  LEAK: { icon: Droplet, color: 'text-amber', border: 'border-l-amber', label: 'Leak detected' },
  THEFT: { icon: ShieldAlert, color: 'text-signal-red', border: 'border-l-signal-red', label: 'Theft detected' },
}

const SEVERITY_STYLE = {
  HIGH: 'text-signal-red',
  MEDIUM: 'text-amber',
  LOW: 'text-text-dim',
}

/**
 * @param {object} props
 * @param {object} props.event - row from `events`
 */
export default function EventCard({ event }) {
  const meta = EVENT_META[event.event_type] ?? EVENT_META.NORMAL
  const Icon = meta.icon
  const fuelChange = event.fuel_change ?? (
    event.fuel_before != null && event.fuel_after != null
      ? event.fuel_after - event.fuel_before
      : null
  )

  return (
    <div className={`panel border-l-2 ${meta.border} flex flex-col gap-2.5 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={meta.color} />
          <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
        </div>
        {event.severity && (
          <span className={`text-[11px] font-medium ${SEVERITY_STYLE[event.severity] ?? 'text-text-dim'}`}>
            {event.severity}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <p className="text-text-faint">Vehicle</p>
          <p className="text-text">{event.vehicle_id ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-text-faint">Fuel change</p>
          <p className="readout text-text">
            {fuelChange != null ? `${fuelChange > 0 ? '+' : ''}${fuelChange}%` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-text-faint">Location</p>
          <p className="text-text">{formatCoords(event.latitude, event.longitude)}</p>
        </div>
        <div>
          <p className="text-text-faint">Time</p>
          <p className="text-text">{formatClockTime(event.timestamp)}</p>
        </div>
        {event.confidence != null && (
          <div>
            <p className="text-text-faint">Confidence</p>
            <p className="readout text-text">{event.confidence}%</p>
          </div>
        )}
        {event.status && (
          <div>
            <p className="text-text-faint">Status</p>
            <p className="text-text">{event.status}</p>
          </div>
        )}
      </div>
    </div>
  )
}
