-- Database authorization. Browser guards are UX only; these rules are authoritative.

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users where uid = (select auth.uid()) and role = 'admin');
$$;

create or replace function private.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    new.uid = old.uid;
    new.email = old.email;
    new.student_id = old.student_id;
    new.role = old.role;
  end if;
  return new;
end;
$$;

create or replace function private.prepare_post_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  actor public.users%rowtype;
begin
  if actor_id is null then return new; end if;
  select * into actor from public.users where uid = actor_id;
  if not found then raise exception 'application profile not found'; end if;

  if tg_op = 'INSERT' then
    if actor.role <> 'admin' and (
      select count(*) from public.posts where author_id = actor_id and created_at > now() - interval '1 minute'
    ) >= 3 then
      raise exception 'สร้างประกาศได้ไม่เกิน 3 ครั้งต่อนาที กรุณารอสักครู่';
    end if;
    new.author_id = actor_id;
    new.author_name = actor.full_name;
  else
    new.author_id = old.author_id;
    new.author_name = old.author_name;
    new.created_at = old.created_at;
  end if;

  if actor.role <> 'admin' then
    if new.category = 'official' then
      new.status = 'pending';
      new.is_pinned = false;
      new.approved_by = null;
    else
      new.status = 'published';
      if tg_op = 'UPDATE' and old.category = 'general' then
        new.is_pinned = old.is_pinned;
        new.approved_by = old.approved_by;
      else
        new.is_pinned = false;
        new.approved_by = null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger users_protect_fields before update on public.users for each row execute function private.protect_profile_fields();
create trigger posts_prepare_write before insert or update on public.posts for each row execute function private.prepare_post_write();

revoke all on table public.users, public.subjects, public.enrollments, public.posts, public.assignments, public.user_task_progress from anon, authenticated;
revoke all on table public.public_profiles from anon, authenticated;
grant select, update on table public.users to authenticated;
grant select, insert, update, delete on table public.subjects, public.enrollments, public.posts, public.assignments, public.user_task_progress to authenticated;
grant select on table public.public_profiles to authenticated;

alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.posts enable row level security;
alter table public.assignments enable row level security;
alter table public.user_task_progress enable row level security;

create policy users_select_self_or_admin on public.users for select to authenticated
using ((select auth.uid()) = uid or (select private.is_admin()));
create policy users_update_self_or_admin on public.users for update to authenticated
using ((select auth.uid()) = uid or (select private.is_admin()))
with check ((select auth.uid()) = uid or (select private.is_admin()));

create policy subjects_select_authenticated on public.subjects for select to authenticated using (true);
create policy subjects_insert_admin on public.subjects for insert to authenticated with check ((select private.is_admin()));
create policy subjects_update_admin on public.subjects for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy subjects_delete_admin on public.subjects for delete to authenticated using ((select private.is_admin()));

create policy enrollments_select_own_or_admin on public.enrollments for select to authenticated
using ((select auth.uid()) = uid or (select private.is_admin()));
create policy enrollments_insert_own_or_admin on public.enrollments for insert to authenticated
with check ((select auth.uid()) = uid or (select private.is_admin()));
create policy enrollments_update_own_or_admin on public.enrollments for update to authenticated
using ((select auth.uid()) = uid or (select private.is_admin()))
with check ((select auth.uid()) = uid or (select private.is_admin()));
create policy enrollments_delete_own_or_admin on public.enrollments for delete to authenticated
using ((select auth.uid()) = uid or (select private.is_admin()));

create policy posts_select_visible on public.posts for select to authenticated
using (
  (select private.is_admin()) or author_id = (select auth.uid())
  or (status = 'published' and category = 'general')
  or (status = 'published' and category = 'official' and exists (
    select 1 from public.enrollments e
    where e.uid = (select auth.uid()) and e.subject_id = posts.subject_id
      and (posts.target_scope = 'ALL' or e.section = any(posts.target_sections))
  ))
);
create policy posts_insert_own_or_admin on public.posts for insert to authenticated
with check (author_id = (select auth.uid()) or (select private.is_admin()));
create policy posts_update_own_or_admin on public.posts for update to authenticated
using (author_id = (select auth.uid()) or (select private.is_admin()))
with check (author_id = (select auth.uid()) or (select private.is_admin()));
create policy posts_delete_own_or_admin on public.posts for delete to authenticated
using (author_id = (select auth.uid()) or (select private.is_admin()));

create policy assignments_select_enrolled_or_admin on public.assignments for select to authenticated
using (
  (select private.is_admin()) or exists (
    select 1 from public.enrollments e
    where e.uid = (select auth.uid()) and e.subject_id = assignments.subject_id
      and (assignments.schedule_mode = 'UNIFIED' or assignments.due_dates ? ('sec_' || e.section::text))
  )
);
create policy assignments_insert_admin on public.assignments for insert to authenticated with check ((select private.is_admin()));
create policy assignments_update_admin on public.assignments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy assignments_delete_admin on public.assignments for delete to authenticated using ((select private.is_admin()));

create policy progress_select_own on public.user_task_progress for select to authenticated
using ((select auth.uid()) = uid);
create policy progress_insert_own on public.user_task_progress for insert to authenticated with check ((select auth.uid()) = uid);
create policy progress_update_own on public.user_task_progress for update to authenticated
using ((select auth.uid()) = uid) with check ((select auth.uid()) = uid);
create policy progress_delete_own on public.user_task_progress for delete to authenticated using ((select auth.uid()) = uid);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.valid_attachments(jsonb) to authenticated;
grant execute on function private.valid_resources(text[]) to authenticated;
grant execute on function private.valid_due_dates(text, jsonb) to authenticated;
