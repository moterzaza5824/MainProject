-- Restrict application access to Software Engineering cohort IDs beginning 6802.
-- Existing non-matching profiles are preserved for audit/data ownership, but the
-- restrictive RLS policies below prevent them from reading or writing app data.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text;
begin
  if normalized_email !~ '^6802[0-9]{4}@up\.ac\.th$' then
    raise exception 'SE68 Hub accepts only 6802xxxx@up.ac.th accounts';
  end if;
  display_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(normalized_email, '@', 1));
  insert into public.users (uid, email, student_id, full_name, role)
  values (new.id, normalized_email, split_part(normalized_email, '@', 1), display_name, 'student')
  on conflict (uid) do update set email = excluded.email, student_id = excluded.student_id, full_name = excluded.full_name;
  return new;
end;
$$;

alter table public.users
  drop constraint users_email_format,
  drop constraint users_student_id_format,
  add constraint users_email_format check (email ~* '^6802[0-9]{4}@up\.ac\.th$') not valid,
  add constraint users_student_id_format check (student_id ~ '^6802[0-9]{4}$') not valid;

create or replace function private.is_cohort_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where uid = (select auth.uid())
      and email ~* '^6802[0-9]{4}@up\.ac\.th$'
      and student_id ~ '^6802[0-9]{4}$'
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_cohort_member() and exists (
    select 1 from public.users where uid = (select auth.uid()) and role = 'admin'
  );
$$;

create policy cohort_members_only on public.users as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));
create policy cohort_members_only on public.subjects as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));
create policy cohort_members_only on public.enrollments as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));
create policy cohort_members_only on public.posts as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));
create policy cohort_members_only on public.assignments as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));
create policy cohort_members_only on public.user_task_progress as restrictive for all to authenticated
using ((select private.is_cohort_member()))
with check ((select private.is_cohort_member()));

create or replace view public.public_profiles as
select uid, full_name from public.users
where private.is_cohort_member();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_cohort_member() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_cohort_member() to authenticated;
grant execute on function private.is_admin() to authenticated;
