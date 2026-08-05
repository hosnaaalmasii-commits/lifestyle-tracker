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

export async function deleteWeightLog(url, anonKey, id) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('weight_logs').delete().eq('id', id)
  if (error) throw error
}
