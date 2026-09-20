-- Run this in Supabase Dashboard → SQL Editor
-- Adds normalized weight tracking to exercise_logs. The UI accepts kg or lb;
-- database values are always kilograms.

ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION CHECK (weight_kg >= 0);
