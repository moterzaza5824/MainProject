-- Run after migration 014. Test identities are isolated and rolled back.
begin;
insert into auth.users(id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('90111111-1111-4111-8111-111111111111','access-admin@example.com','test-hash','{"provider":"email","providers":["email","google"]}','{"full_name":"Access Admin"}',now(),now(),now()),
  ('90222222-2222-4222-8222-222222222222','access-guest@gmail.com',null,'{"provider":"google","providers":["google"]}','{"full_name":"Access Guest"}',now(),now(),now()),
  ('90333333-3333-4333-8333-333333333333','access-rejected@gmail.com',null,'{"provider":"google","providers":["google"]}','{"full_name":"Rejected Guest"}',now(),now(),now()),
  ('90444444-4444-4444-8444-444444444444','access-unverified@gmail.com',null,'{"provider":"google","providers":["google"]}','{"full_name":"Unverified Guest"}',null,now(),now());
update public.users set role = 'admin' where uid = '90111111-1111-4111-8111-111111111111';
insert into public.subjects(subject_id,name,academic_year,semester,section_count)
values ('90555555-5555-4555-8555-555555555555','Access Test Course',2699,'1',1);
insert into public.assignments(assignment_id,created_by,subject_id,subject_name,academic_year,semester,title,description,submission_channel,schedule_mode,due_dates)
values ('90666666-6666-4666-8666-666666666666','90111111-1111-4111-8111-111111111111','90555555-5555-4555-8555-555555555555','Access Test Course',2699,'1','Access Test Task','Details','Teams','UNIFIED','{"all":"2099-01-01T00:00:00Z"}');
insert into public.posts(post_id,author_id,author_name,title,content,category,status,target_scope)
values ('90777777-7777-4777-8777-777777777777','90111111-1111-4111-8111-111111111111','Access Admin','General Access News','Details','general','published','ALL');

set local role authenticated;
select set_config('request.jwt.claim.sub','90222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"90222222-2222-4222-8222-222222222222","app_metadata":{"provider":"google","providers":["google"]},"amr":[{"method":"oauth"}]}',true);
do $$
declare blocked boolean := false;
begin
  if private.has_app_access() then raise exception 'pending user has app access'; end if;
  if (select count(*) from public.users) <> 1 then raise exception 'pending profile visibility is incorrect'; end if;
  if exists(select 1 from public.subjects) or exists(select 1 from public.posts)
    or exists(select 1 from public.assignments) or exists(select 1 from public.enrollments)
    or exists(select 1 from public.user_task_progress) or exists(select 1 from public.public_profiles) then
    raise exception 'pending user can read application data';
  end if;
  begin
    insert into public.access_requests(uid,status) values ('90222222-2222-4222-8222-222222222222','approved');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'direct request insertion was allowed'; end if;
end;
$$;
select public.request_app_access();
select public.request_app_access();
do $$
declare blocked boolean := false;
begin
  if (select count(*) from public.access_requests) <> 1 then raise exception 'duplicate request created'; end if;
  if (select status from public.access_requests) <> 'pending' then raise exception 'request was not pending'; end if;
  begin
    perform public.review_app_access('90222222-2222-4222-8222-222222222222','approve');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'self approval allowed'; end if;
  update public.users set role='admin' where uid='90222222-2222-4222-8222-222222222222';
  if (select role from public.users where uid='90222222-2222-4222-8222-222222222222') <> 'pending_member' then
    raise exception 'pending user escalated profile role';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','90333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"90333333-3333-4333-8333-333333333333","app_metadata":{"provider":"google"},"amr":[{"method":"oauth"}]}',true);
do $$ begin
  if exists(select 1 from public.access_requests) then raise exception 'another account request is visible'; end if;
end; $$;
select public.request_app_access();

select set_config('request.jwt.claim.sub','90444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"sub":"90444444-4444-4444-8444-444444444444","app_metadata":{"provider":"google"},"amr":[{"method":"oauth"}]}',true);
do $$
declare blocked boolean := false;
begin
  begin perform public.request_app_access(); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'unverified email request accepted'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','90111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"90111111-1111-4111-8111-111111111111","app_metadata":{"provider":"email","providers":["email","google"]},"amr":[{"method":"oauth"}]}',true);
do $$
declare blocked boolean := false;
begin
  begin perform public.review_app_access('90222222-2222-4222-8222-222222222222','approve');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'OAuth admin reviewed request'; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"90111111-1111-4111-8111-111111111111","app_metadata":{"provider":"email"},"amr":[{"method":"password"}]}',true);
do $$ begin
  if (select count(*) from public.access_requests r join public.users u on u.uid = r.uid) <> 2 then
    raise exception 'admin cannot read request identities';
  end if;
end; $$;
select public.review_app_access('90222222-2222-4222-8222-222222222222','approve');
select public.review_app_access('90333333-3333-4333-8333-333333333333','reject');
do $$
declare blocked boolean := false;
begin
  begin perform public.review_app_access('90222222-2222-4222-8222-222222222222','reject');
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'stale review changed approved decision'; end if;
  if (select role from public.users where uid='90222222-2222-4222-8222-222222222222') <> 'student' then
    raise exception 'approval did not grant student role';
  end if;
  if exists(select 1 from public.access_requests where reviewed_by <> '90111111-1111-4111-8111-111111111111' or reviewed_at is null) then
    raise exception 'review audit missing';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','90222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"90222222-2222-4222-8222-222222222222","app_metadata":{"provider":"google"},"amr":[{"method":"oauth"}]}',true);
do $$ begin
  if not private.has_app_access() or private.is_admin() then raise exception 'approved user permissions incorrect'; end if;
  if not exists(select 1 from public.subjects where subject_id='90555555-5555-4555-8555-555555555555') then
    raise exception 'approved user cannot select courses';
  end if;
  if not exists(select 1 from public.posts where post_id='90777777-7777-4777-8777-777777777777') then
    raise exception 'approved user cannot read general news';
  end if;
end; $$;
insert into public.enrollments(uid,subject_id,section) values ('90222222-2222-4222-8222-222222222222','90555555-5555-4555-8555-555555555555',1);
insert into public.user_task_progress(id,uid,assignment_id,status,note)
values ('90222222-2222-4222-8222-222222222222_90666666-6666-4666-8666-666666666666','90222222-2222-4222-8222-222222222222','90666666-6666-4666-8666-666666666666','DONE','Approved member progress');
insert into public.posts(author_id,author_name,title,content,category,status,subject_id,subject_name,target_scope)
values ('90222222-2222-4222-8222-222222222222','Access Guest','External official request','Details','official','published','90555555-5555-4555-8555-555555555555','Access Test Course','ALL');
do $$
declare blocked boolean := false;
begin
  if not exists(select 1 from public.assignments where assignment_id='90666666-6666-4666-8666-666666666666') then raise exception 'enrolled task not visible'; end if;
  if (select status from public.posts where title='External official request') <> 'pending' then raise exception 'external member bypassed moderation'; end if;
  begin
    update public.access_requests set status='approved' where uid='90222222-2222-4222-8222-222222222222';
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'direct request update allowed'; end if;
end;
$$;

-- A password login for an approved student still cannot access the application.
select set_config('request.jwt.claims','{"sub":"90222222-2222-4222-8222-222222222222","app_metadata":{"provider":"google"},"amr":[{"method":"password"}]}',true);
do $$ begin
  if private.has_app_access() then raise exception 'external student password session received app access'; end if;
end; $$;

select set_config('request.jwt.claim.sub','90333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"90333333-3333-4333-8333-333333333333","app_metadata":{"provider":"google"},"amr":[{"method":"oauth"}]}',true);
select public.request_app_access();
do $$ begin
  if private.has_app_access() or (select status from public.access_requests) <> 'rejected' then
    raise exception 'rejected account bypassed review or reset decision';
  end if;
end; $$;

set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform public.request_app_access(); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'anonymous request accepted'; end if;
end;
$$;
reset role;
rollback;
select 'Access request RLS smoke test passed; transaction rolled back.' as result;
