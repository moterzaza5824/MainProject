-- Remote-safe RLS smoke test. Every test row is created inside this transaction
-- and removed by the final ROLLBACK.

begin;

do $$
declare was_rejected boolean := false;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    values ('44444444-4444-4444-8444-444444444444', '68019999@up.ac.th', '{"full_name":"Outside Cohort"}', now(), now());
  exception when others then
    was_rejected := true;
  end;
  if not was_rejected then raise exception 'non-6802 account was accepted'; end if;
end;
$$;

do $$
declare was_rejected boolean := false;
begin
  begin
    insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      '55555555-5555-4555-8555-555555555555', 'external-google@example.com',
      '{"provider":"google","providers":["google"]}', '{"full_name":"External Google"}', now(), now()
    );
  exception when others then
    was_rejected := true;
  end;
  if not was_rejected then raise exception 'external OAuth account was accepted'; end if;
end;
$$;

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '66666666-6666-4666-8666-666666666666', 'external-admin@example.com', 'test-password-hash',
  '{"provider":"email","providers":["email"]}', '{"full_name":"External Admin"}', now(), now()
);

do $$
declare saved_role text; saved_student_id text;
begin
  select role, student_id into saved_role, saved_student_id
  from public.users where uid = '66666666-6666-4666-8666-666666666666';
  if saved_role <> 'pending_admin' or saved_student_id is not null then
    raise exception 'external password account did not start as pending_admin';
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '68029991@up.ac.th', '{"full_name":"RLS Student One"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '68029992@up.ac.th', '{"full_name":"RLS Student Two"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '68029993@up.ac.th', '{"full_name":"RLS Admin"}', now(), now());

update public.users
set role = 'admin'
where uid = '33333333-3333-4333-8333-333333333333';

update public.users
set role = 'admin'
where uid = '66666666-6666-4666-8666-666666666666' and role = 'pending_admin';

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

do $$
declare was_blocked boolean := false;
begin
  begin
    insert into public.assignments (
      assignment_id, created_by, subject_id, subject_name, academic_year, semester,
      title, description, submission_channel, schedule_mode, due_dates, resources
    ) values (
      'b9999999-9999-4999-8999-999999999999', '33333333-3333-4333-8333-333333333333',
      'a1111111-1111-4111-8111-111111111111', 'RLS Subject One', 2699, '1',
      'Invalid calendar date', 'Must be rejected', 'Test channel', 'UNIFIED',
      '{"all":"2099-02-31T00:00:00Z"}', '[]'
    );
  exception when check_violation then
    was_blocked := true;
  end;
  if not was_blocked then raise exception 'impossible calendar date was accepted'; end if;
end;
$$;

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
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","amr":[{"method":"oauth","timestamp":1}]}', true);

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

update public.users set full_name = 'Forged Admin Name'
where uid = '11111111-1111-4111-8111-111111111111';

do $$
declare actual_role text; actual_name text;
begin
  select role, full_name into actual_role, actual_name from public.users where uid = '11111111-1111-4111-8111-111111111111';
  if actual_role <> 'student' then raise exception 'student changed own role'; end if;
  if actual_name <> 'RLS Student One' then raise exception 'student changed own verified name'; end if;
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
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","amr":[{"method":"oauth","timestamp":1}]}', true);

do $$
declare was_blocked boolean := false;
begin
  begin
    insert into public.subjects (subject_id, name, academic_year, semester, section_count, created_by)
    values (
      'a4444444-4444-4444-8444-444444444444', 'OAuth admin must be blocked', 2699, '1', 1,
      '33333333-3333-4333-8333-333333333333'
    );
  exception when insufficient_privilege then
    was_blocked := true;
  end;
  if not was_blocked then raise exception 'OAuth session received administrator write access'; end if;
end;
$$;

insert into public.posts (
  post_id, author_id, author_name, title, content, category, status, is_pinned,
  subject_id, subject_name, target_scope, target_sections, approved_by
)
values (
  'c3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333',
  'Forged OAuth admin', 'OAuth admin request', 'Must receive student moderation', 'official', 'published', true,
  'a1111111-1111-4111-8111-111111111111', 'RLS Subject One', 'ALL', '{}',
  '33333333-3333-4333-8333-333333333333'
);

do $$
declare saved_post public.posts%rowtype;
begin
  select * into saved_post from public.posts where post_id = 'c3333333-3333-4333-8333-333333333333';
  if saved_post.status <> 'pending' or saved_post.is_pinned or saved_post.approved_by is not null then
    raise exception 'OAuth admin bypassed student moderation rules';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","amr":[{"method":"password","timestamp":1}]}', true);

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

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","amr":[{"method":"password","timestamp":1}]}', true);

insert into public.subjects (subject_id, name, academic_year, semester, section_count, created_by)
values (
  'a6666666-6666-4666-8666-666666666666', 'External admin subject', 2699, '1', 1,
  '11111111-1111-4111-8111-111111111111'
);

do $$
declare actual_owner uuid;
begin
  select created_by into actual_owner from public.subjects where subject_id = 'a6666666-6666-4666-8666-666666666666';
  if actual_owner <> '66666666-6666-4666-8666-666666666666' then
    raise exception 'external password admin did not receive administrator access';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","amr":[{"method":"oauth","timestamp":1}]}', true);

do $$
declare was_blocked boolean := false;
begin
  begin
    insert into public.subjects (subject_id, name, academic_year, semester, section_count, created_by)
    values (
      'a7777777-7777-4777-8777-777777777777', 'External OAuth must be blocked', 2699, '1', 1,
      '66666666-6666-4666-8666-666666666666'
    );
  exception when insufficient_privilege then
    was_blocked := true;
  end;
  if not was_blocked then raise exception 'external OAuth session received application access'; end if;
end;
$$;

reset role;
rollback;

select 'Supabase RLS smoke test passed; transaction rolled back.' as result;
