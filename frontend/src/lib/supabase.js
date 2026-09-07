import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Whether the app has real Supabase credentials configured. Every service
// function checks this first so the UI can show an honest "not configured"
// state instead of throwing or, worse, falling back to invented data.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[FuelGuard] Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your .env file to connect real fleet data.'
  )
}

// supabase is null when not configured — every caller in src/services
// checks isSupabaseConfigured before touching it.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 5 },
      },
    })
  : null

// Helper to fetch the authenticated user's profile (role)
export async function fetchUserProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }
  return data
}

// Helper to sign out
export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

