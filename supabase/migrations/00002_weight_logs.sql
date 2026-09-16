-- Daily weight entries used by the web tracker.
create table public.weight_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  weight_kg double precision not null check (weight_kg > 0),
  logged_at timestamptz not null default now()
);

alter table public.weight_logs enable row level security;

create policy "weight_logs: own"
  on public.weight_logs
  for all
  using (auth.uid() = user_id);

create index weight_logs_user_logged_at_idx
  on public.weight_logs (user_id, logged_at desc);
