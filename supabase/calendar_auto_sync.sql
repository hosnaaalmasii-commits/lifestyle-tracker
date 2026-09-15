-- Run this once in the Supabase Dashboard SQL Editor, same project as
-- schema.sql and push_notifications.sql. Purely additive.
--
-- google_calendar_tokens: one row per user who enabled automatic Calendar
-- sync (More → Settings → Google Calendar → "Enable automatic sync"),
-- holding the Google refresh token that lets sync-calendar-tasks mint
-- fresh access tokens without the user's browser being open. Written only
-- by the google-oauth-exchange Edge Function (service_role, bypasses RLS)
-- — no anon/authenticated policies on purpose, same reasoning as
-- sent_task_notifications in push_notifications.sql: only Edge Functions
-- running with the service role ever touch this table.
--
-- Safe to re-run: create table is `if not exists`.

create table if not exists google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table google_calendar_tokens enable row level security;

-- The one client-facing policy: a signed-in user can delete their own row
-- to turn automatic sync back off (googleCalendar.js's
-- disableCalendarAutoSync calls this directly through the normal
-- supabase-js client, which respects RLS — no Edge Function needed for a
-- user revoking their own connection). No select/insert/update policy on
-- purpose: writing the refresh token itself only ever happens through
-- google-oauth-exchange's service-role client, which bypasses RLS.
drop policy if exists "delete own row" on google_calendar_tokens;
create policy "delete own row" on google_calendar_tokens for delete using (auth.uid() = user_id);

-- Once a day is plenty for a 7-day-ahead sync — not once a minute like
-- push notifications, which keeps this well within Google's Calendar API
-- rate limits and minimizes the whole-blob-write race window against a
-- device actively using the app (see sync-calendar-tasks/index.ts).
-- URL is the project's own functions endpoint, same literal-hardcoded
-- pattern as the existing send-due-notifications-every-minute cron job
-- (checked directly in cron.job — not a secret, same trust model as the
-- project ref itself, which is already public in this app's URLs).
select cron.schedule(
  'sync-calendar-tasks-daily',
  '17 6 * * *', -- 06:17 UTC daily — an off-the-hour minute, same idea as avoiding the exact top-of-hour crowd
  $$
  select net.http_post(
    url := 'https://lsxyejppowqdtcchzhjt.supabase.co/functions/v1/sync-calendar-tasks',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
