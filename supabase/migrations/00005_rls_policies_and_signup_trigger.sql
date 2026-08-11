-- Granular per-command RLS policies, the signup trigger that creates a
-- public.users row, and a backfill for auth users predating that trigger.
--
-- Previously applied by hand via supabase_fix_rls.sql; folded in here so a fresh
-- project matches the live one. Idempotent — safe to re-run.
--
-- NOTE ON REDUNDANCY: 00001 already created broad `for all using (auth.uid() =
-- ...)` policies on these tables. Permissive policies are OR'd together, so the
-- policies below grant nothing that 00001 did not already allow. They are kept
-- because they are what is deployed, and because dropping the 00001 policies
-- would silently revoke UPDATE on the log tables (the granular set covers only
-- select/insert/delete there). The app currently issues select/insert/delete
-- only, but that is not a reason to narrow the live grants as a side effect of a
-- bookkeeping change.

-- ─── Users ───────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile" on public.users
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile" on public.users
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Calorie Logs ─────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own calorie logs" on public.calorie_logs;
create policy "Users can insert own calorie logs" on public.calorie_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own calorie logs" on public.calorie_logs;
create policy "Users can read own calorie logs" on public.calorie_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own calorie logs" on public.calorie_logs;
create policy "Users can delete own calorie logs" on public.calorie_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Water Logs ───────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own water logs" on public.water_logs;
create policy "Users can insert own water logs" on public.water_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own water logs" on public.water_logs;
create policy "Users can read own water logs" on public.water_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own water logs" on public.water_logs;
create policy "Users can delete own water logs" on public.water_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Exercise Logs ────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own exercise logs" on public.exercise_logs;
create policy "Users can insert own exercise logs" on public.exercise_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own exercise logs" on public.exercise_logs;
create policy "Users can read own exercise logs" on public.exercise_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own exercise logs" on public.exercise_logs;
create policy "Users can delete own exercise logs" on public.exercise_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Heart Rate Logs ──────────────────────────────────────────────────────────
drop policy if exists "Users can insert own heart rate logs" on public.heart_rate_logs;
create policy "Users can insert own heart rate logs" on public.heart_rate_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own heart rate logs" on public.heart_rate_logs;
create policy "Users can read own heart rate logs" on public.heart_rate_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own heart rate logs" on public.heart_rate_logs;
create policy "Users can delete own heart rate logs" on public.heart_rate_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Meal Plans ───────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own meal plans" on public.meal_plans;
create policy "Users can insert own meal plans" on public.meal_plans
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own meal plans" on public.meal_plans;
create policy "Users can read own meal plans" on public.meal_plans
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own meal plans" on public.meal_plans;
create policy "Users can delete own meal plans" on public.meal_plans
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Grocery Items ────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own grocery items" on public.grocery_items;
create policy "Users can insert own grocery items" on public.grocery_items
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own grocery items" on public.grocery_items;
create policy "Users can read own grocery items" on public.grocery_items
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update own grocery items" on public.grocery_items;
create policy "Users can update own grocery items" on public.grocery_items
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own grocery items" on public.grocery_items;
create policy "Users can delete own grocery items" on public.grocery_items
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Auto-create profile row on signup ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Backfill profiles for auth users predating the trigger ───────────────────
-- No-op on a fresh boot (auth.users is empty).
insert into public.users (id, email)
select id, email from auth.users
where id not in (select id from public.users)
on conflict (id) do nothing;
