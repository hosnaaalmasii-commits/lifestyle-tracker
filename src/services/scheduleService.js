import { getSupabaseClient } from '../utils/supabaseClient'

export async function addScheduleItem(url, anonKey, clientId, date, time, title, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .upsert({ client_id: clientId, date, time, title, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listScheduleItems(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .select('id, client_id, date, time, title, note')
    .order('date')
  if (error) throw error
  return data
}
