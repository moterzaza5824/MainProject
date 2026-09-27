-- Readable copy. The deployable version is migrations/002_auth_profiles.sql.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
