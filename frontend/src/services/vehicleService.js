import { supabase, isSupabaseConfigured } from '../lib/supabase'

const NOT_CONFIGURED_ERROR = 'Supabase is not configured.'

/**
 * Fetch all registered vehicles.
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function getVehicles() {
  if (!isSupabaseConfigured) {
    return { data: [], error: NOT_CONFIGURED_ERROR }
  }
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('vehicle_name', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }
  return { data: data ?? [], error: null }
}

/**
 * Fetch a single vehicle by its vehicle_id.
 * @param {string} vehicleId
 */
export async function getVehicle(vehicleId) {
  if (!isSupabaseConfigured) {
    return { data: null, error: NOT_CONFIGURED_ERROR }
  }
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}
