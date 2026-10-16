// Device settings that used to live only in this browser's localStorage
// (coach voice, speed, conversation language, read-aloud, models, spending
// limits…) are mirrored into data.prefs, so they travel with Cloud Sync to
// the user's other devices like everything else (user, 2026-10-16: "alles
// opgeslagen online"). The modules keep reading localStorage as before;
// AppContext copies changes into data.prefs and writes pulled prefs back.
//
// Not here on purpose: the API keys (encrypted separately, secretSync.js),
// this device's spending counters (each device counts its own), caches,
// and the sync bookkeeping itself.

export const PREF_KEYS = [
  'lifestyle-tracker-coach-voice-provider',
  'lifestyle-tracker-coach-voice',
  'lifestyle-tracker-coach-rate',
  'lifestyle-tracker-coach-speak',
  'lifestyle-tracker-coach-settings',
  'lifestyle-tracker-speech-lang',
  'lifestyle-tracker-openai-voice',
  'lifestyle-tracker-openai-live-model',
  'lifestyle-tracker-elevenlabs-voice',
  'lifestyle-tracker-elevenlabs-model',
  'lifestyle-tracker-elevenlabs-agent',
  'lifestyle-tracker-usage-limits',
  'lifestyle-tracker-seen-badges',
]

// { key: value } of the prefs this device has set.
export function readLocalPrefs() {
  const out = {}
  for (const k of PREF_KEYS) {
    try {
      const v = localStorage.getItem(k)
      if (v !== null) out[k] = v
    } catch { /* private mode */ }
  }
  return out
}

// Write synced prefs onto this device. Keys missing from `prefs` are left
// alone (an older blob without them shouldn't wipe a setting).
export function applyPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return
  for (const k of PREF_KEYS) {
    if (typeof prefs[k] !== 'string') continue
    try { if (localStorage.getItem(k) !== prefs[k]) localStorage.setItem(k, prefs[k]) } catch { /* private mode */ }
  }
}

export function samePrefs(a = {}, b = {}) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}
