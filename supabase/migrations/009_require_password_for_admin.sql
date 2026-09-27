-- Google/OAuth sessions always receive student-level application access.
-- Administrator authorization requires both the stored admin role and a
-- password-authenticated Supabase session. Browser checks are UX only; this
-- function is the authoritative gate used by every admin RLS policy.

create or replace function private.is_password_session()
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) as methods(entry)
    where entry ->> 'method' = 'password'
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_cohort_member()
    and private.is_password_session()
    and exists (
      select 1 from public.users
      where uid = (select auth.uid()) and role = 'admin'
    );
$$;

-- Server-side moderation must use the same password-session rule as RLS.
-- Reading actor.role directly would incorrectly treat an OAuth session from an
-- admin-designated account as an administrator.
create or replace function private.prepare_post_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  actor public.users%rowtype;
  actor_is_admin boolean;
begin
  if actor_id is null then return new; end if;
  select * into actor from public.users where uid = actor_id;
  if not found then raise exception 'application profile not found'; end if;
  actor_is_admin := private.is_admin();

  if tg_op = 'INSERT' then
    if not actor_is_admin and (
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

  if not actor_is_admin then
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

revoke all on function private.is_password_session() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

