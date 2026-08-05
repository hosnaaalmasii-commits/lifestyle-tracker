# Normalized Supabase Schema, CRUD Layer, and Seed Script

Status: approved by user, pending final spec review
Date: 2026-08-05

## Context

Lifestyle Tracker is client-side only by deliberate prior decision (see
`CLAUDE.md`): no hand-written server, all data in one `localStorage` blob,
optionally synced cross-device via the user's own Supabase project as a
single `app_data` row (`user_id`, `data jsonb`, `updated_at`) with
whole-blob, last-write-wins sync (`supabase/schema.sql`, `cloudSync.js`).
That project is live today with one real, confirmed user account.

This chapter was requested from an external multi-chapter app-build spec
(referred to in that spec as "Vitara") that assumes a from-scratch backend
with a normalized relational schema, a CRUD service layer, authenticated
API endpoints with IDOR-safe authorization, encrypted sensitive fields, a
seed script, and rate limiting on AI-backed calls. The spec's own "Data
Model" section was never actually supplied in this conversation — only
referenced as "above" — so the schema below is derived directly from the
data shapes already live in `src/context/AppContext.jsx`.

Two architectural paths were considered:

- **Hand-rolled server** (Node/Express + its own Postgres/Prisma, hosted
  separately) — matches the literal wording of the external spec, but
  reverses this project's explicit, reasoned prior decision to avoid a
  custom backend, and adds a second service to host and patch.
- **Supabase-native** (normalized Postgres tables in the project already
  running, RLS for authorization, Edge Functions for anything needing a
  server-held secret) — chosen. It satisfies every real requirement
  (normalized schema, real CRUD, authenticated endpoints, IDOR-safety,
  encryption, rate limiting) without adding new infrastructure or
  contradicting the "managed/BYOK over custom servers" principle this
  project has followed throughout.

The user confirmed: build this into the existing Lifestyle Tracker repo,
using the Supabase-native approach.

## Goals

1. Normalize the current single JSONB blob into per-log-type Postgres
   tables, without touching or removing the existing `app_data` table.
2. Give every new table row-level-security policies that make
   unauthorized access (IDOR) structurally impossible, not just checked.
3. Encrypt genuinely sensitive fields (cycle data, body weight, health
   notes) at rest, with the encryption key never reaching the browser.
4. Add a thin client-side CRUD service layer over the new tables,
   following the existing per-feature module pattern in this codebase.
5. Provide a seed script that populates one clearly-fake demo user with
   14 days of realistic data across every log type, in the same live
   Supabase project, fully isolated from the real user by RLS.
6. Leave a safe, additive migration path — nothing destructive, nothing
   that can't be backed out of.

## Scope of "every log type"

`AppContext.jsx` actually holds more categories than the twelve tables
below: `photos`, `habitContracts`, `painLog`, `motivationFlags`, and the
derived `character` state. This chapter's schema and seed script cover
the twelve tables that are genuine per-entry logs matching the external
spec's own categories (meal/drink → nutrition + water, mood, workout,
cycle, schedule, budget) plus weight, sleep, and notes. Excluded, with
reasons:

- **`photos`**: binary image data belongs in Supabase Storage, not a
  relational table — a different mechanism, out of scope here.
- **`habitContracts`, `painLog`, `motivationFlags`**: lightweight
  scratch/input state for existing derived features (workout tier
  suggestions, comeback mode), not user-facing "logs" in the same sense
  as the twelve above. Listed under Open follow-ups rather than silently
  dropped.
- **`character`**: already explicitly "derived, not stored" per
  `CLAUDE.md` — recomputed from the other logs, never persisted, so it
  has no table by design, in either the blob or here.

## Non-goals (this chapter)

- No new user-facing UI or feature — this chapter is schema/backend only.
  The general "build backend and frontend together" instruction from the
  external spec applies across chapters as features are added on top of
  this schema (e.g. a later cycle-coaching enhancement); it doesn't imply
  new UI belongs in this foundational chapter.
- No change to how the Claude API key is handled (still BYOK, direct
  browser fetch) — moving AI calls through an Edge Function for rate
  limiting is real future work but out of scope here, since this chapter
  is schema/CRUD/seed only.
- No cutover of the app's read/write path from `app_data` to the new
  tables yet — that's a follow-up chapter once the normalized tables are
  verified against the backfill.

## Schema

New tables, all with `id uuid primary key default gen_random_uuid()`,
`user_id uuid not null references auth.users(id) on delete cascade`, and
RLS enabled with select/insert/update/delete policies scoped to
`auth.uid() = user_id` (mirroring `app_data`'s existing policies):

- **`water_logs`**: `date date not null`, `ml integer not null`. One row
  per user per date (upsert on `(user_id, date)`), matching the current
  `water: { [dateKey]: totalMl }` shape.
- **`sleep_logs`**: `date date not null`, `hours numeric not null`,
  `quality text`. Unique on `(user_id, date)`.
- **`workout_schedule`**: `day text not null` (weekday short code),
  `exercises jsonb not null`, `rest boolean not null default false`.
  Kept as JSONB for the exercise list itself — exercises are a nested,
  variable-shape array (`name`, `sets`, `reps`, `region`, `custom`), and
  normalizing that further isn't needed for this chapter's goals.
- **`workout_completions`**: `date date not null`, `completed boolean not
  null default true`. Unique on `(user_id, date)`.
- **`exercise_logs`** (PRs): `exercise_name text not null`, `date date not
  null`, `weight numeric`, `reps integer`.
- **`weight_logs`** *(encrypted)*: `date date not null`, `kg_encrypted
  bytea not null`.
- **`mood_logs`**: `date date not null`, `emoji text not null`, `note
  text`.
- **`nutrition_logs`**: `date date not null`, `breakfast boolean`,
  `lunch boolean`, `dinner boolean`, `vegetables boolean`, `snacks
  boolean`. Unique on `(user_id, date)`.
- **`cycle_logs`** *(encrypted)*: `date date not null`, `flow_encrypted
  bytea`, `symptoms_encrypted bytea`, `note_encrypted bytea`.
- **`budget_entries`**: `date date not null`, `amount numeric not null`,
  `category text`, `note text`.
- **`schedule_items`**: `date date not null`, `time text`, `text text
  not null` — matching the app's real schedule entry shape
  (`{ id, date, time, text }`); there is no separate title/note split.
- **`notes`** *(encrypted, since free-text notes are the voice-logging
  catch-all and may contain health content)*: `date date not null`,
  `text_encrypted bytea not null`, `created_at timestamptz not null
  default now()`.

The existing `app_data` table and its RLS policies are left completely
untouched by this chapter's migration.

## Authorization (IDOR-safety)

Every new table gets the same three-policy RLS pattern already
established for `app_data`:

```sql
alter table <table> enable row level security;

create policy "select own rows" on <table> for select using (auth.uid() = user_id);
create policy "insert own rows" on <table> for insert with check (auth.uid() = user_id);
create policy "update own rows" on <table> for update using (auth.uid() = user_id);
create policy "delete own rows" on <table> for delete using (auth.uid() = user_id);
```

This is what makes access IDOR-safe: PostgREST (Supabase's
auto-generated authenticated API layer) enforces these policies on every
request regardless of what the client sends, so there's no
application-level authorization check to write, forget, or get wrong.

**Exception — the three encrypted tables** (`weight_logs`, `cycle_logs`,
`notes`) deliberately get only the `select` and `delete` policies, not
`insert`/`update`. All writes to them must go through the security
definer RPCs below, which are the only thing that produces correctly
formed ciphertext; a direct client insert could write arbitrary bytes
into an `*_encrypted` column, after which `pgp_sym_decrypt` would throw
and make that user's whole list unreadable. Direct `select` stays
allowed because it only ever exposes ciphertext, and `delete` stays
allowed because the service layer deletes rows directly and a delete
can't corrupt anything.

## Encrypted fields

`weight_logs`, `cycle_logs`, and `notes` hold the fields the external
spec called out as sensitive (body weight, cycle data, health notes). A
symmetric key kept in the browser would be exactly as extractable as an
embedded API key would be (`CLAUDE.md` already established this
principle for the Anthropic key) — so the key must never reach the
client.

Approach: **Supabase Vault** stores the encryption key server-side.
Two `security definer` Postgres RPC functions per encrypted table handle
encrypt-on-write and decrypt-on-read using `pgcrypto`'s
`pgp_sym_encrypt`/`pgp_sym_decrypt` with the Vault-held key, e.g.:

```sql
create function insert_weight_log(p_date date, p_kg numeric)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into weight_logs (user_id, date, kg_encrypted)
  values (auth.uid(), p_date, pgp_sym_encrypt(p_kg::text, vault_key()))
  returning id into v_id;
  return v_id;
end; $$;

create function get_weight_logs()
returns table(id uuid, date date, kg numeric) language plpgsql security definer as $$
begin
  return query
  select w.id, w.date, pgp_sym_decrypt(w.kg_encrypted, vault_key())::numeric
  from weight_logs w where w.user_id = auth.uid();
end; $$;
```

(`vault_key()` is a small helper reading the key from
`vault.decrypted_secrets` — defined once, reused by all three tables'
functions.) The client-side service layer calls these RPCs
(`supabase.rpc(...)`) for the three encrypted tables instead of querying
the tables directly; every other table uses plain PostgREST CRUD.
Trade-off worth naming: encrypted columns aren't filterable/sortable by
Postgres directly (e.g. no `order by kg`), which is fine here since all
current sorting/filtering on these fields already happens client-side
after fetch.

## Migration & backfill (additive, reversible)

1. A single new migration file creates all twelve tables, their RLS
   policies, the Vault key, and the six RPC functions. Purely additive —
   no `alter`/`drop` touches `app_data`.
2. A one-time, idempotent backfill script (run manually, not on app
   load) reads each signed-in user's current `app_data.data` blob and
   inserts corresponding rows into the new tables (via the RPCs for the
   three encrypted tables). The blob's own per-entry ids (from `makeId()`
   in `AppContext.jsx`) aren't valid Postgres `uuid` values, so
   array-shaped tables (everything except the date-keyed dictionaries —
   water/sleep/nutrition/workout-completions) carry an additional
   `client_id text` column holding that original blob id, unique per
   `(user_id, client_id)`. That's what makes the backfill idempotent via
   `on conflict (user_id, client_id) do nothing` — re-running it is safe.
3. `app_data` remains the live source of truth for the app's actual
   read/write path through this chapter — cutting the app itself over to
   read/write the normalized tables instead is explicitly a later
   chapter, once the backfilled data has been spot-checked.

This means: nothing destructive happens, nothing is removed, and the
existing sync mechanism keeps working exactly as it does today for the
duration of this chapter.

## CRUD service layer

New `src/services/` modules, one per table family (e.g.
`waterService.js`, `cycleService.js`), each a thin wrapper over
`supabase-js` (`.from(...).select/insert/update/delete` for plain
tables, `.rpc(...)` for the three encrypted tables). These aren't wired
into `AppContext.jsx`'s read/write path yet (see Non-goals) — this
chapter delivers the service layer and verifies it against the seed data
directly, so the cutover chapter has a tested layer to wire in.

## Seed script

A Node script (`scripts/seedDemoUser.js`, run locally with the
project's `service_role` key via an env var, never committed) that:

1. Creates (or reuses) one auth user, email
   `seed-demo@lifestyle-tracker.test`, in the same live Supabase project.
2. Inserts 14 days of realistic sample data across all twelve tables for
   that user only — via the plain CRUD path for normal tables and via
   the RPCs for the three encrypted tables, so the seed script doubles
   as the first real exercise of the encryption path.
3. Is safe to re-run (idempotent) and only ever touches rows owned by
   that one demo user. Note that this is a property of the script's own
   discipline — every write explicitly targets the demo user's id from
   `getOrCreateDemoUser()` — and **not** something the database
   enforces: the script authenticates with the `service_role` key, which
   bypasses RLS entirely by design. RLS is not a backstop here.

## Security notes applied

- **DB roles**: no change needed — Supabase's `anon`/`authenticated`
  roles used by the client already carry no schema-drop or superuser
  rights; only RLS-gated row access. The `service_role` key (which
  bypasses RLS) is used only by the local seed script, never shipped to
  the client.
- **No logging of health data**: the new service layer and seed script
  must not `console.log` full row payloads for `weight_logs`,
  `cycle_logs`, or `notes` — errors should log the table/operation name
  only, not the data.
- **Additive/reversible migrations**: satisfied by construction (see
  Migration & backfill above) — every statement is a `create`, nothing
  is dropped or altered.

## Acceptance criteria (this chapter)

- [ ] All twelve tables exist with RLS enabled and the four-policy
      pattern applied.
- [ ] The three encrypted tables store only ciphertext in their
      `*_encrypted` columns — verified by querying the raw column
      directly and confirming it isn't plaintext.
- [ ] The backfill script runs against the existing real user's
      `app_data` blob and produces matching rows in the new tables,
      without modifying `app_data`.
- [ ] The seed script creates the demo user and produces valid,
      realistic data for every one of the twelve tables/log types.
- [ ] Re-running the seed script does not duplicate or error.
- [ ] A quick RLS check confirms the demo user cannot read the real
      user's rows (or vice versa) via the CRUD service layer.

## Open follow-ups (explicitly not this chapter)

- Tables for `habitContracts`, `painLog`, and `motivationFlags`, and a
  Storage bucket + policy for `photos`, if cross-device sync of those
  categories is ever wanted beyond the existing whole-blob sync.
- Wiring `AppContext.jsx` to actually read/write the normalized tables
  instead of (or alongside) the `app_data` blob.
- Rate limiting / moving the Claude API call server-side via an Edge
  Function.
- The cycle-aware coaching enhancement discussed earlier this session
  (symptom-aware adjustments, personal-pattern learning beyond training
  tier, richer nutrition suggestions) — separate spec, builds on top of
  `cycle_logs` once it exists but isn't part of this chapter.
