-- Devices that asked for Web Push notifications (docs/fasting-plan.md, phase 5).
-- One row per browser push subscription. The endpoint is the push service's
-- address for that one browser install, and only that browser knows it, so it
-- is unique across all users: if someone else signs in on the same browser and
-- turns notifications on, the row moves to them.

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  endpoint        text not null unique check (char_length(endpoint) <= 1000),
  -- The browser's keys for encrypting payloads (base64url).
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: own" on public.push_subscriptions;
create policy "push_subscriptions: own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
