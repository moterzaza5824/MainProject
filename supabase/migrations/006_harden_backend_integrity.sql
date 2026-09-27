-- Tighten immutable ownership fields and prevent progress writes for tasks the
-- current user cannot access through assignment RLS.

create or replace function private.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.uid = old.uid;
    new.email = old.email;
    new.student_id = old.student_id;
    if not private.is_admin() then new.role = old.role; end if;
  end if;
  return new;
end;
$$;

create or replace function private.prepare_subject_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by = (select auth.uid());
  else
    new.created_by = old.created_by;
    new.created_at = old.created_at;
  end if;
  return new;
end;
$$;

create or replace function private.prepare_assignment_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by = (select auth.uid());
  else
    new.created_by = old.created_by;
    new.created_at = old.created_at;
  end if;
  return new;
end;
$$;

create trigger subjects_prepare_write
before insert or update on public.subjects
for each row execute function private.prepare_subject_write();

create trigger assignments_prepare_write
before insert or update on public.assignments
for each row execute function private.prepare_assignment_write();

drop policy progress_insert_own on public.user_task_progress;
create policy progress_insert_visible_assignment on public.user_task_progress
for insert to authenticated
with check (
  (select auth.uid()) = uid
  and exists (
    select 1 from public.assignments as visible_assignment
    where visible_assignment.assignment_id = user_task_progress.assignment_id
  )
);

drop policy progress_update_own on public.user_task_progress;
create policy progress_update_visible_assignment on public.user_task_progress
for update to authenticated
using ((select auth.uid()) = uid)
with check (
  (select auth.uid()) = uid
  and exists (
    select 1 from public.assignments as visible_assignment
    where visible_assignment.assignment_id = user_task_progress.assignment_id
  )
);

revoke all on function private.prepare_subject_write() from public, anon, authenticated;
revoke all on function private.prepare_assignment_write() from public, anon, authenticated;
