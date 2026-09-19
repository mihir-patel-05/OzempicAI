-- Workout planning and tracking.
--
-- Two mirrored pairs: a plan (what you intend to do) and a session (what you
-- actually did). Each has child rows for the individual exercises so a single
-- workout can mix machines, set counts and loads.
--
-- Loads are stored in kilograms and distances in kilometres regardless of the
-- unit system the user reads them in — see public.users.unit_system.

-- ─── Plans ───────────────────────────────────────────────────────────────────
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
  -- Denormalised so row level security can be enforced without a join.
  user_id                 uuid not null references public.users(id) on delete cascade,
  position                int not null default 0,
  exercise_name           text not null,
  -- Free text: gyms name the same machine a dozen different ways.
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

-- ─── Sessions ────────────────────────────────────────────────────────────────
create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  -- Keep the session if the plan it came from is deleted.
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

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.workout_plans             enable row level security;
alter table public.workout_plan_exercises    enable row level security;
alter table public.workout_sessions          enable row level security;
alter table public.workout_session_exercises enable row level security;

create policy "workout_plans: own"             on public.workout_plans             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_plan_exercises: own"    on public.workout_plan_exercises    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sessions: own"          on public.workout_sessions          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_session_exercises: own" on public.workout_session_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index workout_plans_user_planned_date_idx
  on public.workout_plans (user_id, planned_date);
create index workout_plan_exercises_plan_position_idx
  on public.workout_plan_exercises (plan_id, position);
create index workout_sessions_user_performed_at_idx
  on public.workout_sessions (user_id, performed_at desc);
create index workout_session_exercises_session_position_idx
  on public.workout_session_exercises (session_id, position);
