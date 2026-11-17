-- Intermittent fasts (docs/fasting-plan.md). A fast is running while ended_at
-- is null; the web app computes the timer from started_at, so nothing about a
-- running fast lives in the browser.

-- Lets one exclusion constraint compare user_id (with =) alongside a time
-- range (with &&). Ships with Postgres and is a trusted extension.
create extension if not exists btree_gist;

create table if not exists public.fasts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  started_at     timestamptz not null,
  -- The goal: 1 to 72 hours.
  target_minutes integer not null check (target_minutes between 60 and 4320),
  ended_at       timestamptz,
  notes          text check (char_length(notes) <= 4000),
  -- Set by the notifier when it sends "1 hour left" and "Goal reached", so
  -- each is sent once. Cleared when an edit moves the goal into the future.
  reminder_notified_at timestamptz,
  goal_notified_at     timestamptz,
  created_at     timestamptz not null default now(),

  constraint fasts_ends_after_start check (ended_at is null or ended_at > started_at),
  -- No two of a user's fasts cover the same time. A running fast covers
  -- [started_at, infinity), so this also allows at most one running fast.
  constraint fasts_no_overlap exclude using gist (
    user_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  )
);

-- History, newest first.
create index if not exists fasts_user_started_idx on public.fasts (user_id, started_at desc);

-- The notifier's scan: running fasts that still owe a notification.
create index if not exists fasts_running_idx on public.fasts (started_at)
  where ended_at is null and goal_notified_at is null;

alter table public.fasts enable row level security;
drop policy if exists "fasts: own" on public.fasts;
create policy "fasts: own" on public.fasts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.fasts to authenticated;
