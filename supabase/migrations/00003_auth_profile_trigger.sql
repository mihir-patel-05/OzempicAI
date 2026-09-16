-- Guarantee every Supabase Auth account has a matching application profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Covers accounts created before this trigger was installed.
insert into public.users (id, email, name)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'name', '')
from auth.users
on conflict (id) do nothing;
