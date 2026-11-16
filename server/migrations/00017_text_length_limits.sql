-- Ceilings on every free-text column a client can write (security report
-- SEC-03, SEC-18). The API checks tighter limits first (200 characters for
-- names, 2,000 for notes); these are the backstop for any path that forgets.
--
-- NOT VALID: the limit applies to every insert and update from now on, but
-- rows that already exist are not checked, so this migration cannot fail on
-- old data. An existing over-long row can still be read and deleted; it can
-- only be updated once shortened.

alter table public.users
  add constraint users_name_length check (char_length(name) <= 300) not valid;
alter table public.calorie_logs
  add constraint calorie_logs_food_name_length check (char_length(food_name) <= 300) not valid;
alter table public.exercise_logs
  add constraint exercise_logs_exercise_name_length check (char_length(exercise_name) <= 300) not valid;
alter table public.meal_plans
  add constraint meal_plans_name_length check (char_length(name) <= 300) not valid;
alter table public.grocery_items
  add constraint grocery_items_name_length check (char_length(name) <= 300) not valid;
alter table public.day_labels
  add constraint day_labels_label_length check (char_length(label) <= 300) not valid;

alter table public.workout_plans
  add constraint workout_plans_name_length check (char_length(name) <= 300) not valid,
  add constraint workout_plans_notes_length check (char_length(notes) <= 4000) not valid;
alter table public.workout_plan_exercises
  add constraint workout_plan_exercises_name_length check (char_length(exercise_name) <= 300) not valid,
  add constraint workout_plan_exercises_machine_length check (char_length(machine) <= 300) not valid;
alter table public.workout_sessions
  add constraint workout_sessions_name_length check (char_length(name) <= 300) not valid,
  add constraint workout_sessions_notes_length check (char_length(notes) <= 4000) not valid;
alter table public.workout_session_exercises
  add constraint workout_session_exercises_name_length check (char_length(exercise_name) <= 300) not valid,
  add constraint workout_session_exercises_machine_length check (char_length(machine) <= 300) not valid;

alter table public.ai_conversations
  add constraint ai_conversations_title_length check (char_length(title) <= 300) not valid;
alter table public.agent_activity
  add constraint agent_activity_text_length check (
    char_length(client_name) <= 300 and char_length(tool_name) <= 300
    and char_length(summary) <= 1000 and char_length(resource) <= 300
  ) not valid;
