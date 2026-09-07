import { Link } from 'react-router-dom'
import { Fuel, Gauge, MapPin, AlertCircle } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatFuel, formatSpeed, formatRelativeTime } from '../lib/format'
import { hasValidGps } from '../services/telemetryService'

/**
 * @param {object} props
 * @param {object} props.vehicle - row from `vehicles`
 * @param {object|null} props.telemetry - latest telemetry row for this vehicle, or null
 * @param {boolean} props.online
 * @param {number} props.activeAlertCount
 */
export default function VehicleCard({ vehicle, telemetry, online, activeAlertCount = 0 }) {
  const fuel = telemetry ? formatFuel(telemetry.fuel_level) : null
  const gpsOk = hasValidGps(telemetry)

  return (
    <Link
      to={`/vehicles/${vehicle.vehicle_id}`}
      className="panel flex flex-col gap-3 p-4 transition-colors hover:border-amber/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{vehicle.vehicle_name}</p>
          <p className="text-[11px] text-text-faint">{vehicle.vehicle_id}</p>
        </div>
        <StatusBadge status={online ? 'online' : 'offline'} pulse={online} />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div className="flex items-center gap-2">
          <Fuel size={13} className="text-text-faint" />
          <div>
            <p className="readout text-sm text-text">{fuel ?? 'Pending'}</p>
            <p className="text-[10px] text-text-faint">Fuel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Gauge size={13} className="text-text-faint" />
          <div>
            <p className="readout text-sm text-text">
              {telemetry ? formatSpeed(telemetry.speed_kmph) : 'N/A'}
            </p>
            <p className="text-[10px] text-text-faint">Speed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-text-faint" />
          <div>
            <p className="text-sm text-text">{gpsOk ? 'Connected' : 'Unavailable'}</p>
            <p className="text-[10px] text-text-faint">GPS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle size={13} className={activeAlertCount > 0 ? 'text-signal-red' : 'text-text-faint'} />
          <div>
            <p className={`text-sm ${activeAlertCount > 0 ? 'text-signal-red' : 'text-text'}`}>
              {activeAlertCount > 0 ? activeAlertCount : 'None'}
            </p>
            <p className="text-[10px] text-text-faint">Alerts</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-faint">
        Last update: {telemetry ? formatRelativeTime(telemetry.received_at) : 'never'}
      </p>
    </Link>
  )
}
