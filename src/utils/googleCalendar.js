// Client-side-only Google Calendar connection via Google Identity Services
// (GIS). Unlike the Anthropic key, a Google OAuth "Client ID" is meant to be
// public — it's restricted server-side by the authorized origins configured
// in Google Cloud Console, not by secrecy — so it's fine to store it in
// regular app data. The access token GIS returns is short-lived (~1 hour)
// and is kept in memory only (never localStorage): the app re-requests it,
// silently where possible, each time it's needed.

import { todayKey, addDaysToKey } from './dates'
import { getTasksForDate } from './taskSchedule'

// calendar.freebusy (existing, read-only "how busy is today") plus
// calendar.events (write access, scoped to events only — not the broader
// `calendar` scope, which would also grant calendar-management rights this
// app has no use for) so tasks can be pushed in as real agenda items.
// This project's own OAuth client (Google Cloud project "Lifestyle
// Tracker", Web application client, origin hosnaaalmasii-commits.github.io).
// Not a secret — Google restricts it by authorized origin — so it's the
// built-in default rather than something the user has to find and paste.
// A pasted value only overrides it when it actually looks like a client ID
// (a calendar URL was once pasted here by mistake, giving Google's
// "OAuth client was not found" 401).
export const DEFAULT_GOOGLE_CLIENT_ID = '465688798119-td67kk2kealvlj1gjdtj6snon20m0dbc.apps.googleusercontent.com'

export function isValidGoogleClientId(id) {
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test((id || '').trim())
}

export function resolveGoogleClientId(id) {
  return isValidGoogleClientId(id) ? id.trim() : DEFAULT_GOOGLE_CLIENT_ID
}

const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events'
let scriptPromise = null

function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google Identity Services.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Requests an access token, prompting the user for consent unless
 * `silent` is true (in which case it resolves to null instead of prompting
 * — used for a quiet reconnect attempt on app load).
 */
export async function requestGoogleToken(clientId, { silent = false } = {}) {
  await loadGisScript()
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            if (silent) resolve(null)
            else reject(new Error(response.error_description || response.error))
            return
          }
          resolve(response.access_token)
        },
        error_callback: () => {
          if (silent) resolve(null)
          else reject(new Error('Google sign-in was cancelled or blocked.'))
        },
      })
      client.requestAccessToken(silent ? { prompt: 'none' } : { prompt: 'consent' })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Requests a one-time authorization CODE (not an access token) via Google
 * Identity Services' popup code flow — this is the one Google interaction
 * that can produce a long-lived refresh token, which is what lets
 * automatic (cron-triggered, browser-closed) sync work at all; the plain
 * `requestGoogleToken` above only ever returns a short-lived access token
 * with no refresh token, by design of the simpler implicit flow it uses.
 * The returned code is single-use and must be exchanged server-side within
 * minutes (see google-oauth-exchange Edge Function) — the client secret
 * that exchange needs can never live in this browser code.
 */
export async function requestGoogleAuthCode(clientId) {
  await loadGisScript()
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: SCOPE,
        ux_mode: 'popup',
        callback: (response) => {
          if (response.error) { reject(new Error(response.error)); return }
          resolve(response.code)
        },
      })
      client.requestCode()
    } catch (e) {
      reject(e)
    }
  })
}

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayISO() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export async function fetchTodayBusyMinutes(accessToken) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      timeMin: startOfTodayISO(),
      timeMax: endOfTodayISO(),
      items: [{ id: 'primary' }],
    }),
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google session expired — reconnect in Settings.')
    throw new Error(`Calendar request failed (${response.status}).`)
  }
  const data = await response.json()
  const busy = data?.calendars?.primary?.busy || []
  const minutes = busy.reduce((sum, slot) => sum + (new Date(slot.end) - new Date(slot.start)) / 60000, 0)
  return Math.round(minutes)
}

// Reads one day's real agenda items (with location) so a day replan
// (dayReplan.js) can plan around them. Events this app pushed in itself
// via syncTasksToCalendar are filtered out by their description marker,
// otherwise the plan would end up "planning around" its own tasks. All-day
// events carry no clock time and don't block anything, so they're skipped.
export async function fetchEventsForDate(accessToken, dateKey) {
  const start = new Date(`${dateKey}T00:00:00`)
  const end = new Date(`${dateKey}T23:59:59`)
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google session expired — reconnect in Settings.')
    throw new Error(`Calendar request failed (${response.status}).`)
  }
  const body = await response.json()
  const hhmm = (iso) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return (body.items || [])
    .filter((e) => e.start?.dateTime && e.status !== 'cancelled' && !(e.description || '').startsWith('Lifestyle Tracker —'))
    .map((e) => ({ calendarEventId: e.id, title: e.summary || 'Afspraak', start: hhmm(e.start.dateTime), end: hhmm(e.end.dateTime), location: e.location || '' }))
}

// A 30-minute default duration for tasks — the schedule only carries a
// start time, not a duration, so this just needs to be long enough for the
// event to be visible/clickable in a normal calendar day view.
const DEFAULT_EVENT_MINUTES = 30

function taskEventBody(task, dateKey) {
  const start = new Date(`${dateKey}T${task.time}:00`)
  const end = new Date(start.getTime() + DEFAULT_EVENT_MINUTES * 60000)
  return {
    summary: task.label,
    description: `Lifestyle Tracker — ${task.category}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

// Creates the event if `existingEventId` is falsy, otherwise updates it in
// place — the caller is responsible for remembering which eventId belongs
// to which (dateKey, taskId) so a re-sync updates rather than duplicates.
// Returns the event id, or null if the event was deleted upstream (404) —
// the caller should then re-create it on the next sync.
export async function upsertCalendarEvent(accessToken, task, dateKey, existingEventId) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const url = existingEventId ? `${base}/${existingEventId}` : base
  const response = await fetch(url, {
    method: existingEventId ? 'PATCH' : 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(taskEventBody(task, dateKey)),
  })
  if (response.status === 404 && existingEventId) return null
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google session expired — reconnect in Settings.')
    throw new Error(`Calendar event request failed (${response.status}).`)
  }
  const event = await response.json()
  return event.id
}

// Expands the weekly task template into real dated events for the next
// `days` days (including today) and creates/updates one Google Calendar
// event per task. `existingIds` is the { [dateKey]: { [taskId]: eventId } }
// map from a previous sync (persisted in app data) so repeat syncs update
// in place instead of piling up duplicate events.
export async function syncTasksToCalendar(accessToken, taskSchedule, existingIds = {}, days = 7, dayOverrides = {}) {
  const nextIds = {}
  const errors = []

  for (let i = 0; i < days; i++) {
    const dateKey = addDaysToKey(todayKey(), i)
    const tasks = getTasksForDate(taskSchedule, dateKey, dayOverrides)
    if (!tasks.length) continue
    nextIds[dateKey] = {}
    for (const task of tasks) {
      try {
        const eventId = await upsertCalendarEvent(accessToken, task, dateKey, existingIds[dateKey]?.[task.id])
        if (eventId) nextIds[dateKey][task.id] = eventId
      } catch (e) {
        errors.push(`${dateKey} ${task.label}: ${e.message}`)
      }
    }
  }

  return { eventIds: nextIds, errors }
}
