import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Radio } from 'lucide-react'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { getVehicles } from '../services/vehicleService'
import {
  getRecentTelemetry,
  latestByVehicle,
  isOnline,
  hasValidGps,
  subscribeToTelemetry,
} from '../services/telemetryService'
import { formatFuel, formatSpeed, formatDistance, formatCoords, formatRelativeTime } from '../lib/format'

const POLL_INTERVAL_MS = 8000

export default function LiveMonitoring() {
  const [searchParams] = useSearchParams()
  const focusVehicle = searchParams.get('vehicle')

  const [state, setState] = useState({ status: 'loading', vehicles: [], telemetry: [], error: null })
  const [tick, setTick] = useState(0)
  const intervalRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, status: 'loading' }))
    const [vehiclesRes, telemetryRes] = await Promise.all([getVehicles(), getRecentTelemetry(300)])
    if (vehiclesRes.error) {
      setState({ status: 'error', vehicles: [], telemetry: [], error: vehiclesRes.error })
      return
    }
    setState({ status: 'success', vehicles: vehiclesRes.data, telemetry: telemetryRes.data, error: null })
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => {
      load(true)
      setTick((t) => t + 1)
    }, POLL_INTERVAL_MS)

    const unsubscribe = subscribeToTelemetry(() => load(true))

    return () => {
      clearInterval(intervalRef.current)
      unsubscribe()
    }
  }, [load])

  const latestMap = useMemo(() => latestByVehicle(state.telemetry), [state.telemetry])

  let rows = state.vehicles.map((vehicle) => ({
    vehicle,
    telemetry: latestMap.get(vehicle.vehicle_id) ?? null,
  }))
  if (focusVehicle) {
    rows = rows.filter((r) => r.vehicle.vehicle_id === focusVehicle)
  }

  if (state.status === 'loading') return <LoadingState label="Loading live feed…" />
  if (state.status === 'error') return <ErrorState title="Unable to load live data." detail={state.error} onRetry={() => load()} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <Radio size={14} className="text-signal-green" />
          <span>Refreshing every {POLL_INTERVAL_MS / 1000}s</span>
        </div>
        <span className="text-[11px] text-text-faint">Poll #{tick}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Radio} title="No vehicles to monitor." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ vehicle, telemetry }) => {
            const online = isOnline(telemetry)
            const gpsOk = hasValidGps(telemetry)
            return (
              <div key={vehicle.vehicle_id} className="panel flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">{vehicle.vehicle_name}</p>
                    <p className="text-[11px] text-text-faint">{vehicle.vehicle_id}</p>
                  </div>
                  <StatusBadge
                    status={online ? 'online' : 'offline'}
                    label={online ? 'Live' : `Last update ${telemetry ? formatRelativeTime(telemetry.received_at) : 'never'}`}
                    pulse={online}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 border-t border-hairline pt-3 text-xs">
                  <div>
                    <p className="text-text-faint">Fuel</p>
                    <p className="readout text-text">{telemetry ? formatFuel(telemetry.fuel_level) ?? 'Pending' : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-text-faint">Distance</p>
                    <p className="readout text-text">{telemetry ? formatDistance(telemetry.distance_cm) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-text-faint">Speed</p>
                    <p className="readout text-text">{telemetry ? formatSpeed(telemetry.speed_kmph) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-text-faint">GPS</p>
                    <p className={gpsOk ? 'text-signal-green' : 'text-text-faint'}>
                      {gpsOk ? formatCoords(telemetry.latitude, telemetry.longitude) : 'Unavailable'}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-text-faint">
                  Connection: {online ? 'Live' : 'Not receiving data'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
