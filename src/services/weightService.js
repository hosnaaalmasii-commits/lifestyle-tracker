import { getSupabaseClient } from '../utils/supabaseClient'

export async function addWeightLog(url, anonKey, clientId, date, kg) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_weight_log', {
    p_kg: kg, p_date: date, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listWeightLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_weight_logs')
  if (error) throw error
  return data
}

// Keyed on client_id (the id the local app already has for an entry),
// not the row's own Supabase-generated id — the app never learns that
// id since RPC inserts return only the row id, not the full row, and
// nothing stores it locally. client_id is unique per user (see
// supabase/normalized_tables.sql), so it's a reliable delete key.
export async function deleteWeightLog(url, anonKey, clientId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('weight_logs').delete().eq('client_id', clientId)
  if (error) throw error
}
