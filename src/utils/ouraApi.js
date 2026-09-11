// Direct browser -> Oura API calls using the user's own Personal Access
// Token. Same trust model and storage pattern as the Anthropic key
// (claudeApi.js): a real secret, kept in its own localStorage key, never
// included in data/export, sent straight from this browser to Oura since
// this app has no backend to route through.

const KEY_STORAGE = 'lifestyle-tracker-oura-key'

export function getOuraApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function setOuraApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key)
  else localStorage.removeItem(KEY_STORAGE)
}

export function hasOuraApiKey() {
  return !!getOuraApiKey()
}

async function ouraGet(path, apiKey, params) {
  const url = new URL(`https://api.ouraring.com/v2/usercollection/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Oura token rejected — check it in Settings.')
    throw new Error(`Oura request failed (${response.status}).`)
  }
  const body = await response.json()
  return body?.data?.[0] || null
}

// Fetches today's sleep score, readiness score, and active calories in one
// go. Any of the three can come back null — Oura has no data yet today
// (e.g. readiness/sleep before the ring has synced overnight data), which
// is a normal, expected state, not an error.
export async function fetchOuraToday(apiKey, dateKey) {
  const [sleep, readiness, activity] = await Promise.all([
    ouraGet('daily_sleep', apiKey, { start_date: dateKey, end_date: dateKey }),
    ouraGet('daily_readiness', apiKey, { start_date: dateKey, end_date: dateKey }),
    ouraGet('daily_activity', apiKey, { start_date: dateKey, end_date: dateKey }),
  ])
  return {
    sleepScore: sleep?.score ?? null,
    readinessScore: readiness?.score ?? null,
    activeCalories: activity?.active_calories ?? null,
    fetchedAt: Date.now(),
  }
}
