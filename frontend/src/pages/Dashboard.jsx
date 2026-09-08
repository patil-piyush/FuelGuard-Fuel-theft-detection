import { useEffect, useState, useCallback, useMemo } from 'react'
import { Truck, Radio, RadioTower, ShieldAlert, Fuel, TrendingUp, Activity } from 'lucide-react'
import StatCard from '../components/StatCard'
import VehicleTable from '../components/VehicleTable'
import FuelChart from '../components/FuelChart'
import EventCard from '../components/EventCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { getVehicles } from '../services/vehicleService'
import { getRecentTelemetry, latestByVehicle, isOnline } from '../services/telemetryService'
import { getEvents } from '../services/eventService'
import { formatRelativeTime } from '../lib/format'

export default function Dashboard() {
  const [state, setState] = useState({ status: 'loading', vehicles: [], telemetry: [], events: [], eventsTableMissing: false, error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const [vehiclesRes, telemetryRes, eventsRes] = await Promise.all([
      getVehicles(),
      getRecentTelemetry(300),
      getEvents(20),
    ])

    if (vehiclesRes.error) {
      setState({ status: 'error', vehicles: [], telemetry: [], events: [], eventsTableMissing: false, error: vehiclesRes.error })
      return
    }

    setState({
      status: 'success',
      vehicles: vehiclesRes.data,
      telemetry: telemetryRes.data,
      events: eventsRes.data,
      eventsTableMissing: eventsRes.tableMissing,
      error: null,
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const latestMap = useMemo(() => latestByVehicle(state.telemetry), [state.telemetry])

  const rows = useMemo(
    () =>
      state.vehicles.map((vehicle) => {
        const telemetry = latestMap.get(vehicle.vehicle_id) ?? null
        const online = isOnline(telemetry)
        const activeAlertCount = state.events.filter(
          (e) => e.vehicle_id === vehicle.vehicle_id && e.status !== 'Resolved'
        ).length
        return { vehicle, telemetry, online, activeAlertCount }
      }),
    [state.vehicles, latestMap, state.events]
  )

  const onlineCount = rows.filter((r) => r.online).length
  const totalVehicles = rows.length
  const activeAlerts = state.events.filter((e) => e.status !== 'Resolved').length

  const fuelValues = rows
    .map((r) => r.telemetry?.fuel_level)
    .filter((v) => v !== null && v !== undefined)
  const avgFuel = fuelValues.length
    ? Math.round(fuelValues.reduce((a, b) => a + b, 0) / fuelValues.length)
    : null

  if (state.status === 'loading') return <LoadingState label="Loading dashboard…" />
  if (state.status === 'error') {
    return <ErrorState title="Unable to load fleet data." detail={state.error} onRetry={load} />
  }

  return (
    <div className="flex flex-col gap-5">
  {/* Primary fleet metrics */}
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
    <StatCard icon={Truck} label="Total vehicles" value={totalVehicles || null} />
    <StatCard icon={Radio} label="Online" value={onlineCount || (totalVehicles ? 0 : null)} tone="purple" />
    <StatCard icon={RadioTower} label="Offline" value={totalVehicles ? totalVehicles - onlineCount : null} />
    <StatCard icon={ShieldAlert} label="Active alerts" value={state.eventsTableMissing ? 0 : activeAlerts} tone={activeAlerts > 0 ? 'red' : 'default'} />
    <StatCard icon={Fuel} label="Avg fuel level" value={avgFuel} unit="%" tone="purple" />
    <StatCard icon={TrendingUp} label="Today's consumption" value={null} hint="Awaiting cloud analytics" />
  </div>

  {/* Fleet Health */}
  <div className="panel p-4">
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-sm font-medium text-text">Fleet Health</h2>
    <span className="text-[11px] text-text-faint">Real‑time overview</span>
  </div>
  <div className="flex flex-col md:flex-row gap-4">
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
      <span className="text-sm font-medium text-text">Online</span>
      <span className="text-sm text-text-faint">{onlineCount}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
      <span className="text-sm font-medium text-text">Offline</span>
      <span className="text-sm text-text-faint">{totalVehicles - onlineCount}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
      <span className="text-sm font-medium text-text">Active Alerts</span>
      <span className="text-sm text-text-faint">{activeAlerts}</span>
    </div>
  </div>
</div>

  {/* Fuel Analytics */}
  <div className="panel p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-text">Fuel Analytics</h2>
      <span className="text-[11px] text-text-faint">Fuel level trend</span>
    </div>
    <FuelChart data={state.telemetry} />
  </div>

  {/* Vehicle Overview */}
  <div className="panel p-4">
    <h2 className="mb-3 text-sm font-medium text-text">Vehicle Overview</h2>
    {rows.length === 0 ? (
      <EmptyState icon={Truck} title="No vehicles found." detail="Register a vehicle in Supabase to see it here." />
    ) : (
      <VehicleTable rows={rows} />
    )}
  </div>

  {/* Recent Events */}
  <div className="panel p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-text">Recent Events</h2>
    </div>
    {state.events.length === 0 ? (
      <div className="panel">
        <EmptyState icon={ShieldAlert} title="No detected events" detail="Theft, leak, and refuel events will appear here once the detection pipeline is connected." />
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {state.events.slice(0, 6).map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    )}
  </div>
</div>
  )
}
