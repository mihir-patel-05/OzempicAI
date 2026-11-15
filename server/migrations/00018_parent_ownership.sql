-- A row may only point at a parent that belongs to the same user (security
-- report SEC-06). Foreign keys check that the parent exists but not whose it
-- is, and they ignore row level security, so a user who learned another
-- user's plan id could attach their own rows to it and learn whether it
-- still exists.
--
-- A trigger rather than a composite foreign key, so the existing
-- "on delete set null" behaviour stays as it is on every Postgres version.
-- It raises the same error for "not yours" and "does not exist".

create or replace function public.require_own_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_table text := tg_argv[0];
  parent_column text := tg_argv[1];
  parent_id uuid;
  found boolean;
begin
  execute format('select ($1).%I', parent_column) into parent_id using new;
  if parent_id is null then
    return new;
  end if;
  execute format('select exists (select 1 from public.%I p where p.id = $1 and p.user_id = $2)', parent_table)
    into found using parent_id, new.user_id;
  if not found then
    raise exception 'The linked plan or workout was not found.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists grocery_items_own_meal_plan on public.grocery_items;
create trigger grocery_items_own_meal_plan
  before insert or update of meal_plan_id, user_id on public.grocery_items
  for each row execute function public.require_own_parent('meal_plans', 'meal_plan_id');

drop trigger if exists workout_sessions_own_plan on public.workout_sessions;
create trigger workout_sessions_own_plan
  before insert or update of plan_id, user_id on public.workout_sessions
  for each row execute function public.require_own_parent('workout_plans', 'plan_id');

drop trigger if exists workout_plan_exercises_own_plan on public.workout_plan_exercises;
create trigger workout_plan_exercises_own_plan
  before insert or update of plan_id, user_id on public.workout_plan_exercises
  for each row execute function public.require_own_parent('workout_plans', 'plan_id');

drop trigger if exists workout_session_exercises_own_session on public.workout_session_exercises;
create trigger workout_session_exercises_own_session
  before insert or update of session_id, user_id on public.workout_session_exercises
  for each row execute function public.require_own_parent('workout_sessions', 'session_id');
