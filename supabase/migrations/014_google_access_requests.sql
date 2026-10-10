-- External Google accounts may authenticate, but only approved requests grant
-- student access. Request identities and review decisions are owned by the DB.
alter table public.users
  drop constraint users_email_format,
  drop constraint users_student_id_format,
  drop constraint users_role_check,
  add constraint users_email_format check (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (role <> 'student' or student_id is null or email ~* '^6802[0-9]{4}@up\.ac\.th$')
  ) not valid,
  add constraint users_student_id_format check (
    (role = 'student' and (student_id is null or student_id ~ '^6802[0-9]{4}$'))
    or (role in ('pending_admin', 'pending_member') and student_id is null)
    or (role = 'admin' and (student_id is null or student_id ~ '^6802[0-9]{4}$'))
  ) not valid,
  add constraint users_role_check check (role in ('student', 'admin', 'pending_admin', 'pending_member'));

create table public.access_requests (
  uid uuid primary key constraint access_requests_uid_fkey references public.users(uid) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(uid),
  constraint access_requests_review_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);
create index access_requests_status_created_idx on public.access_requests(status, created_at, uid);
alter table public.access_requests enable row level security;
revoke all on table public.access_requests from anon, authenticated;
grant select on table public.access_requests to authenticated;
create policy access_requests_select_own_or_admin on public.access_requests for select to authenticated
using (uid = (select auth.uid()) or (select private.is_admin()));

create or replace function private.is_google_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'provider' = 'google'
      or (select auth.jwt()) -> 'app_metadata' -> 'providers' @> '["google"]'::jsonb)
    and exists (
      select 1 from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) entry
      where entry ->> 'method' = 'oauth'
    ), false
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  display_name text;
  initial_role text;
  profile_student_id text;
begin
  if normalized_email ~ '^6802[0-9]{4}@up\.ac\.th$' then
    initial_role := 'student';
    profile_student_id := split_part(normalized_email, '@', 1);
  elsif normalized_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and new.raw_app_meta_data ->> 'provider' = 'google' then
    initial_role := 'pending_member';
  elsif normalized_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and coalesce(new.encrypted_password, '') <> ''
    and new.raw_app_meta_data ->> 'provider' = 'email' then
    initial_role := 'pending_admin';
  else
    raise exception 'Use Google sign-in or an administrator password account';
  end if;
  display_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(normalized_email, '@', 1));
  insert into public.users(uid, email, student_id, full_name, role)
  values (new.id, normalized_email, profile_student_id, display_name, initial_role)
  on conflict (uid) do nothing;
  return new;
end;
$$;

create or replace function private.has_app_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_cohort_member() or private.is_admin() or (
    private.is_google_session() and exists (
      select 1 from public.access_requests r
      join public.users u on u.uid = r.uid
      join auth.users a on a.id = u.uid
      where r.uid = (select auth.uid()) and r.status = 'approved'
        and u.role in ('student', 'admin') and a.email_confirmed_at is not null
    )
  );
$$;

-- Pending accounts may read their own profile, but all existing application
-- tables retain the restrictive has_app_access gate for reads and writes.
drop policy application_members_only on public.users;
create policy application_members_read on public.users as restrictive for select to authenticated
using (uid = (select auth.uid()) or (select private.has_app_access()));
create policy application_members_update on public.users as restrictive for update to authenticated
using ((select private.has_app_access())) with check ((select private.has_app_access()));

create or replace function public.request_app_access()
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not private.is_google_session() or not exists (
    select 1 from auth.users a join public.users u on u.uid = a.id
    where a.id = actor_id and a.email_confirmed_at is not null
      and lower(a.email) = u.email and u.email !~* '^6802[0-9]{4}@up\.ac\.th$'
  ) then
    raise exception 'เฉพาะบัญชี Google ที่ต้องขอสิทธิ์เท่านั้น' using errcode = '42501';
  end if;
  insert into public.access_requests(uid) values (actor_id)
  on conflict (uid) do nothing;
end;
$$;

create or replace function public.review_app_access(requested_uid uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'ไม่มีสิทธิ์ดำเนินการ' using errcode = '42501';
  end if;
  if decision is null or decision not in ('approve', 'reject') then
    raise exception 'ผลการตรวจสอบไม่ถูกต้อง';
  end if;
  update public.access_requests
    set status = case when decision = 'approve' then 'approved' else 'rejected' end,
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where uid = requested_uid and status = 'pending';
  if not found then
    raise exception 'คำขอนี้ถูกดำเนินการแล้ว กรุณาโหลดใหม่';
  end if;
  if decision = 'approve' then
    update public.users set role = 'student'
      where uid = requested_uid and role in ('pending_member', 'pending_admin');
  end if;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_google_session() from public, anon, authenticated;
revoke all on function public.request_app_access() from public, anon, authenticated;
revoke all on function public.review_app_access(uuid, text) from public, anon, authenticated;
grant execute on function private.is_google_session() to authenticated;
grant execute on function public.request_app_access() to authenticated;
grant execute on function public.review_app_access(uuid, text) to authenticated;
