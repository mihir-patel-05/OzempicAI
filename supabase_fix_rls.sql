-- ============================================================
-- OzempicAI: Fix RLS policies for all tables
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. USERS TABLE
-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. CALORIE_LOGS TABLE
CREATE POLICY "Users can insert own calorie logs" ON calorie_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own calorie logs" ON calorie_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calorie logs" ON calorie_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. WATER_LOGS TABLE
CREATE POLICY "Users can insert own water logs" ON water_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own water logs" ON water_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water logs" ON water_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. EXERCISE_LOGS TABLE
CREATE POLICY "Users can insert own exercise logs" ON exercise_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own exercise logs" ON exercise_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise logs" ON exercise_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. HEART_RATE_LOGS TABLE
CREATE POLICY "Users can insert own heart rate logs" ON heart_rate_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own heart rate logs" ON heart_rate_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own heart rate logs" ON heart_rate_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. MEAL_PLANS TABLE
CREATE POLICY "Users can insert own meal plans" ON meal_plans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own meal plans" ON meal_plans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal plans" ON meal_plans
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. GROCERY_ITEMS TABLE
CREATE POLICY "Users can insert own grocery items" ON grocery_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own grocery items" ON grocery_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery items" ON grocery_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery items" ON grocery_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 8. AUTO-CREATE USER PROFILE ON SIGNUP
-- This trigger automatically creates a row in the users table
-- when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Drop the trigger if it already exists, then create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. BACKFILL: Create profile rows for any existing auth users
-- who don't have a profile yet
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
