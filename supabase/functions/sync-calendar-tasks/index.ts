// Runs once a day via pg_cron (see supabase/calendar_auto_sync.sql) so
// Google Calendar sync happens automatically instead of needing the
// "Taken syncen naar agenda" button pressed from the app. For every user
// with a stored Google refresh token (google_calendar_tokens, written by
// google-oauth-exchange when they enable auto-sync in Settings), this:
//   1. exchanges the refresh token for a fresh ~1h access token
//   2. reads that user's app_data (taskSchedule + the existing event-id map)
//   3. creates/updates one Calendar event per task for the next 7 days
//   4. writes the updated event-id map back into app_data
//
// Mirrors src/utils/googleCalendar.js's client-side syncTasksToCalendar
// logic — kept as a small inline port rather than a shared import, since
// this Deno function can't pull in the Vite app's src/ modules directly.
//
// Deployed with JWT verification OFF, same reasoning as
// send-due-notifications: it's only ever invoked by pg_cron inside this
// project, so no secret needs to live in the cron job's SQL.
// GOOGLE_CLIENT_SECRET must be set (Dashboard → Edge Functions →
// sync-calendar-tasks → Secrets) — same value as google-oauth-exchange's.
//
// Whole-blob write caveat: like the rest of this app's Supabase sync, this
// overwrites app_data.data with a merged copy rather than patching just
// one field at the database level. Running once a day (not once a minute,
// like push notifications) keeps the odds of clobbering a concurrent edit
// from an open browser tab low, but it's the same accepted last-write-wins
// tradeoff documented for Cloud Sync generally — not a new risk this
// function introduces.

import { createClient } from 'npm:@supabase/supabase-js@2'

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DEFAULT_EVENT_MINUTES = 30
const SYNC_DAYS = 7

function addDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function todayKeyUTC() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function weekdayKeyForDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return WEEKDAY_KEYS[(jsDay + 6) % 7]
}

function getTasksForDate(taskSchedule, dateKey) {
  const day = weekdayKeyForDate(dateKey)
  return [...(taskSchedule?.[day] || [])].sort((a, b) => a.time.localeCompare(b.time))
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error_description || json.error || 'Token refresh failed')
  return json.access_token
}

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

async function upsertCalendarEvent(accessToken, task, dateKey, existingEventId) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const url = existingEventId ? `${base}/${existingEventId}` : base
  const response = await fetch(url, {
    method: existingEventId ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(taskEventBody(task, dateKey)),
  })
  if (response.status === 404 && existingEventId) return null
  if (!response.ok) throw new Error(`Calendar event request failed (${response.status})`)
  const event = await response.json()
  return event.id
}

Deno.serve(async () => {
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const { data: tokenRows, error: tokenError } = await supabase.from('google_calendar_tokens').select('*')
  if (tokenError) return new Response(JSON.stringify({ error: tokenError.message }), { status: 500 })
  if (!tokenRows?.length) return new Response(JSON.stringify({ synced: 0, note: 'no connected accounts' }), { status: 200 })

  let synced = 0
  const errors = []

  for (const row of tokenRows) {
    try {
      const { data: appRow, error: appError } = await supabase
        .from('app_data').select('data').eq('user_id', row.user_id).maybeSingle()
      if (appError || !appRow) { if (appError) errors.push(`${row.user_id}: ${appError.message}`); continue }

      const appData = appRow.data
      // A user who never opened the Client ID field still has this — the
      // Client ID isn't a secret, it's already sitting in their own
      // settings the same way it is in the browser.
      const clientId = appData?.settings?.googleClientId
      if (!clientId) { errors.push(`${row.user_id}: no googleClientId in settings`); continue }

      const accessToken = await refreshAccessToken(row.refresh_token, clientId, clientSecret)
      const existingIds = appData?.googleCalendarEventIds || {}
      const nextIds = { ...existingIds }
      const today = todayKeyUTC()

      for (let i = 0; i < SYNC_DAYS; i++) {
        const dateKey = addDaysToKey(today, i)
        const tasks = getTasksForDate(appData?.taskSchedule, dateKey)
        if (!tasks.length) continue
        nextIds[dateKey] = { ...nextIds[dateKey] }
        for (const task of tasks) {
          const eventId = await upsertCalendarEvent(accessToken, task, dateKey, existingIds[dateKey]?.[task.id])
          if (eventId) nextIds[dateKey][task.id] = eventId
        }
      }

      const { error: writeError } = await supabase
        .from('app_data')
        .update({ data: { ...appData, googleCalendarEventIds: nextIds } })
        .eq('user_id', row.user_id)
      if (writeError) { errors.push(`${row.user_id}: ${writeError.message}`); continue }

      synced += 1
    } catch (e) {
      errors.push(`${row.user_id}: ${e.message}`)
    }
  }

  return new Response(JSON.stringify({ synced, errors }), { status: 200, headers: { 'content-type': 'application/json' } })
})
