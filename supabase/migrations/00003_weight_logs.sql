-- Body-weight log, read/written by src/hooks/useWeightLogs.ts.
-- Previously existed only as a code block in supabase-weight-logs.md; folded in
-- here so a fresh project matches the live one. Idempotent — safe to re-run.
--
-- NOTE: user_id references auth.users directly, unlike every other table in this
-- schema, which references public.users. That is what is deployed, so it is
-- preserved verbatim rather than "fixed" — changing it would diverge the repo
-- from the live database.

create table if not exists public.weight_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  weight_kg float8 not null check (weight_kg > 0),
  logged_at timestamptz not null default now()
);

-- Per-user queries ordered by date (the hook sorts on logged_at).
create index if not exists idx_weight_logs_user_date
  on public.weight_logs (user_id, logged_at asc);

alter table public.weight_logs enable row level security;

drop policy if exists "Users can read own weight logs" on public.weight_logs;
create policy "Users can read own weight logs"
  on public.weight_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own weight logs" on public.weight_logs;
create policy "Users can insert own weight logs"
  on public.weight_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own weight logs" on public.weight_logs;
create policy "Users can delete own weight logs"
  on public.weight_logs for delete
  using (auth.uid() = user_id);
