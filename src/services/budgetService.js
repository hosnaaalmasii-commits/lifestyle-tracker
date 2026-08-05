import { getSupabaseClient } from '../utils/supabaseClient'

export async function addBudgetEntry(url, anonKey, clientId, date, amount, category, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('budget_entries')
    .upsert({ client_id: clientId, date, amount, category, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listBudgetEntries(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('budget_entries')
    .select('id, client_id, date, amount, category, note')
    .order('date')
  if (error) throw error
  return data
}
