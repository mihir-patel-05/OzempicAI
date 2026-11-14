-- Platform layer that replaces what hosted Supabase provided.
--
-- The application migrations (00001+) were written for Supabase: they reference
-- auth.users, auth.uid() and the anon/authenticated roles, and rely on row level
-- security. This file recreates that surface on plain Postgres so those
-- migrations run unchanged and RLS stays the authority on who sees which row.
--
-- The API connects as the database owner and, for every user request, opens a
-- transaction that does
--     set local role authenticated;
--     select set_config('request.jwt.claim.sub', '<user id>', true);
-- so auth.uid() resolves to the signed-in user and every policy applies.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

-- The connecting role must be able to switch into `authenticated`. A superuser
-- already can; granting membership covers a non-superuser owner as well.
do $$
begin
  execute format('grant authenticated to %I', current_user);
exception when others then
  null;
end;
$$;

create schema if not exists auth;

-- Accounts. Column names match Supabase's auth.users so an export from the
-- hosted project imports directly (bcrypt hashes included).
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  encrypted_password text not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on auth.users (lower(email));

-- Opaque bearer sessions. Only a SHA-256 of the token is stored.
create table if not exists auth.sessions (
  token_hash   text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists sessions_user_idx on auth.sessions (user_id);

-- Single-use password reset tokens, also stored hashed.
create table if not exists auth.password_reset_tokens (
  token_hash text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Supabase grants table access to `authenticated` and lets RLS decide which
-- rows are visible. Mirror that for every table the migrations create.
grant usage on schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
