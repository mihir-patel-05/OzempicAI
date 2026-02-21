-- Run this in Supabase Dashboard → SQL Editor
-- Adds weight tracking columns to exercise_logs

ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lb';
