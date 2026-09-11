-- Run this once in the Supabase Dashboard SQL Editor, in the same project
-- as supabase/schema.sql. Purely additive: does not touch app_data or any
-- other existing table.
--
-- Two tables:
--   push_subscriptions    one row per browser/device a user enabled push
--                         notifications on (the Web Push subscription).
--   sent_task_notifications  dedup marker so the once-a-minute cron never
--                         sends the same task's notification twice in one
--                         day, even if it stays "due" for several ticks.
--
-- Safe to re-run: every create table is `if not exists`, and every policy
-- is dropped before being recreated.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists "select own rows" on push_subscriptions;
create policy "select own rows" on push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "insert own rows" on push_subscriptions;
create policy "insert own rows" on push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "delete own rows" on push_subscriptions;
create policy "delete own rows" on push_subscriptions for delete using (auth.uid() = user_id);

-- No policies for anon/authenticated on the table below on purpose — only
-- the Edge Function (using the service_role key, which bypasses RLS
-- entirely) ever reads or writes it.
create table if not exists sent_task_notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  task_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, date, task_id)
);

alter table sent_task_notifications enable row level security;
