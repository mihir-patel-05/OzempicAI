# Supabase Schema Setup

Paste this into **Supabase → SQL Editor** and hit Run.

---

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Users (mirrors Supabase auth.users via FK)
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  name                text not null default '',
  height_cm           float,
  weight_kg           float,
  age                 int,
  daily_calorie_goal  int not null default 2000,
  daily_water_goal_ml int not null default 2500,
  -- Display preference only; every column below stays metric.
  unit_system         text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  created_at          timestamptz not null default now()
);

-- Calorie Logs
create table public.calorie_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  food_name text not null,
  calories  int not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz not null default now()
);

-- Water Logs
create table public.water_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  amount_ml int not null,
  logged_at timestamptz not null default now()
);

-- Exercise Logs
create table public.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  exercise_name    text not null,
  category         text not null check (category in ('cardio', 'strength', 'flexibility', 'sports', 'other')),
  duration_minutes int not null,
  calories_burned  int not null,
  -- Strength-only (null for all other categories)
  sets             int,
  reps_per_set     int,
  body_part        text check (body_part in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body')),
  logged_at        timestamptz not null default now()
);

-- Heart Rate Logs
create table public.heart_rate_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  bpm         int not null,
  source      text not null check (source in ('healthkit', 'manual')),
  recorded_at timestamptz not null default now()
);

-- Meal Plans
create table public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  planned_date date not null,
  meal_type    text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories     int not null,
  created_at   timestamptz not null default now()
);

-- Grocery Items
create table public.grocery_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  category     text not null check (category in ('produce', 'dairy', 'protein', 'grains', 'beverages', 'snacks', 'other')),
  is_purchased boolean not null default false,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Workout Plans (what you intend to do)
create table public.workout_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  workout_type text not null check (workout_type in ('push', 'pull', 'legs', 'full_body', 'cardio', 'other')),
  planned_date date not null,
  notes        text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table public.workout_plan_exercises (
  id                      uuid primary key default gen_random_uuid(),
  plan_id                 uuid not null references public.workout_plans(id) on delete cascade,
  user_id                 uuid not null references public.users(id) on delete cascade,
  position                int not null default 0,
  exercise_name           text not null,
  machine                 text,
  -- Strength targets (null for cardio entries)
  target_sets             int check (target_sets > 0),
  target_reps             int check (target_reps > 0),
  target_weight_kg        double precision check (target_weight_kg >= 0),
  -- Cardio targets (null for strength entries)
  target_duration_minutes int check (target_duration_minutes > 0),
  target_distance_km      double precision check (target_distance_km > 0),
  created_at              timestamptz not null default now()
);

-- Workout Sessions (what you actually did)
create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  plan_id          uuid references public.workout_plans(id) on delete set null,
  name             text not null,
  workout_type     text not null check (workout_type in ('push', 'pull', 'legs', 'full_body', 'cardio', 'other')),
  performed_at     timestamptz not null default now(),
  duration_minutes int check (duration_minutes > 0),
  notes            text,
  created_at       timestamptz not null default now()
);

create table public.workout_session_exercises (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.workout_sessions(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  position         int not null default 0,
  exercise_name    text not null,
  machine          text,
  -- Strength (null for cardio entries)
  sets             int check (sets > 0),
  reps_per_set     int check (reps_per_set > 0),
  weight_kg        double precision check (weight_kg >= 0),
  -- Cardio (null for strength entries)
  duration_minutes int check (duration_minutes > 0),
  distance_km      double precision check (distance_km > 0),
  created_at       timestamptz not null default now()
);

-- Row Level Security (each user can only access their own data)
alter table public.users           enable row level security;
alter table public.calorie_logs    enable row level security;
alter table public.water_logs      enable row level security;
alter table public.exercise_logs   enable row level security;
alter table public.heart_rate_logs enable row level security;
alter table public.meal_plans      enable row level security;
alter table public.grocery_items   enable row level security;
alter table public.workout_plans             enable row level security;
alter table public.workout_plan_exercises    enable row level security;
alter table public.workout_sessions          enable row level security;
alter table public.workout_session_exercises enable row level security;

create policy "users: own row"       on public.users           for all using (auth.uid() = id);
create policy "calorie_logs: own"    on public.calorie_logs    for all using (auth.uid() = user_id);
create policy "water_logs: own"      on public.water_logs      for all using (auth.uid() = user_id);
create policy "exercise_logs: own"   on public.exercise_logs   for all using (auth.uid() = user_id);
create policy "heart_rate_logs: own" on public.heart_rate_logs for all using (auth.uid() = user_id);
create policy "meal_plans: own"      on public.meal_plans      for all using (auth.uid() = user_id);
create policy "grocery_items: own"   on public.grocery_items   for all using (auth.uid() = user_id);

create policy "workout_plans: own"             on public.workout_plans             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_plan_exercises: own"    on public.workout_plan_exercises    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sessions: own"          on public.workout_sessions          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_session_exercises: own" on public.workout_session_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## After Running

1. Go to **Settings → API** in your Supabase dashboard
2. Copy your **Project URL** and **anon/public key**
3. Paste them into `OzempicAI/Utilities/Constants.swift`

## Tables

| Table | Purpose |
|---|---|
| `users` | Profile + daily goals |
| `calorie_logs` | Food entries per meal |
| `water_logs` | Water intake entries |
| `exercise_logs` | Workouts (strength fields nullable) |
| `heart_rate_logs` | HealthKit + manual BPM readings |
| `meal_plans` | Planned meals by day |
| `grocery_items` | Shopping list, optionally linked to a meal plan |
| `workout_plans` | Planned push/pull/legs/cardio sessions by day |
| `workout_plan_exercises` | Target machine, sets, reps and load per planned exercise |
| `workout_sessions` | Workouts as performed, optionally linked to the plan |
| `workout_session_exercises` | Machine, sets, reps and load actually done |

## Units

Weights are stored in kilograms and distances in kilometres everywhere. `users.unit_system`
(`metric` or `imperial`) only decides how the app labels, renders and parses those numbers, so
switching it never rewrites history.
