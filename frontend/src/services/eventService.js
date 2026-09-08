import { supabase, isSupabaseConfigured } from '../lib/supabase'

const NOT_CONFIGURED_ERROR = 'Supabase is not configured.'

// Postgres error code Supabase/PostgREST returns when a table doesn't
// exist yet. The events table is explicitly optional per the project
// spec — this is treated as "no events yet", not a hard error.
const UNDEFINED_TABLE = '42P01'

function isMissingTable(error) {
  return error?.code === UNDEFINED_TABLE
}

/**
 * All detected events, most recent first. If the events table hasn't
 * been created yet, resolves to an empty list rather than an error —
 * the UI should render its "No detected events" empty state.
 */
export async function getEvents(limit = 100) {
  if (!isSupabaseConfigured) {
    return { data: [], error: NOT_CONFIGURED_ERROR, tableMissing: false }
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTable(error)) {
      return { data: [], error: null, tableMissing: true }
    }
    return { data: [], error: error.message, tableMissing: false }
  }
  return { data: data ?? [], error: null, tableMissing: false }
}

/**
 * Events for a single vehicle, most recent first.
 * @param {string} vehicleId
 */
export async function getVehicleEvents(vehicleId, limit = 50) {
  if (!isSupabaseConfigured) {
    return { data: [], error: NOT_CONFIGURED_ERROR, tableMissing: false }
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTable(error)) {
      return { data: [], error: null, tableMissing: true }
    }
    return { data: [], error: error.message, tableMissing: false }
  }
  return { data: data ?? [], error: null, tableMissing: false }
}
