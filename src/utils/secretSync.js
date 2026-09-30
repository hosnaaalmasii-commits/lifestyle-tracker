// Syncs the user's own API keys (Claude, ElevenLabs, OpenAI, Oura) across
// their devices through their own Supabase project — encrypted at rest
// with the Vault key (supabase/user_secrets.sql), reachable only by the
// signed-in user through two RPCs. Added 2026-09-30 at the user's request
// ("ik moet elke key telkens opnieuw ingeven"), accepting that the keys
// then also live, encrypted, in their Supabase project.
//
// Each key still lives in its own localStorage slot and is used from
// there; this only copies it up when it changes and fills in missing ones
// after signing in. Nothing happens unless signed in to Cloud Sync.

export const SECRET_SLOTS = {
  anthropic: 'lifestyle-tracker-anthropic-key',
  elevenlabs: 'lifestyle-tracker-elevenlabs-key',
  openai: 'lifestyle-tracker-openai-key',
  oura: 'lifestyle-tracker-oura-key',
}

// Set by AppContext while signed in: (name, value|null) → Promise.
let pusher = null
const timers = {}

export function setSecretPusher(fn) {
  pusher = fn
}

// Called by each key's setter. Debounced, since key fields save per keystroke.
export function secretChanged(name, value) {
  if (!pusher || !SECRET_SLOTS[name]) return
  clearTimeout(timers[name])
  timers[name] = setTimeout(() => {
    pusher(name, value || null).catch((e) => console.warn(`Key sync (${name}) failed`, e))
  }, 800)
}

function readLocal(slot) {
  try { return localStorage.getItem(slot) || '' } catch { return '' }
}

// After signing in: fill in keys this device doesn't have yet, and upload
// keys only this device has. Returns true when a local key was filled in.
export async function pullSecrets(client) {
  const { data, error } = await client.rpc('get_user_secrets')
  if (error) throw error
  const remote = Object.fromEntries((data || []).map((r) => [r.name, r.value]))
  let filled = false
  for (const [name, slot] of Object.entries(SECRET_SLOTS)) {
    const local = readLocal(slot)
    if (!local && remote[name]) {
      try { localStorage.setItem(slot, remote[name]); filled = true } catch { /* private mode */ }
    } else if (local && !remote[name] && pusher) {
      await pusher(name, local).catch((e) => console.warn(`Key sync (${name}) failed`, e))
    }
  }
  return filled
}

// "Clear everything": also remove the synced copies.
export async function forgetSyncedSecrets() {
  if (!pusher) return
  await Promise.all(Object.keys(SECRET_SLOTS).map((name) => pusher(name, null).catch(() => {})))
}
