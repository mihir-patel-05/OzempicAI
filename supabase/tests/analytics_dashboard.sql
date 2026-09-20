begin;

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'one@example.com', '{"name":"One"}'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.com', '{"name":"Two"}');

insert into public.weight_logs (user_id, weight_kg, logged_at)
values
  ('00000000-0000-0000-0000-000000000001', 100, '2026-09-20 12:00:00+00'),
  ('00000000-0000-0000-0000-000000000001', 99, '2026-09-20 18:00:00+00'),
  ('00000000-0000-0000-0000-000000000002', 70, '2026-09-20 19:00:00+00');

insert into public.calorie_logs (user_id, food_name, calories, meal_type, logged_at)
values
  ('00000000-0000-0000-0000-000000000001', 'Breakfast', 500, 'breakfast', '2026-09-20 13:00:00+00'),
  ('00000000-0000-0000-0000-000000000001', 'Late snack', 200, 'snack', '2026-09-20 01:30:00+00'),
  ('00000000-0000-0000-0000-000000000002', 'Other user', 900, 'dinner', '2026-09-20 13:00:00+00');

insert into public.water_logs (user_id, amount_ml, logged_at)
values ('00000000-0000-0000-0000-000000000001', 750, '2026-09-20 14:00:00+00');

insert into public.exercise_logs (
  user_id,
  exercise_name,
  category,
  duration_minutes,
  calories_burned,
  logged_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Yoga',
  'flexibility',
  20,
  50,
  '2026-09-20 15:00:00+00'
);

insert into public.heart_rate_logs (user_id, bpm, source, recorded_at)
values
  ('00000000-0000-0000-0000-000000000001', 70, 'manual', '2026-09-20 16:00:00+00'),
  ('00000000-0000-0000-0000-000000000001', 80, 'manual', '2026-09-20 17:00:00+00');

insert into public.workout_sessions (
  id,
  user_id,
  name,
  workout_type,
  performed_at,
  duration_minutes
)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Push', 'push', '2026-09-20 18:00:00+00', 45),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Run', 'cardio', '2026-09-20 19:00:00+00', 30),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Private', 'pull', '2026-09-20 20:00:00+00', 60);

insert into public.workout_session_exercises (
  session_id,
  user_id,
  position,
  exercise_name,
  machine,
  sets,
  reps_per_set,
  weight_kg,
  duration_minutes,
  distance_km
)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 0, '  Bench   Press ', 'Barbell', 3, 10, 50, null, null),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 0, 'Run', 'Outdoors', null, null, null, 30, 5),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 0, 'Row', 'Cable', 4, 8, 60, null, null);

insert into public.workout_plans (
  user_id,
  name,
  workout_type,
  planned_date,
  completed_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'Push plan', 'push', '2026-09-20', '2026-09-20 18:45:00+00'),
  ('00000000-0000-0000-0000-000000000001', 'Leg plan', 'legs', '2026-09-20', null);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

do $$
declare
  result record;
  progress record;
begin
  if (select count(*) from public.get_analytics_daily('2026-09-18', '2026-09-20', 'UTC')) <> 3 then
    raise exception 'daily analytics must return one row per requested day';
  end if;

  select * into result
  from public.get_analytics_daily('2026-09-18', '2026-09-20', 'UTC')
  where day = '2026-09-20';

  if result.weight_kg <> 99 then
    raise exception 'daily analytics did not select the latest weight';
  end if;
  if result.calories_logged <> 700 or result.calorie_entries <> 2 then
    raise exception 'daily calorie aggregation or user isolation failed';
  end if;
  if result.water_ml <> 750 or result.exercise_minutes <> 20 then
    raise exception 'daily wellness aggregation failed';
  end if;
  if result.workout_count <> 2 or result.workout_minutes <> 75 then
    raise exception 'daily workout aggregation failed';
  end if;
  if result.strength_volume_kg <> 1500 then
    raise exception 'strength volume aggregation failed';
  end if;
  if result.cardio_minutes <> 30 or result.cardio_distance_km <> 5 then
    raise exception 'cardio aggregation failed';
  end if;
  if result.heart_rate_avg <> 75 or result.heart_rate_readings <> 2 then
    raise exception 'heart-rate aggregation failed';
  end if;
  if result.planned_workouts <> 2 or result.completed_plans <> 1 then
    raise exception 'plan aggregation failed';
  end if;
  if result.workout_type_counts <> '{"cardio": 1, "push": 1}'::jsonb then
    raise exception 'workout type aggregation failed';
  end if;

  if (select calories_logged
      from public.get_analytics_daily('2026-09-19', '2026-09-20', 'America/Detroit')
      where day = '2026-09-19') <> 200 then
    raise exception 'timezone calendar grouping failed';
  end if;

  if (select count(*)
      from public.get_analytics_exercise_progress('2026-09-20', '2026-09-20', 'UTC')) <> 2 then
    raise exception 'exercise progress user isolation failed';
  end if;

  select * into progress
  from public.get_analytics_exercise_progress('2026-09-20', '2026-09-20', 'UTC')
  where workout_type = 'push';

  if progress.exercise_key <> 'bench press|barbell' then
    raise exception 'exercise normalization failed';
  end if;
  if progress.volume_kg <> 1500 then
    raise exception 'exercise volume calculation failed';
  end if;
  if abs(progress.estimated_1rm_kg - 66.6666666667) > 0.0001 then
    raise exception 'estimated one-rep-max calculation failed';
  end if;

  begin
    perform * from public.get_analytics_daily('2026-09-20', '2026-09-19', 'UTC');
    raise exception 'invalid date range was accepted';
  exception
    when others then
      if sqlerrm = 'invalid date range was accepted' then
        raise;
      end if;
  end;

  begin
    perform * from public.get_analytics_daily('2026-09-20', '2026-09-20', 'Not/A_Timezone');
    raise exception 'invalid timezone was accepted';
  exception
    when others then
      if sqlerrm = 'invalid timezone was accepted' then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_analytics_daily(date,date,text)', 'execute') then
    raise exception 'anon can execute daily analytics';
  end if;
  if has_function_privilege('anon', 'public.get_analytics_exercise_progress(date,date,text)', 'execute') then
    raise exception 'anon can execute exercise analytics';
  end if;
end;
$$;

rollback;

