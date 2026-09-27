-- Remote-safe RLS smoke test. Every test row is created inside this transaction
-- and removed by the final ROLLBACK.

begin;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '68999991@up.ac.th', '{"full_name":"RLS Student One"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '68999992@up.ac.th', '{"full_name":"RLS Student Two"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '68999993@up.ac.th', '{"full_name":"RLS Admin"}', now(), now());

update public.users
set role = 'admin'
where uid = '33333333-3333-4333-8333-333333333333';

insert into public.subjects (subject_id, name, academic_year, semester, section_count, created_by)
values
  ('a1111111-1111-4111-8111-111111111111', 'RLS Subject One', 2699, '1', 2, '33333333-3333-4333-8333-333333333333'),
  ('a2222222-2222-4222-8222-222222222222', 'RLS Subject Two', 2699, '1', 2, '33333333-3333-4333-8333-333333333333');

insert into public.enrollments (uid, subject_id, academic_year, semester, section)
values
  ('11111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 2699, '1', 1),
  ('22222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 2699, '1', 1);

insert into public.assignments (
  assignment_id, created_by, subject_id, subject_name, academic_year, semester,
  title, description, submission_channel, schedule_mode, due_dates, resources
)
values
  (
    'b1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333',
    'a1111111-1111-4111-8111-111111111111', 'RLS Subject One', 2699, '1',
    'Visible assignment', 'Visible to student one', 'Test channel', 'UNIFIED',
    '{"all":"2099-01-01T00:00:00Z"}', '[{"name":"Guide","url":"https://example.com/guide"}]'
  ),
  (
    'b2222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
    'a2222222-2222-4222-8222-222222222222', 'RLS Subject Two', 2699, '1',
    'Hidden assignment', 'Hidden from student one', 'Test channel', 'UNIFIED',
    '{"all":"2099-01-01T00:00:00Z"}', '[]'
  );

insert into public.user_task_progress (id, uid, assignment_id, status, note)
values
  ('11111111-1111-4111-8111-111111111111_b1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'TODO', 'student one private note'),
  ('22222222-2222-4222-8222-222222222222_b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'TODO', 'student two private note');

insert into public.posts (
  post_id, author_id, author_name, title, content, category, status,
  subject_id, subject_name, target_scope, target_sections
)
values (
  'c2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'RLS Student Two', 'Student two pending post', 'Private moderation item', 'official', 'pending',
  'a2222222-2222-4222-8222-222222222222', 'RLS Subject Two', 'ALL', '{}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.assignments;
  if visible_count <> 1 then raise exception 'student assignment isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.user_task_progress;
  if visible_count <> 1 then raise exception 'private progress isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.posts where post_id = 'c2222222-2222-4222-8222-222222222222';
  if visible_count <> 0 then raise exception 'pending post isolation failed'; end if;
end;
$$;

update public.users set role = 'admin'
where uid = '11111111-1111-4111-8111-111111111111';

do $$
declare actual_role text;
begin
  select role into actual_role from public.users where uid = '11111111-1111-4111-8111-111111111111';
  if actual_role <> 'student' then raise exception 'student changed own role'; end if;
end;
$$;

do $$
declare was_blocked boolean := false;
begin
  begin
    insert into public.user_task_progress (id, uid, assignment_id, status, note)
    values (
      '11111111-1111-4111-8111-111111111111_b2222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'b2222222-2222-4222-8222-222222222222', 'TODO', 'must be rejected'
    );
  exception when insufficient_privilege then
    was_blocked := true;
  end;
  if not was_blocked then raise exception 'hidden assignment progress write was allowed'; end if;
end;
$$;

insert into public.posts (
  post_id, author_id, author_name, title, content, category, status, is_pinned,
  subject_id, subject_name, target_scope, target_sections, approved_by
)
values (
  'c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333',
  'Forged author', 'Student official request', 'Must enter moderation', 'official', 'published', true,
  'a1111111-1111-4111-8111-111111111111', 'RLS Subject One', 'ALL', '{}',
  '11111111-1111-4111-8111-111111111111'
);

do $$
declare saved_post public.posts%rowtype;
begin
  select * into saved_post from public.posts where post_id = 'c1111111-1111-4111-8111-111111111111';
  if saved_post.author_id <> '11111111-1111-4111-8111-111111111111'
    or saved_post.status <> 'pending'
    or saved_post.is_pinned
    or saved_post.approved_by is not null then
    raise exception 'student moderation fields were not normalized';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

insert into public.subjects (subject_id, name, academic_year, semester, section_count, created_by)
values (
  'a3333333-3333-4333-8333-333333333333', 'Admin-owned subject', 2699, '1', 1,
  '11111111-1111-4111-8111-111111111111'
);

insert into public.assignments (
  assignment_id, created_by, subject_id, subject_name, academic_year, semester,
  title, description, submission_channel, schedule_mode, due_dates, resources
)
values (
  'b3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
  'a3333333-3333-4333-8333-333333333333', 'Admin-owned subject', 2699, '1',
  'Admin assignment', 'Audit owner must be server controlled', 'Test channel', 'UNIFIED',
  '{"all":"2099-01-01T00:00:00Z"}', '[]'
);

do $$
declare visible_count integer; actual_owner uuid;
begin
  select count(*) into visible_count from public.user_task_progress;
  if visible_count <> 0 then raise exception 'admin could read private student progress'; end if;

  select created_by into actual_owner from public.subjects where subject_id = 'a3333333-3333-4333-8333-333333333333';
  if actual_owner <> '33333333-3333-4333-8333-333333333333' then raise exception 'subject owner was forged'; end if;

  select created_by into actual_owner from public.assignments where assignment_id = 'b3333333-3333-4333-8333-333333333333';
  if actual_owner <> '33333333-3333-4333-8333-333333333333' then raise exception 'assignment owner was forged'; end if;
end;
$$;

reset role;
rollback;

select 'Supabase RLS smoke test passed; transaction rolled back.' as result;
