-- Let each account choose how measurements are displayed. Values stay metric
-- in the database; this only drives presentation and input parsing.
alter table public.users
  add column unit_system text not null default 'metric'
    check (unit_system in ('metric', 'imperial'));
