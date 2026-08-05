# Normalized Supabase Schema, CRUD Layer, and Seed Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the app's single JSONB blob into per-log-type Postgres tables in the existing live Supabase project, with RLS-based IDOR-safe authorization, encrypted sensitive fields, a CRUD service layer, a safe backfill, and a seed script — without touching the existing `app_data` blob table or its sync path.

**Architecture:** Supabase-native. Twelve new tables (nine plain, three encrypted) live alongside `app_data`. Plain tables are queried directly through Supabase's auto-generated PostgREST API, gated by Row Level Security. The three encrypted tables (`weight_logs`, `cycle_logs`, `notes`) are only ever written/read through `security definer` Postgres RPC functions that hold the only path to the Vault-stored encryption key — the key never reaches the browser or any client code.

**Tech Stack:** Supabase (Postgres, Vault, pgcrypto, RLS, PostgREST), `@supabase/supabase-js` (already a dependency), plain Node scripts (no new dependencies — this repo has no `.env` loader or test framework, so scripts read `process.env` directly and verification is done via runnable SQL/Node checks, not a unit test suite).

## Global Constraints

- Never touch, alter, or drop `app_data` or its existing RLS policies — every change here is additive (per spec Goals #1 and #6).
- Every new table gets RLS enabled with the four-policy pattern (select/insert/update/delete scoped to `auth.uid() = user_id`) — no table ships without it (spec Goal #2).
- The encryption key for `weight_logs`, `cycle_logs`, `notes` must never be retrievable by the `anon` or `authenticated` Postgres roles, only by `security definer` functions running as the function owner (spec Goal #3).
- No script or service function may `console.log`/print full row payloads for `weight_logs`, `cycle_logs`, or `notes` — log operation/table names and counts only, never the data (spec "Security notes applied").
- The seed script must only ever be able to touch its own demo user's rows — never the real user's (spec Goal #5).
- No new npm dependency may be added without a stated reason — this repo's stated design principle is low-friction, minimal tooling (`CLAUDE.md`).

---

### Task 1: Plain (non-encrypted) tables and RLS

**Files:**
- Create: `supabase/normalized_tables.sql`

**Interfaces:**
- Produces: nine Postgres tables — `water_logs`, `sleep_logs`, `workout_schedule`, `workout_completions`, `exercise_logs`, `mood_logs`, `nutrition_logs`, `budget_entries`, `schedule_items` — each with RLS enabled and four policies. Later tasks query these directly via `@supabase/supabase-js`.

- [ ] **Step 1: Write the SQL file**

```sql
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
```

- [ ] **Step 2: Run it and verify**

Paste the file into the Supabase Dashboard's SQL Editor and run it. Then run this check in the same editor:

```sql
select table_name, count(policy.policyname) as policy_count
from information_schema.tables
left join pg_policies policy on policy.tablename = information_schema.tables.table_name
where information_schema.tables.table_schema = 'public'
  and information_schema.tables.table_name in (
    'water_logs', 'sleep_logs', 'workout_schedule', 'workout_completions',
    'exercise_logs', 'mood_logs', 'nutrition_logs', 'budget_entries', 'schedule_items'
  )
group by table_name;
```

Expected: 9 rows returned, every `policy_count` equal to 4.

- [ ] **Step 3: Commit**

```bash
git add supabase/normalized_tables.sql
git commit -m "Add normalized Postgres tables for plain log types, with RLS"
```

---

### Task 2: Encrypted tables, Vault key, and RPC functions

**Files:**
- Create: `supabase/encrypted_tables.sql`

**Interfaces:**
- Consumes: nothing from Task 1 (independent tables).
- Produces: three tables (`weight_logs`, `cycle_logs`, `notes`), a `private.vault_key()` helper, and six RPC functions: `insert_weight_log(p_kg numeric, p_date date, p_client_id text, p_user_id uuid default null) returns uuid`, `get_weight_logs(p_user_id uuid default null) returns table(id uuid, client_id text, date date, kg numeric)`, `insert_cycle_log(p_date date, p_flow text, p_symptoms text[], p_note text, p_client_id text, p_user_id uuid default null) returns uuid`, `get_cycle_logs(p_user_id uuid default null) returns table(id uuid, client_id text, date date, flow text, symptoms text[], note text)`, `insert_note(p_date date, p_text text, p_client_id text, p_user_id uuid default null) returns uuid`, `get_notes(p_user_id uuid default null) returns table(id uuid, client_id text, date date, text text, created_at timestamptz)`. Task 4 (encrypted service layer) and Tasks 5/6 (backfill/seed) call these by exact name.

- [ ] **Step 1: Write the SQL file**

```sql
-- supabase/encrypted_tables.sql
-- Run this once in the Supabase Dashboard SQL Editor, after
-- normalized_tables.sql. Adds the three tables holding genuinely
-- sensitive fields (body weight, cycle data, free-text notes) with
-- application-layer encryption: the key lives only in Supabase Vault,
-- never in the browser or in any table a client can read directly.

create extension if not exists pgcrypto;

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  kg_encrypted bytea not null,
  unique (user_id, client_id)
);

create table cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  flow_encrypted bytea,
  symptoms_encrypted bytea,
  note_encrypted bytea,
  unique (user_id, client_id)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  text_encrypted bytea not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- RLS stays on even though the normal path is through the RPCs below —
-- defense in depth. A direct select only ever exposes ciphertext.
alter table weight_logs enable row level security;
create policy "select own rows" on weight_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on weight_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on weight_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on weight_logs for delete using (auth.uid() = user_id);

alter table cycle_logs enable row level security;
create policy "select own rows" on cycle_logs for select using (auth.uid() = user_id);
create policy "insert own rows" on cycle_logs for insert with check (auth.uid() = user_id);
create policy "update own rows" on cycle_logs for update using (auth.uid() = user_id);
create policy "delete own rows" on cycle_logs for delete using (auth.uid() = user_id);

alter table notes enable row level security;
create policy "select own rows" on notes for select using (auth.uid() = user_id);
create policy "insert own rows" on notes for insert with check (auth.uid() = user_id);
create policy "update own rows" on notes for update using (auth.uid() = user_id);
create policy "delete own rows" on notes for delete using (auth.uid() = user_id);

-- The key: generated fresh, inside Postgres, right now — never appears
-- as a literal anywhere in this file, this repo, or any commit.
select vault.create_secret(
  encode(gen_random_bytes(32), 'base64'),
  'app_encryption_key',
  'Symmetric key for encrypting weight/cycle/notes fields at rest.'
);

-- Lives in a schema PostgREST never exposes, so it can't be called as
-- an RPC endpoint. Only callable from other security definer functions
-- owned by the same privileged role (e.g. postgres), never directly by
-- anon/authenticated.
create schema private;

create function private.vault_key()
returns text
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'app_encryption_key' limit 1;
$$;

revoke all on function private.vault_key() from public, anon, authenticated;

-- Each insert/get pair: authenticated callers always act as themselves
-- (auth.uid()) regardless of what p_user_id they pass; only a
-- service_role caller (the local backfill/seed scripts — never the
-- browser) may target an explicit p_user_id. This is what keeps a
-- security definer function, which otherwise bypasses RLS entirely,
-- IDOR-safe.

create function insert_weight_log(p_kg numeric, p_date date, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  insert into weight_logs (user_id, client_id, date, kg_encrypted)
  values (v_user_id, p_client_id, p_date, pgp_sym_encrypt(p_kg::text, private.vault_key()))
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from weight_logs where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_weight_log(numeric, date, text, uuid) from public, anon;
grant execute on function insert_weight_log(numeric, date, text, uuid) to authenticated, service_role;

create function get_weight_logs(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, kg numeric)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  return query
    select w.id, w.client_id, w.date, pgp_sym_decrypt(w.kg_encrypted, private.vault_key())::numeric
    from weight_logs w
    where w.user_id = v_user_id;
end;
$$;

revoke execute on function get_weight_logs(uuid) from public, anon;
grant execute on function get_weight_logs(uuid) to authenticated, service_role;

create function insert_cycle_log(p_date date, p_flow text, p_symptoms text[], p_note text, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  insert into cycle_logs (user_id, client_id, date, flow_encrypted, symptoms_encrypted, note_encrypted)
  values (
    v_user_id, p_client_id, p_date,
    case when p_flow is null then null else pgp_sym_encrypt(p_flow, private.vault_key()) end,
    pgp_sym_encrypt(coalesce(to_jsonb(p_symptoms)::text, '[]'), private.vault_key()),
    case when p_note is null then null else pgp_sym_encrypt(p_note, private.vault_key()) end
  )
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from cycle_logs where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_cycle_log(date, text, text[], text, text, uuid) from public, anon;
grant execute on function insert_cycle_log(date, text, text[], text, text, uuid) to authenticated, service_role;

create function get_cycle_logs(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, flow text, symptoms text[], note text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  return query
    select
      c.id, c.client_id, c.date,
      case when c.flow_encrypted is null then null else pgp_sym_decrypt(c.flow_encrypted, private.vault_key()) end,
      array(select jsonb_array_elements_text(pgp_sym_decrypt(c.symptoms_encrypted, private.vault_key())::jsonb)),
      case when c.note_encrypted is null then null else pgp_sym_decrypt(c.note_encrypted, private.vault_key()) end
    from cycle_logs c
    where c.user_id = v_user_id;
end;
$$;

revoke execute on function get_cycle_logs(uuid) from public, anon;
grant execute on function get_cycle_logs(uuid) to authenticated, service_role;

create function insert_note(p_date date, p_text text, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  insert into notes (user_id, client_id, date, text_encrypted)
  values (v_user_id, p_client_id, p_date, pgp_sym_encrypt(p_text, private.vault_key()))
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from notes where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_note(date, text, text, uuid) from public, anon;
grant execute on function insert_note(date, text, text, uuid) to authenticated, service_role;

create function get_notes(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, text text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if auth.role() = 'service_role' then
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'not authenticated';
    end if;
  end if;

  return query
    select n.id, n.client_id, n.date, pgp_sym_decrypt(n.text_encrypted, private.vault_key()), n.created_at
    from notes n
    where n.user_id = v_user_id;
end;
$$;

revoke execute on function get_notes(uuid) from public, anon;
grant execute on function get_notes(uuid) to authenticated, service_role;
```

- [ ] **Step 2: Run it and verify**

Paste into the Supabase Dashboard SQL Editor and run. Then verify all three tables got their four RLS policies, same shape as Task 1's check:

```sql
select table_name, count(policy.policyname) as policy_count
from information_schema.tables
left join pg_policies policy on policy.tablename = information_schema.tables.table_name
where information_schema.tables.table_schema = 'public'
  and information_schema.tables.table_name in ('weight_logs', 'cycle_logs', 'notes')
group by table_name;
```

Expected: 3 rows, every `policy_count` equal to 4.

Then verify the key is not readable by normal roles:

```sql
select has_function_privilege('authenticated', 'private.vault_key()', 'execute') as authenticated_can_call,
       has_function_privilege('anon', 'private.vault_key()', 'execute') as anon_can_call;
```

Expected: both `false`.

Then verify ciphertext storage — after Task 6 seeds at least one row, run:

```sql
select kg_encrypted from weight_logs limit 1;
```

Expected: an opaque `\x...` byte sequence, not a readable number.

- [ ] **Step 3: Commit**

```bash
git add supabase/encrypted_tables.sql
git commit -m "Add encrypted tables (weight, cycle, notes) with Vault-backed pgcrypto RPCs"
```

---

### Task 3: Plain CRUD service layer

**Files:**
- Create: `src/services/waterService.js`
- Create: `src/services/sleepService.js`
- Create: `src/services/workoutService.js`
- Create: `src/services/moodService.js`
- Create: `src/services/nutritionService.js`
- Create: `src/services/budgetService.js`
- Create: `src/services/scheduleService.js`

**Interfaces:**
- Consumes: `getSupabaseClient(url, anonKey)` from `src/utils/supabaseClient.js` (existing).
- Produces: functions taking `(url, anonKey, ...)` matching the calling convention already used by `src/utils/cloudSync.js`, each returning a Promise. Not wired into `AppContext.jsx` yet (see plan's non-goals) — Task 7 verifies these directly.

- [ ] **Step 1: Write `src/services/waterService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertWaterLog(url, anonKey, date, ml) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('water_logs')
    .upsert({ date, ml }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWaterLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('water_logs').select('id, date, ml').order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Write `src/services/sleepService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertSleepLog(url, anonKey, date, hours, quality) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert({ date, hours, quality }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listSleepLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('sleep_logs').select('id, date, hours, quality').order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 3: Write `src/services/workoutService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertWorkoutScheduleDay(url, anonKey, day, exercises, rest) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('workout_schedule')
    .upsert({ day, exercises, rest }, { onConflict: 'user_id,day' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWorkoutSchedule(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('workout_schedule').select('id, day, exercises, rest')
  if (error) throw error
  return data
}

export async function setWorkoutCompletion(url, anonKey, date, completed) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('workout_completions')
    .upsert({ date, completed }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWorkoutCompletions(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('workout_completions').select('id, date, completed').order('date')
  if (error) throw error
  return data
}

export async function addExerciseLog(url, anonKey, clientId, exerciseName, date, weight, reps) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(
      { client_id: clientId, exercise_name: exerciseName, date, weight, reps },
      { onConflict: 'user_id,client_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listExerciseLogs(url, anonKey, exerciseName) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, client_id, exercise_name, date, weight, reps')
    .eq('exercise_name', exerciseName)
    .order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Write `src/services/moodService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addMoodLog(url, anonKey, clientId, date, emoji, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('mood_logs')
    .upsert({ client_id: clientId, date, emoji, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listMoodLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('mood_logs').select('id, client_id, date, emoji, note').order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 5: Write `src/services/nutritionService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertNutritionLog(url, anonKey, date, item) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert({ date, ...item }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listNutritionLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('id, date, breakfast, lunch, dinner, vegetables, snacks')
    .order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 6: Write `src/services/budgetService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addBudgetEntry(url, anonKey, clientId, date, amount, category, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('budget_entries')
    .upsert({ client_id: clientId, date, amount, category, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listBudgetEntries(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('budget_entries')
    .select('id, client_id, date, amount, category, note')
    .order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 7: Write `src/services/scheduleService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addScheduleItem(url, anonKey, clientId, date, time, title, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .upsert({ client_id: clientId, date, time, title, note }, { onConflict: 'user_id,client_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listScheduleItems(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('schedule_items')
    .select('id, client_id, date, time, title, note')
    .order('date')
  if (error) throw error
  return data
}
```

- [ ] **Step 8: Verify the files load without syntax errors**

Run: `node --check src/services/waterService.js && node --check src/services/sleepService.js && node --check src/services/workoutService.js && node --check src/services/moodService.js && node --check src/services/nutritionService.js && node --check src/services/budgetService.js && node --check src/services/scheduleService.js`

Expected: no output, exit code 0 (`node --check` only parses, it doesn't need the import target to resolve).

- [ ] **Step 9: Commit**

```bash
git add src/services/waterService.js src/services/sleepService.js src/services/workoutService.js src/services/moodService.js src/services/nutritionService.js src/services/budgetService.js src/services/scheduleService.js
git commit -m "Add CRUD service layer for the nine plain normalized tables"
```

---

### Task 4: Encrypted CRUD service layer

**Files:**
- Create: `src/services/weightService.js`
- Create: `src/services/cycleService.js`
- Create: `src/services/notesService.js`

**Interfaces:**
- Consumes: the six RPC functions from Task 2, `getSupabaseClient` as above.
- Produces: same `(url, anonKey, ...)` calling convention as Task 3, but routes through `.rpc(...)` for reads/writes of the sensitive fields.

- [ ] **Step 1: Write `src/services/weightService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addWeightLog(url, anonKey, clientId, date, kg) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_weight_log', {
    p_kg: kg, p_date: date, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listWeightLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_weight_logs')
  if (error) throw error
  return data
}

export async function deleteWeightLog(url, anonKey, id) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('weight_logs').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Write `src/services/cycleService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addCycleLog(url, anonKey, clientId, date, flow, symptoms, note) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_cycle_log', {
    p_date: date, p_flow: flow || null, p_symptoms: symptoms || [], p_note: note || null, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listCycleLogs(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_cycle_logs')
  if (error) throw error
  return data
}

export async function deleteCycleLog(url, anonKey, id) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('cycle_logs').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 3: Write `src/services/notesService.js`**

```js
import { getSupabaseClient } from '../utils/supabaseClient'

export async function addNote(url, anonKey, clientId, date, text) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('insert_note', {
    p_date: date, p_text: text, p_client_id: clientId,
  })
  if (error) throw error
  return data
}

export async function listNotes(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.rpc('get_notes')
  if (error) throw error
  return data
}

export async function deleteNote(url, anonKey, id) {
  const supabase = getSupabaseClient(url, anonKey)
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Verify the files load without syntax errors**

Run: `node --check src/services/weightService.js && node --check src/services/cycleService.js && node --check src/services/notesService.js`

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/weightService.js src/services/cycleService.js src/services/notesService.js
git commit -m "Add CRUD service layer for encrypted tables (weight, cycle, notes)"
```

---

### Task 5: Backfill script

**Files:**
- Create: `scripts/backfillNormalizedTables.js`

**Interfaces:**
- Consumes: `@supabase/supabase-js` directly with a service-role key (not the app-facing service layer — kept separate on purpose so the browser-facing API surface never grows an admin-only `user_id` override parameter). Reads the existing `app_data` table.
- Produces: populated rows in all twelve new tables for every existing signed-in user, without modifying `app_data`.

- [ ] **Step 1: Write the script**

```js
// scripts/backfillNormalizedTables.js
// One-time, idempotent backfill from app_data (the whole-blob table) into
// the new normalized tables. Run locally only, with the service_role key
// (never commit this key):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfillNormalizedTables.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)

async function backfillUser(userId, data) {
  for (const [date, ml] of Object.entries(data.water || {})) {
    const { error } = await supabase.from('water_logs').upsert({ user_id: userId, date, ml }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`water_logs upsert failed: ${error.message}`)
  }

  for (const [date, sleep] of Object.entries(data.sleep || {})) {
    const { error } = await supabase
      .from('sleep_logs')
      .upsert({ user_id: userId, date, hours: sleep.hours, quality: sleep.quality }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`sleep_logs upsert failed: ${error.message}`)
  }

  for (const day of data.workouts?.schedule || []) {
    const { error } = await supabase
      .from('workout_schedule')
      .upsert({ user_id: userId, day: day.day, exercises: day.exercises, rest: !!day.rest }, { onConflict: 'user_id,day' })
    if (error) throw new Error(`workout_schedule upsert failed: ${error.message}`)
  }

  for (const [date, completed] of Object.entries(data.workouts?.completions || {})) {
    const { error } = await supabase
      .from('workout_completions')
      .upsert({ user_id: userId, date, completed: !!completed }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`workout_completions upsert failed: ${error.message}`)
  }

  for (const [exerciseName, logs] of Object.entries(data.workouts?.exerciseLogs || {})) {
    for (const log of logs) {
      const { error } = await supabase.from('exercise_logs').upsert(
        { user_id: userId, client_id: log.id, exercise_name: exerciseName, date: log.date, weight: log.weight, reps: log.reps },
        { onConflict: 'user_id,client_id' }
      )
      if (error) throw new Error(`exercise_logs upsert failed: ${error.message}`)
    }
  }

  for (const w of data.weight || []) {
    const { error } = await supabase.rpc('insert_weight_log', {
      p_kg: w.kg, p_date: w.date, p_client_id: w.id, p_user_id: userId,
    })
    if (error) throw new Error(`weight_logs insert failed: ${error.message}`)
  }

  for (const m of data.mood || []) {
    const { error } = await supabase
      .from('mood_logs')
      .upsert({ user_id: userId, client_id: m.id, date: m.date, emoji: m.emoji, note: m.note }, { onConflict: 'user_id,client_id' })
    if (error) throw new Error(`mood_logs upsert failed: ${error.message}`)
  }

  for (const [date, n] of Object.entries(data.nutrition || {})) {
    const { error } = await supabase.from('nutrition_logs').upsert(
      { user_id: userId, date, breakfast: !!n.breakfast, lunch: !!n.lunch, dinner: !!n.dinner, vegetables: !!n.vegetables, snacks: !!n.snacks },
      { onConflict: 'user_id,date' }
    )
    if (error) throw new Error(`nutrition_logs upsert failed: ${error.message}`)
  }

  for (const c of data.cycle || []) {
    const { error } = await supabase.rpc('insert_cycle_log', {
      p_date: c.date, p_flow: c.flow || null, p_symptoms: c.symptoms || [], p_note: c.note || null,
      p_client_id: c.id, p_user_id: userId,
    })
    if (error) throw new Error(`cycle_logs insert failed: ${error.message}`)
  }

  for (const b of data.budget || []) {
    const { error } = await supabase.from('budget_entries').upsert(
      { user_id: userId, client_id: b.id, date: b.date, amount: b.amount, category: b.category, note: b.note },
      { onConflict: 'user_id,client_id' }
    )
    if (error) throw new Error(`budget_entries upsert failed: ${error.message}`)
  }

  for (const s of data.schedule || []) {
    const { error } = await supabase.from('schedule_items').upsert(
      { user_id: userId, client_id: s.id, date: s.date, time: s.time, title: s.title, note: s.note },
      { onConflict: 'user_id,client_id' }
    )
    if (error) throw new Error(`schedule_items upsert failed: ${error.message}`)
  }

  for (const n of data.notes || []) {
    const { error } = await supabase.rpc('insert_note', {
      p_date: n.date, p_text: n.text, p_client_id: n.id, p_user_id: userId,
    })
    if (error) throw new Error(`notes insert failed: ${error.message}`)
  }
}

async function main() {
  const { data: rows, error } = await supabase.from('app_data').select('user_id, data')
  if (error) throw error

  for (const row of rows) {
    console.log(`Backfilling user ${row.user_id}...`)
    await backfillUser(row.user_id, row.data)
  }

  console.log(`Done. Backfilled ${rows.length} user(s).`)
}

main().catch((err) => {
  console.error('Backfill failed:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Verify against the real live project**

Run (with the real Supabase project's URL and service role key, both from the Supabase Dashboard -> Project Settings -> API):

```bash
SUPABASE_URL=<your-project-url> SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> node scripts/backfillNormalizedTables.js
```

Expected output ends with `Done. Backfilled 1 user(s).` and no thrown error. Then, in the SQL Editor, spot-check row counts against the known blob, e.g. `select count(*) from budget_entries;` should match the number of entries in that one user's `data.budget` array.

- [ ] **Step 3: Re-run to confirm idempotency**

Run the exact same command again.

Expected: same `Done. Backfilled 1 user(s).` output, no errors, and row counts from Step 2's spot-check are unchanged (no duplicates).

- [ ] **Step 4: Commit**

```bash
git add scripts/backfillNormalizedTables.js
git commit -m "Add idempotent backfill script from app_data into normalized tables"
```

---

### Task 6: Seed script for a demo user

**Files:**
- Create: `scripts/seedDemoUser.js`

**Interfaces:**
- Consumes: `@supabase/supabase-js` with the service-role key, `supabase.auth.admin.createUser` (Supabase admin API), the same table/RPC names as Task 5.
- Produces: one auth user (`seed-demo@lifestyle-tracker.test`) with 14 days of data across all twelve tables, safe to re-run.

- [ ] **Step 1: Write the script**

```js
// scripts/seedDemoUser.js
// Creates (or reuses) one clearly-fake demo user in the SAME live
// Supabase project, and seeds 14 days of realistic sample data across
// every normalized table. RLS makes it structurally impossible for this
// to touch any other user's rows, even if run incorrectly, since every
// insert targets only the demo user's own id. Run locally with the
// service_role key (never commit it):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seedDemoUser.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)
const DEMO_EMAIL = 'seed-demo@lifestyle-tracker.test'
const DAYS = 14

function dateKeyDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function getOrCreateDemoUser() {
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError
  const found = existing.users.find((u) => u.email === DEMO_EMAIL)
  if (found) return found.id

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function seed(userId) {
  const exerciseName = 'Push-up'

  for (let i = 0; i < DAYS; i++) {
    const date = dateKeyDaysAgo(i)

    await supabase.from('water_logs').upsert({ user_id: userId, date, ml: 1500 + (i % 5) * 100 }, { onConflict: 'user_id,date' })
    await supabase.from('sleep_logs').upsert({ user_id: userId, date, hours: 6.5 + (i % 3) * 0.5, quality: i % 2 === 0 ? 'good' : 'okay' }, { onConflict: 'user_id,date' })
    await supabase.from('workout_completions').upsert({ user_id: userId, date, completed: i % 2 === 0 }, { onConflict: 'user_id,date' })
    await supabase.from('nutrition_logs').upsert(
      { user_id: userId, date, breakfast: true, lunch: true, dinner: true, vegetables: i % 2 === 0, snacks: i % 3 === 0 },
      { onConflict: 'user_id,date' }
    )

    const { error: weightError } = await supabase.rpc('insert_weight_log', {
      p_kg: 68 + (i % 4) * 0.2, p_date: date, p_client_id: `seed-weight-${i}`, p_user_id: userId,
    })
    if (weightError) throw new Error(`weight seed failed: ${weightError.message}`)

    const { error: moodError } = await supabase.from('mood_logs').upsert(
      { user_id: userId, client_id: `seed-mood-${i}`, date, emoji: i % 3 === 0 ? '😞' : '🙂', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (moodError) throw new Error(`mood seed failed: ${moodError.message}`)

    const { error: exerciseError } = await supabase.from('exercise_logs').upsert(
      { user_id: userId, client_id: `seed-exercise-${i}`, exercise_name: exerciseName, date, weight: null, reps: 12 + (i % 5) },
      { onConflict: 'user_id,client_id' }
    )
    if (exerciseError) throw new Error(`exercise_logs seed failed: ${exerciseError.message}`)

    const { error: budgetError } = await supabase.from('budget_entries').upsert(
      { user_id: userId, client_id: `seed-budget-${i}`, date, amount: 8 + (i % 6), category: 'food', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (budgetError) throw new Error(`budget_entries seed failed: ${budgetError.message}`)

    const { error: scheduleError } = await supabase.from('schedule_items').upsert(
      { user_id: userId, client_id: `seed-schedule-${i}`, date, time: '09:00', title: 'Morning check-in', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (scheduleError) throw new Error(`schedule_items seed failed: ${scheduleError.message}`)

    const { error: noteError } = await supabase.rpc('insert_note', {
      p_date: date, p_text: `Demo note for day ${i}`, p_client_id: `seed-note-${i}`, p_user_id: userId,
    })
    if (noteError) throw new Error(`notes seed failed: ${noteError.message}`)

    if (i % 5 === 0) {
      const { error: cycleError } = await supabase.rpc('insert_cycle_log', {
        p_date: date, p_flow: 'light', p_symptoms: ['cramps'], p_note: null,
        p_client_id: `seed-cycle-${i}`, p_user_id: userId,
      })
      if (cycleError) throw new Error(`cycle_logs seed failed: ${cycleError.message}`)
    }
  }

  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  for (const [idx, day] of weekdays.entries()) {
    const rest = idx >= 5
    await supabase.from('workout_schedule').upsert(
      { user_id: userId, day, rest, exercises: rest ? [] : [{ name: exerciseName, sets: 3, reps: '12' }] },
      { onConflict: 'user_id,day' }
    )
  }
}

async function main() {
  const userId = await getOrCreateDemoUser()
  console.log(`Seeding demo user ${userId}...`)
  await seed(userId)
  console.log(`Done. Seeded ${DAYS} days of data for ${DEMO_EMAIL}.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run it**

```bash
SUPABASE_URL=<your-project-url> SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> node scripts/seedDemoUser.js
```

Expected output ends with `Done. Seeded 14 days of data for seed-demo@lifestyle-tracker.test.` and no thrown error.

- [ ] **Step 3: Verify every log type got data**

In the SQL Editor, run (replace `<demo-user-id>` with the id printed in Step 2's log):

```sql
select 'water' as t, count(*) from water_logs where user_id = '<demo-user-id>'
union all select 'sleep', count(*) from sleep_logs where user_id = '<demo-user-id>'
union all select 'workout_schedule', count(*) from workout_schedule where user_id = '<demo-user-id>'
union all select 'workout_completions', count(*) from workout_completions where user_id = '<demo-user-id>'
union all select 'exercise_logs', count(*) from exercise_logs where user_id = '<demo-user-id>'
union all select 'weight', count(*) from weight_logs where user_id = '<demo-user-id>'
union all select 'mood', count(*) from mood_logs where user_id = '<demo-user-id>'
union all select 'nutrition', count(*) from nutrition_logs where user_id = '<demo-user-id>'
union all select 'cycle', count(*) from cycle_logs where user_id = '<demo-user-id>'
union all select 'budget', count(*) from budget_entries where user_id = '<demo-user-id>'
union all select 'schedule', count(*) from schedule_items where user_id = '<demo-user-id>'
union all select 'notes', count(*) from notes where user_id = '<demo-user-id>';
```

Expected: every row's count > 0 (12 rows total, one per log type — `workout_schedule` will show 7, `cycle` will show 3 given the `i % 5 === 0` pattern over 14 days, everything else 14).

- [ ] **Step 4: Re-run to confirm idempotency**

Run the exact same command from Step 2 again, then re-run Step 3's query.

Expected: identical counts — no duplicates, no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedDemoUser.js
git commit -m "Add seed script for a 14-day demo user, isolated by RLS"
```

---

### Task 7: End-to-end verification against acceptance criteria

**Files:**
- Create: `scripts/verifyRlsIsolation.js`

**Interfaces:**
- Consumes: the anon key (not service role) plus the demo user's credentials, to prove RLS isolation from the client's actual vantage point rather than the trusted service-role vantage point used everywhere else in this plan.

- [ ] **Step 1: Write an RLS isolation check**

```js
// scripts/verifyRlsIsolation.js
// Signs in as the demo user with the ANON key (the same trust level the
// real app uses) and confirms a query returns only that user's own rows
// — proving RLS isolation from the client's actual vantage point, not
// the trusted service-role vantage point used by the seed/backfill
// scripts. Requires the demo user's password; since seedDemoUser.js
// generates a random one, pass it via env when seeding differently, or
// reset it once via the Dashboard for this one manual check.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/verifyRlsIsolation.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD
if (!url || !anonKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and DEMO_PASSWORD before running.')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

async function main() {
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'seed-demo@lifestyle-tracker.test',
    password,
  })
  if (signInError) throw signInError

  const demoUserId = signIn.user.id
  const { data: rows, error } = await supabase.from('water_logs').select('user_id')
  if (error) throw error

  const foreignRows = rows.filter((r) => r.user_id !== demoUserId)
  if (foreignRows.length > 0) {
    console.error(`RLS FAILURE: saw ${foreignRows.length} row(s) not owned by the demo user.`)
    process.exit(1)
  }
  console.log(`RLS isolation confirmed: all ${rows.length} visible row(s) belong to the demo user.`)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Set a known password for the demo user, then run it**

In the Supabase Dashboard (Authentication -> Users -> find `seed-demo@lifestyle-tracker.test` -> reset password), set a temporary known password, then:

```bash
SUPABASE_URL=<your-project-url> SUPABASE_ANON_KEY=<your-anon-key> DEMO_PASSWORD=<the-temp-password> node scripts/verifyRlsIsolation.js
```

Expected: `RLS isolation confirmed: all N visible row(s) belong to the demo user.`

- [ ] **Step 3: Verify least-privilege DB roles**

In the SQL Editor:

```sql
select rolname, rolsuper, rolcreatedb, rolcreaterole
from pg_roles
where rolname in ('anon', 'authenticated');
```

Expected: `rolsuper`, `rolcreatedb`, and `rolcreaterole` are all `false` for both rows — confirms this migration never granted elevated rights to the roles the app actually uses.

- [ ] **Step 4: Re-confirm the full acceptance list**

Go through the design spec's acceptance criteria one by one and confirm each against what Tasks 1-7 actually produced: twelve tables with RLS (Task 1 + 2 Step 2 query), ciphertext-only encrypted columns (Task 2 Step 2), backfill matches the real user without touching `app_data` (Task 5), seed script covers every log type and is idempotent (Task 6), RLS isolation (this task's Step 2).

- [ ] **Step 5: Commit**

```bash
git add scripts/verifyRlsIsolation.js
git commit -m "Add RLS isolation verification script"
```
