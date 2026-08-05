-- supabase/encrypted_tables.sql
-- Run this once in the Supabase Dashboard SQL Editor, after
-- normalized_tables.sql. Adds the three tables holding genuinely
-- sensitive fields (body weight, cycle data, free-text notes) with
-- application-layer encryption: the key lives only in Supabase Vault,
-- never in the browser or in any table a client can read directly.

create extension if not exists pgcrypto with schema extensions;

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
    select w.id, w.client_id, w.date, extensions.pgp_sym_decrypt(w.kg_encrypted, private.vault_key())::numeric
    from public.weight_logs w
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
      case when c.flow_encrypted is null then null else extensions.pgp_sym_decrypt(c.flow_encrypted, private.vault_key()) end,
      array(select jsonb_array_elements_text(extensions.pgp_sym_decrypt(c.symptoms_encrypted, private.vault_key())::jsonb)),
      case when c.note_encrypted is null then null else extensions.pgp_sym_decrypt(c.note_encrypted, private.vault_key()) end
    from public.cycle_logs c
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
    select n.id, n.client_id, n.date, extensions.pgp_sym_decrypt(n.text_encrypted, private.vault_key()), n.created_at
    from public.notes n
    where n.user_id = v_user_id;
end;
$$;

revoke execute on function get_notes(uuid) from public, anon;
grant execute on function get_notes(uuid) to authenticated, service_role;
