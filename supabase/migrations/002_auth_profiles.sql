-- Create and keep an application profile in sync with Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text;
begin
  if normalized_email !~ '^68[0-9]{6}@up\.ac\.th$' then
    raise exception 'SE68 Hub accepts only 68xxxxxx@up.ac.th accounts';
  end if;
  display_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(normalized_email, '@', 1));
  insert into public.users (uid, email, student_id, full_name, role)
  values (new.id, normalized_email, split_part(normalized_email, '@', 1), display_name, 'student')
  on conflict (uid) do update set email = excluded.email, student_id = excluded.student_id, full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, raw_user_meta_data on auth.users for each row execute function public.handle_new_user();

-- Backfill eligible accounts if Auth was configured before this migration.
insert into public.users (uid, email, student_id, full_name, role)
select
  id,
  lower(email),
  split_part(lower(email), '@', 1),
  coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(raw_user_meta_data ->> 'name'), ''), split_part(lower(email), '@', 1)),
  'student'
from auth.users
where lower(coalesce(email, '')) ~ '^68[0-9]{6}@up\.ac\.th$'
on conflict (uid) do nothing;
