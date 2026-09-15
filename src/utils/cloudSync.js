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

// Hands a Google authorization code (see googleCalendar.js
// requestGoogleAuthCode) to the google-oauth-exchange Edge Function, which
// exchanges it server-side for a refresh token and stores it — this is
// what lets sync-calendar-tasks run on a daily cron with the browser
// closed. Called with the user's own Supabase session token so the
// function knows whose account to store the refresh token under.
export async function exchangeGoogleAuthCode(url, anonKey, code, clientId) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Sign in to Cloud Sync first.')

  const response = await fetch(`${url}/functions/v1/google-oauth-exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ code, clientId }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Could not connect automatic sync (${response.status}).`)
  return body
}

// Turns automatic sync back off by deleting the stored refresh token —
// through the normal supabase-js client, so it's RLS-scoped to the
// caller's own row (see calendar_auto_sync.sql's "delete own row" policy).
export async function deleteGoogleCalendarToken(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id
  if (!userId) return
  await supabase.from('google_calendar_tokens').delete().eq('user_id', userId)
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
