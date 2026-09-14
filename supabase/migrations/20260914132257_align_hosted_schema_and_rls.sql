-- Capture schema that existed only in the hosted project and make the final
-- RLS state explicit, minimal, and consistent for new environments.

alter table public.exercise_logs
  add column if not exists source text not null default 'manual',
  add column if not exists healthkit_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exercise_logs'::regclass
      and conname = 'exercise_logs_healthkit_id_key'
  ) then
    alter table public.exercise_logs
      add constraint exercise_logs_healthkit_id_key unique (healthkit_id);
  end if;
end
$$;

create table if not exists public.workout_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id),
  exercise_name    text not null,
  category         text not null,
  planned_date     date not null,
  duration_minutes integer,
  calories_burned  integer,
  sets             integer,
  reps_per_set     integer,
  body_part        text,
  weight           double precision,
  weight_unit      text,
  notes            text,
  created_at       timestamptz not null default now(),
  is_completed     boolean not null default false
);

alter table public.workout_plans enable row level security;

-- Remove the original broad policies. They were duplicated by the granular
-- policies and targeted PUBLIC rather than authenticated users.
drop policy if exists "users: own row" on public.users;
drop policy if exists "calorie_logs: own" on public.calorie_logs;
drop policy if exists "water_logs: own" on public.water_logs;
drop policy if exists "exercise_logs: own" on public.exercise_logs;
drop policy if exists "heart_rate_logs: own" on public.heart_rate_logs;
drop policy if exists "meal_plans: own" on public.meal_plans;
drop policy if exists "grocery_items: own" on public.grocery_items;

-- Recreate existing policies with a cached auth.uid() lookup.
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile" on public.users
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile" on public.users
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own calorie logs" on public.calorie_logs;
create policy "Users can insert own calorie logs" on public.calorie_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own calorie logs" on public.calorie_logs;
create policy "Users can read own calorie logs" on public.calorie_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own calorie logs" on public.calorie_logs;
create policy "Users can delete own calorie logs" on public.calorie_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own water logs" on public.water_logs;
create policy "Users can insert own water logs" on public.water_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own water logs" on public.water_logs;
create policy "Users can read own water logs" on public.water_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own water logs" on public.water_logs;
create policy "Users can delete own water logs" on public.water_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own exercise logs" on public.exercise_logs;
create policy "Users can insert own exercise logs" on public.exercise_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own exercise logs" on public.exercise_logs;
create policy "Users can read own exercise logs" on public.exercise_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own exercise logs" on public.exercise_logs;
create policy "Users can delete own exercise logs" on public.exercise_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own heart rate logs" on public.heart_rate_logs;
create policy "Users can insert own heart rate logs" on public.heart_rate_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own heart rate logs" on public.heart_rate_logs;
create policy "Users can read own heart rate logs" on public.heart_rate_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own heart rate logs" on public.heart_rate_logs;
create policy "Users can delete own heart rate logs" on public.heart_rate_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own meal plans" on public.meal_plans;
create policy "Users can insert own meal plans" on public.meal_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own meal plans" on public.meal_plans;
create policy "Users can read own meal plans" on public.meal_plans
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own meal plans" on public.meal_plans;
create policy "Users can delete own meal plans" on public.meal_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own grocery items" on public.grocery_items;
create policy "Users can insert own grocery items" on public.grocery_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read own grocery items" on public.grocery_items;
create policy "Users can read own grocery items" on public.grocery_items
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can update own grocery items" on public.grocery_items;
create policy "Users can update own grocery items" on public.grocery_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own grocery items" on public.grocery_items;
create policy "Users can delete own grocery items" on public.grocery_items
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own weight logs" on public.weight_logs;
create policy "Users can read own weight logs" on public.weight_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own weight logs" on public.weight_logs;
create policy "Users can insert own weight logs" on public.weight_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own weight logs" on public.weight_logs;
create policy "Users can delete own weight logs" on public.weight_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own day labels" on public.day_labels;
create policy "Users manage own day labels" on public.day_labels
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own workout plans" on public.workout_plans;
create policy "Users can CRUD own workout plans" on public.workout_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The trigger can execute this function without exposing it through PostgREST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
