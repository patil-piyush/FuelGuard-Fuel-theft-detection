import { supabase, isSupabaseConfigured } from '../lib/supabase'

const NOT_CONFIGURED_ERROR = 'Supabase is not configured.'

// A vehicle is considered online if its most recent telemetry arrived
// within this window. Kept in one place so every page agrees on "online".
export const ONLINE_THRESHOLD_MS = 60 * 1000

/**
 * Latest telemetry row per vehicle_id (one row per vehicle).
 * Used for fleet overview / summary cards.
 */
export async function getRecentTelemetry(limit = 200) {
  if (!isSupabaseConfigured) {
    return { data: [], error: NOT_CONFIGURED_ERROR }
  }
  const { data, error } = await supabase
    .from('telemetry')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: error.message }
  }
  return { data: data ?? [], error: null }
}

/**
 * Full telemetry history for one vehicle, most recent first.
 * @param {string} vehicleId
 * @param {number} limit
 */
export async function getVehicleTelemetry(vehicleId, limit = 500) {
  if (!isSupabaseConfigured) {
    return { data: [], error: NOT_CONFIGURED_ERROR }
  }
  const { data, error } = await supabase
    .from('telemetry')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: error.message }
  }
  return { data: data ?? [], error: null }
}

/**
 * Reduce a telemetry array down to the single latest row per vehicle_id.
 * Pure helper — no network call — used by pages that need a "one row per
 * vehicle" view derived from getRecentTelemetry().
 */
export function latestByVehicle(telemetryRows) {
  const map = new Map()
  for (const row of telemetryRows) {
    const existing = map.get(row.vehicle_id)
    if (!existing || new Date(row.received_at) > new Date(existing.received_at)) {
      map.set(row.vehicle_id, row)
    }
  }
  return map
}

/**
 * Whether a telemetry row counts as valid GPS. 0,0 is a null-island
 * placeholder, not a real fix, and must never be plotted or displayed.
 */
export function hasValidGps(row) {
  if (!row) return false
  const { latitude, longitude } = row
  if (latitude == null || longitude == null) return false
  if (latitude === 0 && longitude === 0) return false
  return true
}

/**
 * Whether a telemetry row is recent enough to count the vehicle as online.
 */
export function isOnline(row) {
  if (!row?.received_at) return false
  return Date.now() - new Date(row.received_at).getTime() < ONLINE_THRESHOLD_MS
}

/**
 * Subscribe to realtime inserts on the telemetry table.
 * Returns an unsubscribe function. Callers should call it on unmount.
 * @param {(row: object) => void} onInsert
 */
export function subscribeToTelemetry(onInsert) {
  if (!isSupabaseConfigured) {
    return () => {}
  }
  const channel = supabase
    .channel('telemetry-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'telemetry' },
      (payload) => onInsert(payload.new)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
