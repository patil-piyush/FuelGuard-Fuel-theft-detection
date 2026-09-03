import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, Truck } from 'lucide-react'
import VehicleTable from '../components/VehicleTable'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { getVehicles } from '../services/vehicleService'
import { getRecentTelemetry, latestByVehicle, isOnline } from '../services/telemetryService'
import { getEvents } from '../services/eventService'

export default function Vehicles() {
  const [state, setState] = useState({ status: 'loading', vehicles: [], telemetry: [], events: [], error: null })
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [alertFilter, setAlertFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const [vehiclesRes, telemetryRes, eventsRes] = await Promise.all([
      getVehicles(),
      getRecentTelemetry(300),
      getEvents(50),
    ])
    if (vehiclesRes.error) {
      setState({ status: 'error', vehicles: [], telemetry: [], events: [], error: vehiclesRes.error })
      return
    }
    setState({ status: 'success', vehicles: vehiclesRes.data, telemetry: telemetryRes.data, events: eventsRes.data, error: null })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const latestMap = useMemo(() => latestByVehicle(state.telemetry), [state.telemetry])

  const rows = useMemo(() => {
    let result = state.vehicles.map((vehicle) => {
      const telemetry = latestMap.get(vehicle.vehicle_id) ?? null
      const online = isOnline(telemetry)
      const activeAlertCount = state.events.filter(
        (e) => e.vehicle_id === vehicle.vehicle_id && e.status !== 'Resolved'
      ).length
      return { vehicle, telemetry, online, activeAlertCount }
    })

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (r) =>
          r.vehicle.vehicle_name?.toLowerCase().includes(q) ||
          r.vehicle.vehicle_id?.toLowerCase().includes(q) ||
          r.vehicle.device_id?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => (statusFilter === 'online' ? r.online : !r.online))
    }

    if (alertFilter !== 'all') {
      result = result.filter((r) => (alertFilter === 'active' ? r.activeAlertCount > 0 : r.activeAlertCount === 0))
    }

    if (sortBy === 'name') {
      result.sort((a, b) => (a.vehicle.vehicle_name ?? '').localeCompare(b.vehicle.vehicle_name ?? ''))
    } else if (sortBy === 'recent') {
      result.sort((a, b) => {
        const at = a.telemetry ? new Date(a.telemetry.received_at).getTime() : 0
        const bt = b.telemetry ? new Date(b.telemetry.received_at).getTime() : 0
        return bt - at
      })
    }

    return result
  }, [state.vehicles, state.events, latestMap, query, statusFilter, alertFilter, sortBy])

  if (state.status === 'loading') return <LoadingState label="Loading vehicles…" />
  if (state.status === 'error') return <ErrorState title="Unable to load vehicles." detail={state.error} onRetry={load} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded border border-hairline bg-panel px-2.5 py-2 sm:w-64">
          <Search size={14} className="text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vehicles…"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
          >
            <option value="all">All alert states</option>
            <option value="active">Has active alerts</option>
            <option value="none">No alerts</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
          >
            <option value="name">Sort: name</option>
            <option value="recent">Sort: last update</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles match your filters." />
      ) : (
        <VehicleTable rows={rows} />
      )}
    </div>
  )
}
