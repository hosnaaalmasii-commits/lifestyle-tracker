import { getSupabaseClient } from '../utils/supabaseClient'

export async function addNote(url, anonKey, clientId, date, text) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_note', {
    p_date: date, p_text: text, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listNotes(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_notes')
  if (error) throw error
  return data
}

export async function deleteNote(url, anonKey, clientId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('notes').delete().eq('client_id', clientId)
  if (error) throw error
}
