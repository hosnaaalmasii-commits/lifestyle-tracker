import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertSleepLog(url, anonKey, date, hours, quality) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert({ date, hours, quality }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listSleepLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('sleep_logs').select('id, date, hours, quality').order('date')
  if (error) throw error
  return data
}

export async function deleteSleepLog(url, anonKey, date) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('sleep_logs').delete().eq('date', date)
  if (error) throw error
}
