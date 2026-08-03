// Whole-blob, last-write-wins sync against a single Supabase table
// (app_data: user_id, data jsonb, updated_at). Deliberately not a
// field-level merge — simple and predictable for one person's own devices,
// with one honest tradeoff: editing two offline devices in the same
// window before either syncs will keep only the later write.
import { getSupabaseClient } from './supabaseClient'

const LAST_MODIFIED_KEY = 'lifestyle-tracker-last-modified'

export function getLocalLastModified() {
  return localStorage.getItem(LAST_MODIFIED_KEY) || null
}

export function markLocalModified(iso = new Date().toISOString()) {
  localStorage.setItem(LAST_MODIFIED_KEY, iso)
  return iso
}

export async function signUp(url, anonKey, email, password) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signIn(url, anonKey, email, password) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  await supabase.auth.signOut()
}

export async function getSession(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(url, anonKey, callback) {
  const supabase = getSupabaseClient(url, anonKey)
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function pullFromCloud(url, anonKey, userId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('app_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? { blob: data.data, updatedAt: data.updated_at } : null
}

export async function pushToCloud(url, anonKey, userId, blob, updatedAt) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase
    .from('app_data')
    .upsert({ user_id: userId, data: blob, updated_at: updatedAt }, { onConflict: 'user_id' })
  if (error) throw error
}

// Reconciles local vs. cloud once, on sign-in / app load: whichever side
// has the newer timestamp wins and overwrites the other.
export async function reconcile(url, anonKey, userId, localBlob) {
  const localModified = getLocalLastModified() || new Date(0).toISOString()
  const remote = await pullFromCloud(url, anonKey, userId)

  if (!remote) {
    await pushToCloud(url, anonKey, userId, localBlob, localModified)
    return { direction: 'pushed', blob: localBlob }
  }

  if (new Date(remote.updatedAt) > new Date(localModified)) {
    markLocalModified(remote.updatedAt)
    return { direction: 'pulled', blob: remote.blob }
  }

  await pushToCloud(url, anonKey, userId, localBlob, localModified)
  return { direction: 'pushed', blob: localBlob }
}
