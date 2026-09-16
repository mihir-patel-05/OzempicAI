-- Guard invalid health entries and keep per-user timeline queries fast.
alter table public.users
  add constraint users_calorie_goal_positive check (daily_calorie_goal > 0),
  add constraint users_water_goal_positive check (daily_water_goal_ml > 0);

alter table public.calorie_logs
  add constraint calorie_logs_calories_positive check (calories > 0);

alter table public.water_logs
  add constraint water_logs_amount_positive check (amount_ml > 0);

alter table public.exercise_logs
  add constraint exercise_logs_duration_positive check (duration_minutes > 0),
  add constraint exercise_logs_calories_nonnegative check (calories_burned >= 0);

alter table public.heart_rate_logs
  add constraint heart_rate_logs_bpm_range check (bpm between 31 and 239);

alter table public.meal_plans
  add constraint meal_plans_calories_positive check (calories > 0);

create index calorie_logs_user_logged_at_idx on public.calorie_logs (user_id, logged_at desc);
create index water_logs_user_logged_at_idx on public.water_logs (user_id, logged_at desc);
create index exercise_logs_user_logged_at_idx on public.exercise_logs (user_id, logged_at desc);
create index heart_rate_logs_user_recorded_at_idx on public.heart_rate_logs (user_id, recorded_at desc);
create index meal_plans_user_planned_date_idx on public.meal_plans (user_id, planned_date);
create index grocery_items_user_purchased_idx on public.grocery_items (user_id, is_purchased, created_at desc);
