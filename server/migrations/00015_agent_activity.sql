-- Every write an AI app makes through /api/mcp, recorded in the same
-- transaction as the write itself (docs/mcp-server-plan.md). Phase 2 shows
-- these as an activity feed with Undo; created_ids is what Undo deletes.

create table if not exists public.agent_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- auth.oauth_grants.id. Not a foreign key: the authenticated role that
  -- inserts these rows has no access to the auth schema.
  grant_id    uuid,
  client_name text not null,
  tool_name   text not null,
  summary     text,
  resource    text,
  created_ids uuid[] not null default '{}',
  undone_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists agent_activity_user_idx on public.agent_activity (user_id, created_at desc);

alter table public.agent_activity enable row level security;
drop policy if exists "agent_activity: own" on public.agent_activity;
create policy "agent_activity: own" on public.agent_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.agent_activity to authenticated;
