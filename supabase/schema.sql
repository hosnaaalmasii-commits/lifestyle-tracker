-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL
-- Editor -> New query -> paste this whole file -> Run) to set up cross-
-- device sync for Lifestyle Tracker. One row per signed-in user, holding
-- the same JSON blob the app already keeps in this browser's local storage.

create table if not exists app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

create policy "Users can view their own data"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on app_data for update
  using (auth.uid() = user_id);
