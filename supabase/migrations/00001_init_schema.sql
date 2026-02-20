-- OzempicAI — initial schema
-- Auto-runs on first Docker boot (clean volume).
-- To reset: docker compose down -v && docker compose up -d

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────────────────
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  name                text not null default '',
  height_cm           float,
  weight_kg           float,
  age                 int,
  daily_calorie_goal  int not null default 2000,
  daily_water_goal_ml int not null default 2500,
  created_at          timestamptz not null default now()
);

-- ─── Calorie Logs ─────────────────────────────────────────────────────────────
create table public.calorie_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  food_name text not null,
  calories  int not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz not null default now()
);

-- ─── Water Logs ───────────────────────────────────────────────────────────────
create table public.water_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  amount_ml int not null,
  logged_at timestamptz not null default now()
);

-- ─── Exercise Logs ────────────────────────────────────────────────────────────
create table public.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  exercise_name    text not null,
  category         text not null check (category in ('cardio', 'strength', 'flexibility', 'sports', 'other')),
  duration_minutes int not null,
  calories_burned  int not null,
  sets             int,
  reps_per_set     int,
  body_part        text check (body_part in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body')),
  logged_at        timestamptz not null default now()
);

-- ─── Heart Rate Logs ──────────────────────────────────────────────────────────
create table public.heart_rate_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  bpm         int not null,
  source      text not null check (source in ('healthkit', 'manual')),
  recorded_at timestamptz not null default now()
);

-- ─── Meal Plans ───────────────────────────────────────────────────────────────
create table public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  planned_date date not null,
  meal_type    text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories     int not null,
  created_at   timestamptz not null default now()
);

-- ─── Grocery Items ────────────────────────────────────────────────────────────
create table public.grocery_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  category     text not null check (category in ('produce', 'dairy', 'protein', 'grains', 'beverages', 'snacks', 'other')),
  is_purchased boolean not null default false,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users           enable row level security;
alter table public.calorie_logs    enable row level security;
alter table public.water_logs      enable row level security;
alter table public.exercise_logs   enable row level security;
alter table public.heart_rate_logs enable row level security;
alter table public.meal_plans      enable row level security;
alter table public.grocery_items   enable row level security;

create policy "users: own row"       on public.users           for all using (auth.uid() = id);
create policy "calorie_logs: own"    on public.calorie_logs    for all using (auth.uid() = user_id);
create policy "water_logs: own"      on public.water_logs      for all using (auth.uid() = user_id);
create policy "exercise_logs: own"   on public.exercise_logs   for all using (auth.uid() = user_id);
create policy "heart_rate_logs: own" on public.heart_rate_logs for all using (auth.uid() = user_id);
create policy "meal_plans: own"      on public.meal_plans      for all using (auth.uid() = user_id);
create policy "grocery_items: own"   on public.grocery_items   for all using (auth.uid() = user_id);
