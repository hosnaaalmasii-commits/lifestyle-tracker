// Runs on a pg_cron schedule (every minute, see supabase/push_notifications.sql
// cron setup). For every user with at least one push subscription, computes
// their local time from settings.timezone, finds today's tasks whose time
// matches "now", whose category has notifications enabled, that aren't
// already checked off, and that haven't already had a notification sent
// today (sent_task_notifications is the dedup marker) — and sends a Web
// Push notification for each to all of that user's subscribed devices.
//
// Deployed with JWT verification OFF (this function needs no caller auth —
// it's only ever invoked by pg_cron inside the same project) so no secret
// needs to be embedded in the cron job's SQL. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically by the Edge Runtime.
// VAPID_PRIVATE_KEY is the one secret that must be set manually (Dashboard
// → Edge Functions → send-due-notifications → Secrets) — never hardcoded
// here and never passed through automation, only entered by the project
// owner directly in the Supabase UI.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC_KEY = 'BCIrdZknLohRuIYK64oE0z5iqeH6vJtp_tGOZdlR4XM7O04eWEU-_KaM3DC5pCYdNf1KON2yqlq6G6sxS-ovHzQ'
const VAPID_CONTACT = 'mailto:hosnaa.almasii@gmail.com'

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function weekdayKeyInTz(timeZone) {
  const wd = new Date(new Date().toLocaleString('en-US', { timeZone })).getDay()
  return WEEKDAY_KEYS[(wd + 6) % 7]
}

function hhmmInTz(timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function dateKeyInTz(timeZone) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone }))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function categoryEnabled(notifyCategories, category) {
  if (!notifyCategories) return true
  // Composite categories like "eten+supplement" count as enabled if ANY
  // of their parts is enabled — matches how the app displays/edits them.
  return category.split('+').some((part) => notifyCategories[part] !== false)
}

Deno.serve(async () => {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, Deno.env.get('VAPID_PRIVATE_KEY'))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('*')
  if (subsError) return new Response(JSON.stringify({ error: subsError.message }), { status: 500 })
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, note: 'no subscriptions' }), { status: 200 })

  const userIds = [...new Set(subs.map((s) => s.user_id))]
  let sent = 0
  const errors = []

  for (const userId of userIds) {
    const { data: row, error: rowError } = await supabase
      .from('app_data')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle()
    if (rowError || !row) { if (rowError) errors.push(rowError.message); continue }

    const appData = row.data
    const timeZone = appData?.settings?.timezone || 'UTC'
    const day = weekdayKeyInTz(timeZone)
    const nowHHMM = hhmmInTz(timeZone)
    const today = dateKeyInTz(timeZone)

    const tasks = (appData?.taskSchedule?.[day] || []).filter((t) => t.time === nowHHMM)
    if (!tasks.length) continue

    const completionsToday = appData?.taskCompletions?.[today] || {}
    const notifyCategories = appData?.settings?.notifyCategories

    for (const task of tasks) {
      if (!task.notify) continue
      if (completionsToday[task.id]) continue
      if (!categoryEnabled(notifyCategories, task.category)) continue

      const { data: already } = await supabase
        .from('sent_task_notifications')
        .select('task_id')
        .eq('user_id', userId).eq('date', today).eq('task_id', task.id)
        .maybeSingle()
      if (already) continue

      const userSubs = subs.filter((s) => s.user_id === userId)
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: task.label, body: `${task.time} · ${task.category}` }),
          )
          sent += 1
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            errors.push(String(e))
          }
        }
      }

      await supabase.from('sent_task_notifications').insert({ user_id: userId, date: today, task_id: task.id })
    }
  }

  return new Response(JSON.stringify({ sent, errors }), { status: 200, headers: { 'content-type': 'application/json' } })
})
