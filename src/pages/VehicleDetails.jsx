import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Fuel, Gauge, Ruler, MapPin, Clock } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import FuelChart from '../components/FuelChart'
import SpeedChart from '../components/SpeedChart'
import EventCard from '../components/EventCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { getVehicle } from '../services/vehicleService'
import { getVehicleTelemetry, isOnline, hasValidGps } from '../services/telemetryService'
import { getVehicleEvents } from '../services/eventService'
import { formatFuel, formatSpeed, formatDistance, formatCoords, formatRelativeTime, formatClockTime } from '../lib/format'

export default function VehicleDetails() {
  const { vehicleId } = useParams()
  const [state, setState] = useState({ status: 'loading', vehicle: null, telemetry: [], events: [], eventsTableMissing: false, error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const [vehicleRes, telemetryRes, eventsRes] = await Promise.all([
      getVehicle(vehicleId),
      getVehicleTelemetry(vehicleId, 200),
      getVehicleEvents(vehicleId, 30),
    ])

    if (vehicleRes.error) {
      setState({ status: 'error', vehicle: null, telemetry: [], events: [], eventsTableMissing: false, error: vehicleRes.error })
      return
    }

    setState({
      status: 'success',
      vehicle: vehicleRes.data,
      telemetry: telemetryRes.data,
      events: eventsRes.data,
      eventsTableMissing: eventsRes.tableMissing,
      error: null,
    })
  }, [vehicleId])

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') return <LoadingState label="Loading vehicle data…" />
  if (state.status === 'error') return <ErrorState title="Unable to load vehicle data." detail={state.error} onRetry={load} />
  if (!state.vehicle) {
    return <EmptyState title="Vehicle not found." detail={`No vehicle registered with ID ${vehicleId}.`} />
  }

  const latest = state.telemetry[0] ?? null
  const online = isOnline(latest)
  const gpsOk = hasValidGps(latest)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/vehicles" className="flex w-fit items-center gap-1.5 text-xs text-text-dim hover:text-amber">
        <ArrowLeft size={13} /> Back to vehicles
      </Link>

      <div className="panel flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">{state.vehicle.vehicle_name}</h1>
          <p className="text-xs text-text-faint">
            {state.vehicle.vehicle_id} · {state.vehicle.device_id ?? 'No device linked'}
          </p>
        </div>
        <StatusBadge status={online ? 'online' : 'offline'} pulse={online} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Fuel} label="Current fuel" value={latest ? formatFuel(latest.fuel_level) ?? 'Pending' : 'N/A'} tone="amber" />
        <StatCard icon={Gauge} label="Current speed" value={latest ? formatSpeed(latest.speed_kmph) : 'N/A'} />
        <StatCard icon={Ruler} label="Distance reading" value={latest ? formatDistance(latest.distance_cm) : 'N/A'} />
        <StatCard icon={MapPin} label="GPS status" value={gpsOk ? 'Connected' : 'Unavailable'} tone={gpsOk ? 'green' : 'default'} />
        <StatCard icon={Clock} label="Last update" value={latest ? formatRelativeTime(latest.received_at) : 'Never'} />
      </div>

      {latest && !gpsOk && (
        <p className="text-xs text-text-faint">
          GPS coordinates: N/A — no satellite fix yet (0,0 readings are not treated as valid location).
        </p>
      )}
      {latest && gpsOk && (
        <p className="text-xs text-text-faint">
          Coordinates: <span className="readout text-text-dim">{formatCoords(latest.latitude, latest.longitude)}</span>
        </p>
      )}
      {latest && (latest.fuel_level === null || latest.fuel_level === undefined) && (
        <div className="panel border-l-2 border-l-amber p-3 text-xs text-text-dim">
          Fuel percentage unavailable — calibration required. Raw distance reading:{' '}
          <span className="readout text-text">{formatDistance(latest.distance_cm)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-medium text-text">Fuel level vs time</h2>
          <FuelChart data={state.telemetry} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-medium text-text">Speed vs time</h2>
          <SpeedChart data={state.telemetry} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-text">Recent telemetry</h2>
        {state.telemetry.length === 0 ? (
          <EmptyState title="No telemetry available." />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Fuel</th>
                  <th className="px-4 py-2.5 font-medium">Distance</th>
                  <th className="px-4 py-2.5 font-medium">Speed</th>
                  <th className="px-4 py-2.5 font-medium">GPS</th>
                </tr>
              </thead>
              <tbody>
                {state.telemetry.slice(0, 15).map((row) => (
                  <tr key={row.id ?? row.received_at} className="border-b border-hairline/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-text-dim">{formatClockTime(row.received_at)}</td>
                    <td className="readout whitespace-nowrap px-4 py-2.5 text-text">{formatFuel(row.fuel_level) ?? 'Pending'}</td>
                    <td className="readout whitespace-nowrap px-4 py-2.5 text-text">{formatDistance(row.distance_cm)}</td>
                    <td className="readout whitespace-nowrap px-4 py-2.5 text-text">{formatSpeed(row.speed_kmph)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={hasValidGps(row) ? 'text-signal-green' : 'text-text-faint'}>
                        {hasValidGps(row) ? 'Fix' : 'No fix'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-text">Detected events</h2>
        {state.events.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No detected events"
              detail={state.eventsTableMissing ? 'Event detection is not yet connected for this vehicle.' : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {state.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
