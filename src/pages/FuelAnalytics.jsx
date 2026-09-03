import { useEffect, useState, useCallback, useMemo } from 'react'
import { Fuel, Droplet } from 'lucide-react'
import FuelChart from '../components/FuelChart'
import EventCard from '../components/EventCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import StatCard from '../components/StatCard'
import { getVehicles } from '../services/vehicleService'
import { getRecentTelemetry, getVehicleTelemetry } from '../services/telemetryService'
import { getEvents } from '../services/eventService'

const RANGE_OPTIONS = [
  { value: '1h', label: 'Last 1 hour', ms: 60 * 60 * 1000 },
  { value: '6h', label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '24h', label: 'Today', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
]

export default function FuelAnalytics() {
  const [state, setState] = useState({ status: 'loading', vehicles: [], events: [], error: null })
  const [selectedVehicle, setSelectedVehicle] = useState('all')
  const [range, setRange] = useState('24h')
  const [telemetry, setTelemetry] = useState([])
  const [telemetryLoading, setTelemetryLoading] = useState(false)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const [vehiclesRes, eventsRes] = await Promise.all([getVehicles(), getEvents(100)])
    if (vehiclesRes.error) {
      setState({ status: 'error', vehicles: [], events: [], error: vehiclesRes.error })
      return
    }
    setState({ status: 'success', vehicles: vehiclesRes.data, events: eventsRes.data, error: null })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadTelemetry = useCallback(async () => {
    setTelemetryLoading(true)
    if (selectedVehicle === 'all') {
      const { data } = await getRecentTelemetry(1000)
      setTelemetry(data)
    } else {
      const { data } = await getVehicleTelemetry(selectedVehicle, 1000)
      setTelemetry(data)
    }
    setTelemetryLoading(false)
  }, [selectedVehicle])

  useEffect(() => {
    loadTelemetry()
  }, [loadTelemetry])

  const rangeMs = RANGE_OPTIONS.find((r) => r.value === range)?.ms ?? RANGE_OPTIONS[2].ms
  const cutoff = Date.now() - rangeMs

  const filteredTelemetry = useMemo(
    () => telemetry.filter((t) => new Date(t.received_at).getTime() >= cutoff),
    [telemetry, cutoff]
  )

  const relevantEvents = useMemo(
    () =>
      state.events.filter(
        (e) =>
          (selectedVehicle === 'all' || e.vehicle_id === selectedVehicle) &&
          new Date(e.timestamp).getTime() >= cutoff
      ),
    [state.events, selectedVehicle, cutoff]
  )

  const refuels = relevantEvents.filter((e) => e.event_type === 'REFUEL')
  const drops = relevantEvents.filter((e) => e.event_type === 'LEAK' || e.event_type === 'THEFT')

  if (state.status === 'loading') return <LoadingState label="Loading fuel analytics…" />
  if (state.status === 'error') return <ErrorState title="Unable to load analytics." detail={state.error} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
          >
            <option value="all">All vehicles</option>
            {state.vehicles.map((v) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_name}
              </option>
            ))}
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Fuel} label="Readings in range" value={filteredTelemetry.length || null} />
        <StatCard icon={Droplet} label="Refuel events" value={refuels.length} tone="blue" />
        <StatCard label="Leak / theft flags" value={drops.length} tone={drops.length ? 'red' : 'default'} />
        <StatCard label="Avg. consumption" value={null} hint="Awaiting cloud analytics" />
      </div>

      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text">Fuel level over time</h2>
          {telemetryLoading && <span className="text-[11px] text-text-faint">Refreshing…</span>}
        </div>
        <FuelChart data={filteredTelemetry} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium text-text">Refueling events</h2>
          {refuels.length === 0 ? (
            <div className="panel">
              <EmptyState title="No refueling events in this range." />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {refuels.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium text-text">Sudden fuel drops</h2>
          {drops.length === 0 ? (
            <div className="panel">
              <EmptyState title="No sudden drops detected in this range." />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {drops.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
