-- Read-only analytics functions for the dashboard. Both functions execute as
-- the caller so the existing row-level security policies remain authoritative.

create or replace function public.get_analytics_daily(
  p_start date,
  p_end date,
  p_timezone text
)
returns table (
  day date,
  weight_kg double precision,
  calories_logged bigint,
  calorie_entries bigint,
  water_ml bigint,
  water_entries bigint,
  exercise_minutes bigint,
  exercise_calories bigint,
  exercise_entries bigint,
  workout_count bigint,
  workout_minutes bigint,
  strength_volume_kg double precision,
  cardio_minutes bigint,
  cardio_distance_km double precision,
  heart_rate_avg double precision,
  heart_rate_min int,
  heart_rate_max int,
  heart_rate_readings bigint,
  planned_workouts bigint,
  completed_plans bigint,
  workout_type_counts jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  if p_start is null or p_end is null then
    raise exception 'Analytics dates are required';
  end if;

  if p_end < p_start then
    raise exception 'Analytics end date must not precede the start date';
  end if;

  if p_end - p_start > 365 then
    raise exception 'Analytics range cannot exceed 366 days';
  end if;

  if p_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Unknown analytics timezone: %', coalesce(p_timezone, '(null)');
  end if;

  range_start := p_start::timestamp at time zone p_timezone;
  range_end := (p_end + 1)::timestamp at time zone p_timezone;

  return query
  with date_spine as (
    select generated_day::date as day
    from pg_catalog.generate_series(p_start, p_end, interval '1 day') generated_day
  ),
  daily_weight as (
    select distinct on ((logged_at at time zone p_timezone)::date)
      (logged_at at time zone p_timezone)::date as day,
      weight_kg
    from public.weight_logs
    where user_id = (select auth.uid())
      and logged_at >= range_start
      and logged_at < range_end
    order by (logged_at at time zone p_timezone)::date, logged_at desc
  ),
  daily_calories as (
    select
      (logged_at at time zone p_timezone)::date as day,
      sum(calories)::bigint as calories_logged,
      count(*)::bigint as calorie_entries
    from public.calorie_logs
    where user_id = (select auth.uid())
      and logged_at >= range_start
      and logged_at < range_end
    group by 1
  ),
  daily_water as (
    select
      (logged_at at time zone p_timezone)::date as day,
      sum(amount_ml)::bigint as water_ml,
      count(*)::bigint as water_entries
    from public.water_logs
    where user_id = (select auth.uid())
      and logged_at >= range_start
      and logged_at < range_end
    group by 1
  ),
  daily_exercise as (
    select
      (logged_at at time zone p_timezone)::date as day,
      sum(duration_minutes)::bigint as exercise_minutes,
      sum(calories_burned)::bigint as exercise_calories,
      count(*)::bigint as exercise_entries
    from public.exercise_logs
    where user_id = (select auth.uid())
      and logged_at >= range_start
      and logged_at < range_end
    group by 1
  ),
  workouts_by_type as (
    select
      (performed_at at time zone p_timezone)::date as day,
      workout_type,
      count(*)::bigint as workout_count
    from public.workout_sessions
    where user_id = (select auth.uid())
      and performed_at >= range_start
      and performed_at < range_end
    group by 1, 2
  ),
  workout_types as (
    select
      day,
      pg_catalog.jsonb_object_agg(workout_type, workout_count) as workout_type_counts
    from workouts_by_type
    group by day
  ),
  daily_workouts as (
    select
      (performed_at at time zone p_timezone)::date as day,
      count(*)::bigint as workout_count,
      coalesce(sum(duration_minutes), 0)::bigint as workout_minutes
    from public.workout_sessions
    where user_id = (select auth.uid())
      and performed_at >= range_start
      and performed_at < range_end
    group by 1
  ),
  daily_workout_exercises as (
    select
      (session.performed_at at time zone p_timezone)::date as day,
      coalesce(sum(
        case
          when session.workout_type <> 'cardio'
            and exercise.sets is not null
            and exercise.reps_per_set is not null
            and exercise.weight_kg is not null
          then exercise.sets * exercise.reps_per_set * exercise.weight_kg
          else 0
        end
      ), 0)::double precision as strength_volume_kg,
      coalesce(sum(
        case when session.workout_type = 'cardio' then exercise.duration_minutes else 0 end
      ), 0)::bigint as cardio_minutes,
      coalesce(sum(
        case when session.workout_type = 'cardio' then exercise.distance_km else 0 end
      ), 0)::double precision as cardio_distance_km
    from public.workout_sessions session
    join public.workout_session_exercises exercise
      on exercise.session_id = session.id
      and exercise.user_id = (select auth.uid())
    where session.user_id = (select auth.uid())
      and session.performed_at >= range_start
      and session.performed_at < range_end
    group by 1
  ),
  daily_heart_rate as (
    select
      (recorded_at at time zone p_timezone)::date as day,
      avg(bpm)::double precision as heart_rate_avg,
      min(bpm)::int as heart_rate_min,
      max(bpm)::int as heart_rate_max,
      count(*)::bigint as heart_rate_readings
    from public.heart_rate_logs
    where user_id = (select auth.uid())
      and recorded_at >= range_start
      and recorded_at < range_end
    group by 1
  ),
  daily_plans as (
    select
      planned_date as day,
      count(*)::bigint as planned_workouts,
      count(*) filter (where completed_at is not null)::bigint as completed_plans
    from public.workout_plans
    where user_id = (select auth.uid())
      and planned_date between p_start and p_end
    group by 1
  )
  select
    date_spine.day,
    daily_weight.weight_kg,
    coalesce(daily_calories.calories_logged, 0),
    coalesce(daily_calories.calorie_entries, 0),
    coalesce(daily_water.water_ml, 0),
    coalesce(daily_water.water_entries, 0),
    coalesce(daily_exercise.exercise_minutes, 0),
    coalesce(daily_exercise.exercise_calories, 0),
    coalesce(daily_exercise.exercise_entries, 0),
    coalesce(daily_workouts.workout_count, 0),
    coalesce(daily_workouts.workout_minutes, 0),
    coalesce(daily_workout_exercises.strength_volume_kg, 0),
    coalesce(daily_workout_exercises.cardio_minutes, 0),
    coalesce(daily_workout_exercises.cardio_distance_km, 0),
    daily_heart_rate.heart_rate_avg,
    daily_heart_rate.heart_rate_min,
    daily_heart_rate.heart_rate_max,
    coalesce(daily_heart_rate.heart_rate_readings, 0),
    coalesce(daily_plans.planned_workouts, 0),
    coalesce(daily_plans.completed_plans, 0),
    coalesce(workout_types.workout_type_counts, '{}'::jsonb)
  from date_spine
  left join daily_weight using (day)
  left join daily_calories using (day)
  left join daily_water using (day)
  left join daily_exercise using (day)
  left join daily_workouts using (day)
  left join daily_workout_exercises using (day)
  left join daily_heart_rate using (day)
  left join daily_plans using (day)
  left join workout_types using (day)
  order by date_spine.day;
end;
$$;

create or replace function public.get_analytics_exercise_progress(
  p_start date,
  p_end date,
  p_timezone text
)
returns table (
  performed_on date,
  session_id uuid,
  workout_type text,
  exercise_key text,
  exercise_name text,
  machine text,
  sets int,
  reps_per_set int,
  weight_kg double precision,
  volume_kg double precision,
  estimated_1rm_kg double precision,
  duration_minutes int,
  distance_km double precision,
  pace_minutes_per_km double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  if p_start is null or p_end is null then
    raise exception 'Analytics dates are required';
  end if;

  if p_end < p_start then
    raise exception 'Analytics end date must not precede the start date';
  end if;

  if p_end - p_start > 365 then
    raise exception 'Analytics range cannot exceed 366 days';
  end if;

  if p_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Unknown analytics timezone: %', coalesce(p_timezone, '(null)');
  end if;

  range_start := p_start::timestamp at time zone p_timezone;
  range_end := (p_end + 1)::timestamp at time zone p_timezone;

  return query
  select
    (session.performed_at at time zone p_timezone)::date,
    session.id,
    session.workout_type,
    pg_catalog.concat_ws(
      '|',
      pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(exercise.exercise_name)), '\s+', ' ', 'g'),
      pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(exercise.machine, ''))), '\s+', ' ', 'g')
    ),
    exercise.exercise_name,
    exercise.machine,
    exercise.sets,
    exercise.reps_per_set,
    exercise.weight_kg,
    case
      when exercise.sets is not null
        and exercise.reps_per_set is not null
        and exercise.weight_kg is not null
      then exercise.sets * exercise.reps_per_set * exercise.weight_kg
      else null
    end::double precision,
    case
      when exercise.reps_per_set is not null and exercise.weight_kg is not null
      then exercise.weight_kg * (1 + exercise.reps_per_set / 30.0)
      else null
    end::double precision,
    exercise.duration_minutes,
    exercise.distance_km,
    case
      when exercise.duration_minutes is not null and exercise.distance_km > 0
      then exercise.duration_minutes / exercise.distance_km
      else null
    end::double precision
  from public.workout_sessions session
  join public.workout_session_exercises exercise
    on exercise.session_id = session.id
    and exercise.user_id = (select auth.uid())
  where session.user_id = (select auth.uid())
    and session.performed_at >= range_start
    and session.performed_at < range_end
  order by session.performed_at, exercise.position;
end;
$$;

revoke execute on function public.get_analytics_daily(date, date, text) from public, anon;
revoke execute on function public.get_analytics_exercise_progress(date, date, text) from public, anon;

grant execute on function public.get_analytics_daily(date, date, text) to authenticated;
grant execute on function public.get_analytics_exercise_progress(date, date, text) to authenticated;

comment on function public.get_analytics_daily(date, date, text) is
  'Returns one analytics row per local calendar day for the authenticated user.';
comment on function public.get_analytics_exercise_progress(date, date, text) is
  'Returns structured workout exercise progress for the authenticated user.';
