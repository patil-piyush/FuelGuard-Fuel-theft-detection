import { useEffect, useState, useCallback, useMemo } from 'react'
import MapView from '../components/MapView'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { getVehicles } from '../services/vehicleService'
import { getRecentTelemetry, latestByVehicle, isOnline } from '../services/telemetryService'

export default function MapPage() {
  const [state, setState] = useState({ status: 'loading', vehicles: [], telemetry: [], error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const [vehiclesRes, telemetryRes] = await Promise.all([getVehicles(), getRecentTelemetry(300)])
    if (vehiclesRes.error) {
      setState({ status: 'error', vehicles: [], telemetry: [], error: vehiclesRes.error })
      return
    }
    setState({ status: 'success', vehicles: vehiclesRes.data, telemetry: telemetryRes.data, error: null })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const latestMap = useMemo(() => latestByVehicle(state.telemetry), [state.telemetry])

  const rows = state.vehicles.map((vehicle) => {
    const telemetry = latestMap.get(vehicle.vehicle_id) ?? null
    return { vehicle, telemetry, online: isOnline(telemetry) }
  })

  if (state.status === 'loading') return <LoadingState label="Loading fleet map…" />
  if (state.status === 'error') return <ErrorState title="Unable to load map data." detail={state.error} onRetry={load} />

  return <MapView rows={rows} />
}
