-- supabase/user_secrets.sql
-- Run once in the Supabase Dashboard SQL Editor, AFTER encrypted_tables.sql
-- (it reuses that file's Vault key 'app_encryption_key' and the
-- private.vault_key() helper — nothing new to keep safe).
--
-- Keeps the user's own API keys (Claude, ElevenLabs, OpenAI, Oura)
-- encrypted at rest so every device they sign in to with Cloud Sync gets
-- them automatically, instead of pasting them into each browser. Added
-- 2026-09-30 at the user's explicit request, knowing the trade-off: the
-- keys now also live (encrypted) in their own Supabase project, not only
-- on the device.
--
-- No select/insert/update policies on purpose: the table is only reachable
-- through the two security definer functions below, which always act as
-- auth.uid() — a client can't read even the ciphertext, or anyone else's
-- row. Safe to re-run.

create table if not exists public.user_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name in ('anthropic', 'elevenlabs', 'openai', 'oura')),
  value_encrypted bytea not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.user_secrets enable row level security;
drop policy if exists "delete own secrets" on public.user_secrets;
create policy "delete own secrets" on public.user_secrets for delete using (auth.uid() = user_id);

-- Save one key (encrypted), or remove it when p_value is null/empty.
create or replace function public.set_user_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_value is null or length(trim(p_value)) = 0 then
    delete from public.user_secrets where user_id = v_user_id and name = p_name;
    return;
  end if;
  insert into public.user_secrets (user_id, name, value_encrypted, updated_at)
  values (v_user_id, p_name, extensions.pgp_sym_encrypt(trim(p_value), private.vault_key()), now())
  on conflict (user_id, name) do update
    set value_encrypted = excluded.value_encrypted, updated_at = now();
end;
$$;

revoke execute on function public.set_user_secret(text, text) from public, anon;
grant execute on function public.set_user_secret(text, text) to authenticated;

-- All of the caller's own keys, decrypted.
create or replace function public.get_user_secrets()
returns table(name text, value text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select s.name, extensions.pgp_sym_decrypt(s.value_encrypted, private.vault_key()), s.updated_at
    from public.user_secrets s
    where s.user_id = auth.uid();
end;
$$;

revoke execute on function public.get_user_secrets() from public, anon;
grant execute on function public.get_user_secrets() to authenticated;
