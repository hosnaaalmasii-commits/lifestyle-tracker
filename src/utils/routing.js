// Real travel times for appointments via OpenRouteService (free tier:
// 2000 routes + 1000 address lookups a day, no billing account — chosen
// over Google Maps for that reason). Bring-your-own-key, same trust model
// as the Oura/ElevenLabs keys: kept in its own localStorage slot, synced
// encrypted via secretSync, never in `data`/export. Called straight from
// the browser (ORS allows CORS).
//
// Optional layer on top of the day planner: without a key the AI estimate
// (smartDay.js) or the user's own number stays in place. Only travel the
// app is allowed to overwrite is touched — empty/0, AI-estimated, or an
// earlier route result — never a number the user typed or said.

import { secretChanged } from './secretSync'
import { toMin } from './dayReplan'

const KEY_STORAGE = 'lifestyle-tracker-ors-key'
const GEO_CACHE_STORAGE = 'lifestyle-tracker-ors-geocache'
const API = 'https://api.openrouteservice.org'

export const TRAVEL_MODES = [
  { value: 'driving-car', label: 'Auto' },
  { value: 'cycling-regular', label: 'Fiets' },
  { value: 'foot-walking', label: 'Lopen' },
]
export const DEFAULT_TRAVEL_MODE = 'driving-car'

// Consecutive appointments closer together than this are travelled between
// directly; with a longer gap the user is assumed to go home in between.
const DIRECT_GAP_MIN = 120

function read(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

export const getOrsKey = () => read(KEY_STORAGE)
export const hasOrsKey = () => !!getOrsKey()
export function setOrsKey(key) {
  const value = (key || '').trim()
  try { value ? localStorage.setItem(KEY_STORAGE, value) : localStorage.removeItem(KEY_STORAGE) } catch { /* private mode */ }
  secretChanged('ors', value)
}

export class RoutingError extends Error {}

async function explain(res) {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message || (typeof body?.error === 'string' ? body.error : '') || body?.message || ''
  } catch { /* not JSON */ }
  if (res.status === 401 || res.status === 403) return 'OpenRouteService weigert de sleutel — controleer hem in Instellingen.'
  if (res.status === 429) return 'OpenRouteService: daglimiet bereikt — reistijd wordt morgen weer berekend.'
  if (res.status === 404) return 'Geen route gevonden tussen deze plaatsen.'
  return `OpenRouteService-fout ${res.status}${detail ? `: ${detail}` : ''}`
}

async function orsGet(path, params) {
  const url = new URL(`${API}${path}`)
  url.searchParams.set('api_key', getOrsKey())
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new RoutingError('Kon OpenRouteService niet bereiken — ben je online?')
  }
  if (!res.ok) throw new RoutingError(await explain(res))
  return res.json()
}

// ---------------------------------------------------------------------------
// Address lookup, cached per device forever (addresses don't move).

function readGeoCache() {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_STORAGE) || '{}') } catch { return {} }
}
function writeGeoCache(cache) {
  try {
    const entries = Object.entries(cache)
    localStorage.setItem(GEO_CACHE_STORAGE, JSON.stringify(Object.fromEntries(entries.slice(-300))))
  } catch { /* full / private mode */ }
}

// → [lon, lat] or null when the place can't be found.
export async function geocode(text, focus = null) {
  const query = (text || '').trim()
  if (!query) return null
  const cacheKey = query.toLowerCase()
  const cache = readGeoCache()
  if (cache[cacheKey]) return cache[cacheKey]
  const params = { text: query, size: '1' }
  if (focus) {
    params['focus.point.lon'] = String(focus[0])
    params['focus.point.lat'] = String(focus[1])
  }
  const body = await orsGet('/geocode/search', params)
  const coords = body?.features?.[0]?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const point = [Number(coords[0]), Number(coords[1])]
  writeGeoCache({ ...readGeoCache(), [cacheKey]: point })
  return point
}

const routeCache = new Map()

// One-way travel time in whole minutes, rounded up to 5 (never below 5 —
// leaving, parking and walking in always take a few minutes).
export async function routeMinutes(from, to, mode = DEFAULT_TRAVEL_MODE) {
  const key = `${mode}|${from.join(',')}|${to.join(',')}`
  if (routeCache.has(key)) return routeCache.get(key)
  const body = await orsGet(`/v2/directions/${mode}`, { start: from.join(','), end: to.join(',') })
  const seconds = body?.features?.[0]?.properties?.summary?.duration
  if (typeof seconds !== 'number') throw new RoutingError('Geen route gevonden tussen deze plaatsen.')
  const minutes = Math.max(5, Math.ceil(seconds / 60 / 5) * 5)
  routeCache.set(key, minutes)
  return minutes
}

// ---------------------------------------------------------------------------
// Appointments

const HOME_WORDS = /^(thuis|huis|home|maison|zuhause|casa)$/i

// "gym" → the saved address of the place called "gym"; "thuis" → home.
export function resolveLocation(location, { home = '', places = [] } = {}) {
  const text = (location || '').trim()
  if (!text) return ''
  if (HOME_WORDS.test(text)) return home
  const lower = text.toLowerCase()
  const place = places.find((p) => p.name?.trim().toLowerCase() === lower)
  return place?.address || text
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '' || Number(v) === 0

// May the app (re)write this leg? Not when the user typed or said it.
function canFill(appt, field) {
  if (appt.travelSource === 'manual') return false
  return isBlank(appt[field]) || appt.travelEstimated || appt.travelSource === 'route'
}

/**
 * Fills travelBefore/travelAfter of every appointment with a location from
 * real routes: home → first → … → last → home, going home in between when
 * the gap between two appointments is long. Returns
 * { appointments, changed, longer, error } — `longer` is true when a route
 * came out longer than what was there (the plan may no longer fit),
 * `error` is a user-facing message when some legs couldn't be routed (those
 * keep their old value). Never throws.
 */
export async function fillRouteTravel(appointments, { home = '', places = [], mode = DEFAULT_TRAVEL_MODE } = {}) {
  const result = appointments.map((a) => ({ ...a }))
  if (!hasOrsKey()) return { appointments: result, changed: false, longer: false, error: null }

  let changed = false
  let longer = false
  let error = null
  const points = new Map() // resolved text → [lon, lat] | null

  try {
    const homePoint = home.trim() ? await geocode(home) : null
    const pointFor = async (location) => {
      const text = resolveLocation(location, { home, places })
      if (!text) return null
      if (!points.has(text)) points.set(text, text === home ? homePoint : await geocode(text, homePoint))
      return points.get(text)
    }

    const order = result
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.location?.trim())
      .sort((x, y) => x.a.start.localeCompare(y.a.start))

    const setLeg = async (appt, field, from, to) => {
      if (!canFill(appt, field)) return
      if (!from || !to) {
        if (!error) {
          error = !homePoint && (from === homePoint || to === homePoint)
            ? (home.trim() ? `Vertrekpunt "${home.trim()}" niet gevonden — probeer een volledig adres.` : 'Vul je vertrekpunt in om ook de reis van en naar huis te berekenen.')
            : 'Niet elke plaats kon gevonden worden — vul daar de reistijd zelf in.'
        }
        return
      }
      const minutes = from[0] === to[0] && from[1] === to[1] ? 0 : await routeMinutes(from, to, mode)
      const before = Number(appt[field]) || 0
      if (minutes !== before) changed = true
      if (minutes > before) longer = true
      appt[field] = String(minutes)
      appt.travelEstimated = false
      appt.travelSource = 'route'
    }

    for (let k = 0; k < order.length; k++) {
      const { a } = order[k]
      const prev = order[k - 1]?.a
      const next = order[k + 1]?.a
      const here = await pointFor(a.location)
      if (!here) { if (!error) error = `"${a.location}" niet gevonden — vul daar de reistijd zelf in.`; continue }
      const prevDirect = prev && toMin(a.start) - toMin(prev.end) < DIRECT_GAP_MIN
      const nextDirect = next && toMin(next.start) - toMin(a.end) < DIRECT_GAP_MIN
      const from = prevDirect ? await pointFor(prev.location) : homePoint
      const to = nextDirect ? await pointFor(next.location) : homePoint
      await setLeg(a, 'travelBefore', from, here)
      await setLeg(a, 'travelAfter', here, to)
    }
  } catch (e) {
    error = e instanceof RoutingError ? e.message : 'Reistijd berekenen mislukt.'
  }

  return { appointments: result, changed, longer, error }
}
