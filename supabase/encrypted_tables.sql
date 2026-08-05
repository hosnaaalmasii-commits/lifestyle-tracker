-- supabase/encrypted_tables.sql
-- Run this once in the Supabase Dashboard SQL Editor, after
-- normalized_tables.sql. Adds the three tables holding genuinely
-- sensitive fields (body weight, cycle data, free-text notes) with
-- application-layer encryption: the key lives only in Supabase Vault,
-- never in the browser or in any table a client can read directly.
--
-- =====================================================================
-- !! KEY LOSS IS UNRECOVERABLE — READ BEFORE TOUCHING THE VAULT SECRET !!
-- ---------------------------------------------------------------------
-- The 'app_encryption_key' Vault secret created below is the ONLY thing
-- that can decrypt weight_logs.kg_encrypted, cycle_logs.*_encrypted, and
-- notes.text_encrypted. If it is deleted, overwritten, or rotated, every
-- existing encrypted row becomes permanently unreadable — there is no
-- backup copy of the key anywhere, and there is NO re-encryption or key
-- rotation procedure in this codebase yet. This is real user health
-- data. Never delete or rotate this secret without first writing (and
-- running) a migration that decrypts every row with the old key and
-- re-encrypts it with the new one. The guard around vault.create_secret
-- below exists specifically so re-running this file can never silently
-- replace an existing key.
-- ---------------------------------------------------------------------
-- pgcrypto SCHEMA PRECONDITION
-- ---------------------------------------------------------------------
-- Every crypto call in this file is schema-qualified as
-- `extensions.pgp_sym_*` / `extensions.gen_random_bytes`, which assumes
-- pgcrypto is installed in the `extensions` schema. The
-- `create extension if not exists pgcrypto with schema extensions;`
-- below is a NO-OP if pgcrypto is already installed in some other
-- schema (the `if not exists` suppresses the error but does NOT move
-- it) — in that case every one of those calls will fail. Confirm first:
--   select extnamespace::regnamespace from pg_extension where extname = 'pgcrypto';
-- and if it reports anything other than `extensions`, adjust the
-- schema-qualified calls in this file to match before running.
-- ---------------------------------------------------------------------
-- Safe to re-run: create table / create schema use `if not exists`,
-- every policy is dropped before being (re)created, functions use
-- `create or replace`, and the Vault key is only ever created once.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  kg_encrypted bytea not null,
  unique (user_id, client_id)
);

create table if not exists cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  flow_encrypted bytea,
  symptoms_encrypted bytea,
  note_encrypted bytea,
  unique (user_id, client_id)
);

create table if not exists notes (
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
--
-- These three tables deliberately have NO insert/update policies: all
-- writes must go through the security definer RPCs, which are the only
-- thing that produces correctly-encrypted ciphertext. A direct client
-- insert/update could write arbitrary bytes into an *_encrypted column,
-- after which pgp_sym_decrypt would throw and make that user's entire
-- list unreadable. Delete stays allowed, since deleteWeightLog /
-- deleteCycleLog / deleteNote in src/services/ use direct table deletes
-- and deleting a row can't corrupt anything.
-- The `drop policy` lines for insert/update have no matching `create`
-- on purpose — they remove the policies an earlier version of this file
-- created.
alter table weight_logs enable row level security;
drop policy if exists "select own rows" on weight_logs;
create policy "select own rows" on weight_logs for select using (auth.uid() = user_id);
drop policy if exists "insert own rows" on weight_logs;
drop policy if exists "update own rows" on weight_logs;
drop policy if exists "delete own rows" on weight_logs;
create policy "delete own rows" on weight_logs for delete using (auth.uid() = user_id);

alter table cycle_logs enable row level security;
drop policy if exists "select own rows" on cycle_logs;
create policy "select own rows" on cycle_logs for select using (auth.uid() = user_id);
drop policy if exists "insert own rows" on cycle_logs;
drop policy if exists "update own rows" on cycle_logs;
drop policy if exists "delete own rows" on cycle_logs;
create policy "delete own rows" on cycle_logs for delete using (auth.uid() = user_id);

alter table notes enable row level security;
drop policy if exists "select own rows" on notes;
create policy "select own rows" on notes for select using (auth.uid() = user_id);
drop policy if exists "insert own rows" on notes;
drop policy if exists "update own rows" on notes;
drop policy if exists "delete own rows" on notes;
create policy "delete own rows" on notes for delete using (auth.uid() = user_id);

-- The key: generated fresh, inside Postgres, right now — never appears
-- as a literal anywhere in this file, this repo, or any commit. Guarded
-- so a re-run of this file can never overwrite an existing key (see the
-- KEY LOSS warning at the top of this file).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_encryption_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'app_encryption_key',
      'Symmetric key for encrypting weight/cycle/notes fields at rest.'
    );
  end if;
end $$;

-- Lives in a schema PostgREST never exposes, so it can't be called as
-- an RPC endpoint. Only callable from other security definer functions
-- owned by the same privileged role (e.g. postgres), never directly by
-- anon/authenticated.
create schema if not exists private;

create or replace function private.vault_key()
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
--
-- The role check reads the JWT claim directly rather than calling
-- auth.role(), which Supabase now documents as a deprecated
-- compatibility shim.

create or replace function insert_weight_log(p_kg numeric, p_date date, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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

  insert into public.weight_logs (user_id, client_id, date, kg_encrypted)
  values (v_user_id, p_client_id, p_date, extensions.pgp_sym_encrypt(p_kg::text, private.vault_key()))
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.weight_logs where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_weight_log(numeric, date, text, uuid) from public, anon;
grant execute on function insert_weight_log(numeric, date, text, uuid) to authenticated, service_role;

create or replace function get_weight_logs(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, kg numeric)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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
    select w.id, w.client_id, w.date, extensions.pgp_sym_decrypt(w.kg_encrypted, private.vault_key())::numeric
    from public.weight_logs w
    where w.user_id = v_user_id;
end;
$$;

revoke execute on function get_weight_logs(uuid) from public, anon;
grant execute on function get_weight_logs(uuid) to authenticated, service_role;

create or replace function insert_cycle_log(p_date date, p_flow text, p_symptoms text[], p_note text, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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

  insert into public.cycle_logs (user_id, client_id, date, flow_encrypted, symptoms_encrypted, note_encrypted)
  values (
    v_user_id, p_client_id, p_date,
    case when p_flow is null then null else extensions.pgp_sym_encrypt(p_flow, private.vault_key()) end,
    extensions.pgp_sym_encrypt(coalesce(to_jsonb(p_symptoms)::text, '[]'), private.vault_key()),
    case when p_note is null then null else extensions.pgp_sym_encrypt(p_note, private.vault_key()) end
  )
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.cycle_logs where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_cycle_log(date, text, text[], text, text, uuid) from public, anon;
grant execute on function insert_cycle_log(date, text, text[], text, text, uuid) to authenticated, service_role;

create or replace function get_cycle_logs(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, flow text, symptoms text[], note text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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
      case when c.flow_encrypted is null then null else extensions.pgp_sym_decrypt(c.flow_encrypted, private.vault_key()) end,
      array(select jsonb_array_elements_text(extensions.pgp_sym_decrypt(c.symptoms_encrypted, private.vault_key())::jsonb)),
      case when c.note_encrypted is null then null else extensions.pgp_sym_decrypt(c.note_encrypted, private.vault_key()) end
    from public.cycle_logs c
    where c.user_id = v_user_id;
end;
$$;

revoke execute on function get_cycle_logs(uuid) from public, anon;
grant execute on function get_cycle_logs(uuid) to authenticated, service_role;

create or replace function insert_note(p_date date, p_text text, p_client_id text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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

  insert into public.notes (user_id, client_id, date, text_encrypted)
  values (v_user_id, p_client_id, p_date, extensions.pgp_sym_encrypt(p_text, private.vault_key()))
  on conflict (user_id, client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.notes where user_id = v_user_id and client_id = p_client_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function insert_note(date, text, text, uuid) from public, anon;
grant execute on function insert_note(date, text, text, uuid) to authenticated, service_role;

create or replace function get_notes(p_user_id uuid default null)
returns table(id uuid, client_id text, date date, text text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
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
    select n.id, n.client_id, n.date, extensions.pgp_sym_decrypt(n.text_encrypted, private.vault_key()), n.created_at
    from public.notes n
    where n.user_id = v_user_id;
end;
$$;

revoke execute on function get_notes(uuid) from public, anon;
grant execute on function get_notes(uuid) to authenticated, service_role;
