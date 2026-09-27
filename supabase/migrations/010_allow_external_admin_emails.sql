-- Students remain restricted to 6802xxxx@up.ac.th. Password accounts using a
-- general email are created as pending_admin and have no application access
-- until a trusted project owner promotes the exact profile to admin.

alter table public.users
  drop constraint users_email_format,
  drop constraint users_student_id_format,
  drop constraint users_role_check,
  alter column student_id drop not null,
  add constraint users_email_format check (
    (role = 'student' and email ~* '^6802[0-9]{4}@up\.ac\.th$')
    or (role in ('admin', 'pending_admin') and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ) not valid,
  add constraint users_student_id_format check (
    (role = 'student' and student_id ~ '^6802[0-9]{4}$')
    or (role = 'pending_admin' and student_id is null)
    or (role = 'admin' and (student_id is null or student_id ~ '^6802[0-9]{4}$'))
  ) not valid,
  add constraint users_role_check check (role in ('student', 'admin', 'pending_admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
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

  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(normalized_email, '@', 1)
  );
  insert into public.users (uid, email, student_id, full_name, role)
  values (new.id, normalized_email, profile_student_id, display_name, initial_role)
  on conflict (uid) do update set
    email = excluded.email,
    student_id = excluded.student_id,
    full_name = excluded.full_name;
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_password_session() and exists (
    select 1 from public.users
    where uid = (select auth.uid())
      and role = 'admin'
      and (
        (email ~* '^6802[0-9]{4}@up\.ac\.th$' and student_id ~ '^6802[0-9]{4}$')
        or (student_id is null and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      )
  );
$$;

create or replace function private.has_app_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_cohort_member() or private.is_admin();
$$;

drop policy if exists cohort_members_only on public.users;
drop policy if exists cohort_members_only on public.subjects;
drop policy if exists cohort_members_only on public.enrollments;
drop policy if exists cohort_members_only on public.posts;
drop policy if exists cohort_members_only on public.assignments;
drop policy if exists cohort_members_only on public.user_task_progress;

create policy application_members_only on public.users as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy application_members_only on public.subjects as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy application_members_only on public.enrollments as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy application_members_only on public.posts as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy application_members_only on public.assignments as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy application_members_only on public.user_task_progress as restrictive for all to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));

create or replace view public.public_profiles as
select uid, full_name from public.users
where private.has_app_access();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke all on function private.has_app_access() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_app_access() to authenticated;
grant execute on function private.is_admin() to authenticated;

