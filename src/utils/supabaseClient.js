// A thin, lazily-created Supabase client. The URL and anon key are not
// secrets (Supabase's own security model relies on Row Level Security
// policies, not on hiding the anon key) — same trust model as the Google
// OAuth Client ID elsewhere in this app, so they live in data.settings and
// round-trip through export/import like any other setting.
import { createClient } from '@supabase/supabase-js'

let client = null
let clientKey = null

export function getSupabaseClient(url, anonKey) {
  if (!url || !anonKey) return null
  const key = `${url}::${anonKey}`
  if (client && clientKey === key) return client
  client = createClient(url, anonKey)
  clientKey = key
  return client
}

export function isCloudSyncConfigured(settings) {
  return !!(settings?.supabaseUrl && settings?.supabaseAnonKey)
}
