-- Strength exercise loads are normalized to kilograms, matching body weight
-- and workout session loads elsewhere in the app. The UI accepts kg or lb and
-- converts before insert.

alter table public.exercise_logs
  add column if not exists weight_kg double precision check (weight_kg >= 0);
