import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertWaterLog(url, anonKey, date, ml) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('water_logs')
    .upsert({ date, ml }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWaterLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('water_logs').select('id, date, ml').order('date')
  if (error) throw error
  return data
}
