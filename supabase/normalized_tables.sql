-- supabase/normalized_tables.sql
-- Run this once in the Supabase Dashboard SQL Editor (Dashboard -> SQL
-- Editor -> New query -> paste this whole file -> Run), in the same
-- project as supabase/schema.sql. Purely additive: does not touch
-- app_data. Part 1 of 2 — plain (non-encrypted) per-log-type tables.
-- Part 2 (supabase/encrypted_tables.sql) adds weight/cycle/notes.

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  ml integer not null,
  unique (user_id, date)
);

create table sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  hours numeric not null,
  quality text,
  unique (user_id, date)
);

create table workout_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day text not null,
  exercises jsonb not null default '[]'::jsonb,
  rest boolean not null default false,
  unique (user_id, day)
);

create table workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  unique (user_id, date)
);

create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  exercise_name text not null,
  date date not null,
  weight numeric,
  reps integer,
  unique (user_id, client_id)
);

create table mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  emoji text not null,
  note text,
  unique (user_id, client_id)
);

create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  breakfast boolean not null default false,
  lunch boolean not null default false,
  dinner boolean not null default false,
  vegetables boolean not null default false,
  snacks boolean not null default false,
  unique (user_id, date)
);

create table budget_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  amount numeric not null,
  category text,
  note text,
  unique (user_id, client_id)
);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  time text,
  title text not null,
  note text,
  unique (user_id, client_id)
);

alter table water_logs enable row level security;
create policy "select own rows" on water_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on water_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on water_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on water_logs for delete using (auth.uid() = user_id);

alter table sleep_logs enable row level security;
create policy "select own rows" on sleep_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on sleep_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on sleep_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on sleep_logs for delete using (auth.uid() = user_id);

alter table workout_schedule enable row level security;
create policy "select own rows" on workout_schedule for select using (auth.uid() = user_id);
create policy "insert own rows" on workout_schedule for insert with check (auth.uid() = user_id);
create policy "update own rows" on workout_schedule for update using (auth.uid() = user_id);
create policy "delete own rows" on workout_schedule for delete using (auth.uid() = user_id);

alter table workout_completions enable row level security;
create policy "select own rows" on workout_completions for select using (auth.uid() = user_id);
create policy "insert own rows" on workout_completions for insert with check (auth.uid() = user_id);
create policy "update own rows" on workout_completions for update using (auth.uid() = user_id);
create policy "delete own rows" on workout_completions for delete using (auth.uid() = user_id);

alter table exercise_logs enable row level security;
create policy "select own rows" on exercise_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on exercise_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on exercise_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on exercise_logs for delete using (auth.uid() = user_id);

alter table mood_logs enable row level security;
create policy "select own rows" on mood_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on mood_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on mood_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on mood_logs for delete using (auth.uid() = user_id);

alter table nutrition_logs enable row level security;
create policy "select own rows" on nutrition_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on nutrition_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on nutrition_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on nutrition_logs for delete using (auth.uid() = user_id);

alter table budget_entries enable row level security;
create policy "select own rows" on budget_entries for select using (auth.uid() = user_id);
create policy "insert own rows" on budget_entries for insert with check (auth.uid() = user_id);
create policy "update own rows" on budget_entries for update using (auth.uid() = user_id);
create policy "delete own rows" on budget_entries for delete using (auth.uid() = user_id);

alter table schedule_items enable row level security;
create policy "select own rows" on schedule_items for select using (auth.uid() = user_id);
create policy "insert own rows" on schedule_items for insert with check (auth.uid() = user_id);
create policy "update own rows" on schedule_items for update using (auth.uid() = user_id);
create policy "delete own rows" on schedule_items for delete using (auth.uid() = user_id);
