import { Link } from 'react-router-dom'
import { Eye, Radio } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatFuel, formatSpeed, formatRelativeTime } from '../lib/format'
import { hasValidGps } from '../services/telemetryService'

const COLUMNS = [
  'Vehicle',
  'Vehicle ID',
  'Device',
  'Status',
  'Fuel',
  'Speed',
  'GPS',
  'Last seen',
  'Alerts',
  'Actions',
]

/**
 * @param {object} props
 * @param {Array} props.rows - [{ vehicle, telemetry, online, activeAlertCount }]
 */
export default function VehicleTable({ rows }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-text-faint">
            {COLUMNS.map((col) => (
              <th key={col} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ vehicle, telemetry, online, activeAlertCount }) => {
            const gpsOk = hasValidGps(telemetry)
            const fuel = telemetry ? formatFuel(telemetry.fuel_level) : null
            return (
              <tr
                key={vehicle.vehicle_id}
                className="border-b border-hairline/60 last:border-0 hover:bg-panel-raised/40"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-text">
                  {vehicle.vehicle_name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-text-dim">{vehicle.vehicle_id}</td>
                <td className="whitespace-nowrap px-4 py-3 text-text-dim">{vehicle.device_id ?? 'N/A'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={online ? 'online' : 'offline'} pulse={online} />
                </td>
                <td className="readout whitespace-nowrap px-4 py-3 text-text">
                  {fuel ?? <span className="text-text-faint">Pending</span>}
                </td>
                <td className="readout whitespace-nowrap px-4 py-3 text-text">
                  {telemetry ? formatSpeed(telemetry.speed_kmph) : 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={gpsOk ? 'text-signal-green' : 'text-text-faint'}>
                    {gpsOk ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-text-dim">
                  {telemetry ? formatRelativeTime(telemetry.received_at) : 'Never'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {activeAlertCount > 0 ? (
                    <span className="text-signal-red">{activeAlertCount} active</span>
                  ) : (
                    <span className="text-text-faint">None</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/vehicles/${vehicle.vehicle_id}`}
                      className="flex items-center gap-1 text-xs text-text-dim hover:text-purple-300"
                    >
                      <Eye size={13} /> Details
                    </Link>
                    <Link
                      to={`/live?vehicle=${vehicle.vehicle_id}`}
                      className="flex items-center gap-1 text-xs text-text-dim hover:text-purple-300"
                    >
                      <Radio size={13} /> Live
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
