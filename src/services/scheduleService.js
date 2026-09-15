import { getSupabaseClient } from '../utils/supabaseClient'

export async function addScheduleItem(url, anonKey, clientId, date, time, text) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .upsert({ client_id: clientId, date, time, text }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listScheduleItems(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .select('id, client_id, date, time, text')
    .order('date')
  if (error) throw error
  return data
}

export async function deleteScheduleItemLog(url, anonKey, clientId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('schedule_items').delete().eq('client_id', clientId)
  if (error) throw error
}
