import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertNutritionLog(url, anonKey, date, item) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert({ date, ...item }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listNutritionLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('id, date, breakfast, lunch, dinner, vegetables, snacks')
    .order('date')
  if (error) throw error
  return data
}
