-- Read-only meal-timing analytics. Returns one row per calorie entry with its
-- local calendar day and minute of day so the client can bucket by hour,
-- meal type, and weekday. Executes as the caller so row-level security holds.

create or replace function public.get_analytics_meal_entries(
  p_start date,
  p_end date,
  p_timezone text
)
returns table (
  day date,
  minute_of_day int,
  iso_dow int,
  meal_type text,
  calories int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  if p_start is null or p_end is null then
    raise exception 'Analytics dates are required';
  end if;

  if p_end < p_start then
    raise exception 'Analytics end date must not precede the start date';
  end if;

  if p_end - p_start > 365 then
    raise exception 'Analytics range cannot exceed 366 days';
  end if;

  if p_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Unknown analytics timezone: %', coalesce(p_timezone, '(null)');
  end if;

  range_start := p_start::timestamp at time zone p_timezone;
  range_end := (p_end + 1)::timestamp at time zone p_timezone;

  return query
  select
    (entry.logged_at at time zone p_timezone)::date,
    (
      extract(hour from entry.logged_at at time zone p_timezone) * 60
      + extract(minute from entry.logged_at at time zone p_timezone)
    )::int,
    extract(isodow from entry.logged_at at time zone p_timezone)::int,
    entry.meal_type,
    entry.calories
  from public.calorie_logs entry
  where entry.user_id = (select auth.uid())
    and entry.logged_at >= range_start
    and entry.logged_at < range_end
  order by entry.logged_at;
end;
$$;

revoke execute on function public.get_analytics_meal_entries(date, date, text) from public, anon;

grant execute on function public.get_analytics_meal_entries(date, date, text) to authenticated;

comment on function public.get_analytics_meal_entries(date, date, text) is
  'Returns calorie entries with local day and minute of day for the authenticated user.';
