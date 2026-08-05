import { getSupabaseClient } from '../utils/supabaseClient'

export async function addCycleLog(url, anonKey, clientId, date, flow, symptoms, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_cycle_log', {
    p_date: date, p_flow: flow || null, p_symptoms: symptoms || [], p_note: note || null, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listCycleLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_cycle_logs')
  if (error) throw error
  return data
}

export async function deleteCycleLog(url, anonKey, id) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('cycle_logs').delete().eq('id', id)
  if (error) throw error
}
