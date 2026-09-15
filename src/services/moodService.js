import { getSupabaseClient } from '../utils/supabaseClient'

export async function addMoodLog(url, anonKey, clientId, date, emoji, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('mood_logs')
    .upsert({ client_id: clientId, date, emoji, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listMoodLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('mood_logs').select('id, client_id, date, emoji, note').order('date')
  if (error) throw error
  return data
}

export async function deleteMoodLog(url, anonKey, clientId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('mood_logs').delete().eq('client_id', clientId)
  if (error) throw error
}
