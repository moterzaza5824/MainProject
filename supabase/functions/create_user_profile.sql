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
  initial_role text;
  profile_student_id text;
  is_password_account boolean := coalesce(new.encrypted_password, '') <> ''
    and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email';
begin
  if normalized_email ~ '^6802[0-9]{4}@up\.ac\.th$' then
    initial_role := 'student';
    profile_student_id := split_part(normalized_email, '@', 1);
  elsif normalized_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and is_password_account then
    initial_role := 'pending_admin';
    profile_student_id := null;
  else
    raise exception 'Students must use 6802xxxx@up.ac.th; external accounts must be created with a password';
  end if;
  display_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(normalized_email, '@', 1));
  insert into public.users (uid, email, student_id, full_name, role)
  values (new.id, normalized_email, profile_student_id, display_name, initial_role)
  on conflict (uid) do update set email = excluded.email, student_id = excluded.student_id, full_name = excluded.full_name;
  return new;
end;
$$;
