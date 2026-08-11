-- Adds weight tracking columns to exercise_logs.
-- Previously applied by hand via supabase_add_weight.sql; folded in here so a
-- fresh project matches the live one. Idempotent — safe to re-run.

alter table public.exercise_logs
  add column if not exists weight      double precision,
  add column if not exists weight_unit text default 'lb';
