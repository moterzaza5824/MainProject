-- SE68 Hub: core database schema
-- Apply with `supabase db reset --local` or `supabase db push --linked`.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create or replace function private.valid_attachments(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(value) <> 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(char_length(btrim(item ->> 'name')), 0) not between 1 and 100
      or coalesce(item ->> 'url', '') !~* '^https?://' then return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.valid_resources(value text[])
returns boolean language plpgsql immutable set search_path = '' as $$
declare resource text;
begin
  foreach resource in array value loop
    if resource is null or resource !~* '^https?://' then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.valid_due_dates(mode text, value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare due_key text; due_value jsonb; key_count integer := 0; due_text text;
begin
  if jsonb_typeof(value) <> 'object' or value = '{}'::jsonb then return false; end if;
  for due_key, due_value in select * from jsonb_each(value) loop
    if jsonb_typeof(due_value) <> 'string' then return false; end if;
    key_count := key_count + 1;
    due_text := due_value #>> '{}';
    if due_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$'
      or substring(due_text from 6 for 2)::integer not between 1 and 12
      or substring(due_text from 9 for 2)::integer not between 1 and 31
      or substring(due_text from 12 for 2)::integer not between 0 and 23
      or substring(due_text from 15 for 2)::integer not between 0 and 59 then return false;
    end if;
    if (mode = 'UNIFIED' and due_key <> 'all')
      or (mode = 'SPLIT' and due_key !~ '^sec_[1-9][0-9]*$') then return false;
    end if;
  end loop;
  return (mode = 'UNIFIED' and value ? 'all' and key_count = 1)
    or (mode = 'SPLIT' and not (value ? 'all'));
exception when others then return false;
end;
$$;

create table public.users (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  student_id text not null,
  full_name text not null,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_format check (email ~* '^68[0-9]{6}@up\.ac\.th$'),
  constraint users_student_id_format check (student_id ~ '^68[0-9]{6}$'),
  constraint users_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  constraint users_role_check check (role in ('student', 'admin'))
);

create unique index users_email_unique on public.users (lower(email));
create unique index users_student_id_unique on public.users (student_id);

create table public.subjects (
  subject_id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year integer not null,
  semester text not null,
  section_count integer not null default 1,
  created_by uuid references public.users(uid) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint subjects_academic_year_check check (academic_year between 2500 and 2700),
  constraint subjects_semester_check check (semester in ('1', '2')),
  constraint subjects_section_count_check check (section_count between 1 and 20)
);

create unique index subjects_identity_unique on public.subjects (lower(name), academic_year, semester);

create table public.enrollments (
  enrollment_id uuid primary key default gen_random_uuid(),
  uid uuid not null references public.users(uid) on delete cascade,
  subject_id uuid not null references public.subjects(subject_id) on delete restrict,
  academic_year integer not null,
  semester text not null,
  section integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_identity_unique unique (uid, subject_id),
  constraint enrollments_academic_year_check check (academic_year between 2500 and 2700),
  constraint enrollments_semester_check check (semester in ('1', '2')),
  constraint enrollments_section_check check (section between 1 and 20)
);

create index enrollments_subject_id_idx on public.enrollments (subject_id);

create table public.posts (
  post_id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(uid) on delete restrict,
  author_name text not null,
  title text not null,
  content text not null,
  category text not null,
  status text not null default 'published',
  is_pinned boolean not null default false,
  image_url text,
  subject_id uuid references public.subjects(subject_id) on delete restrict,
  subject_name text,
  target_scope text not null default 'ALL',
  target_sections integer[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  approved_by uuid references public.users(uid) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_author_name_length check (char_length(btrim(author_name)) between 1 and 120),
  constraint posts_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint posts_content_length check (char_length(btrim(content)) between 1 and 10000),
  constraint posts_category_check check (category in ('official', 'general')),
  constraint posts_status_check check (status in ('published', 'pending', 'rejected')),
  constraint posts_target_scope_check check (target_scope in ('ALL', 'SPECIFIC')),
  constraint posts_target_sections_check check (
    (target_scope = 'ALL' and cardinality(target_sections) = 0)
    or (target_scope = 'SPECIFIC' and cardinality(target_sections) > 0 and 0 < all(target_sections))
  ),
  constraint posts_subject_pair_check check ((subject_id is null) = (subject_name is null)),
  constraint posts_official_subject_check check (category <> 'official' or subject_id is not null),
  constraint posts_specific_subject_check check (target_scope <> 'SPECIFIC' or subject_id is not null),
  constraint posts_attachments_check check (private.valid_attachments(attachments)),
  constraint posts_image_url_check check (image_url is null or image_url ~* '^https?://')
);

create index posts_feed_idx on public.posts (status, category, is_pinned desc, updated_at desc);
create index posts_author_id_idx on public.posts (author_id, updated_at desc);
create index posts_subject_id_idx on public.posts (subject_id);
create index posts_target_sections_idx on public.posts using gin (target_sections);

create table public.assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(uid) on delete restrict,
  subject_id uuid not null references public.subjects(subject_id) on delete restrict,
  subject_name text not null,
  academic_year integer not null,
  semester text not null,
  title text not null,
  description text not null,
  submission_channel text not null,
  schedule_mode text not null,
  due_dates jsonb not null,
  resources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_subject_name_length check (char_length(btrim(subject_name)) between 1 and 120),
  constraint assignments_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint assignments_description_length check (char_length(btrim(description)) between 1 and 10000),
  constraint assignments_channel_length check (char_length(btrim(submission_channel)) between 1 and 120),
  constraint assignments_academic_year_check check (academic_year between 2500 and 2700),
  constraint assignments_semester_check check (semester in ('1', '2')),
  constraint assignments_schedule_mode_check check (schedule_mode in ('UNIFIED', 'SPLIT')),
  constraint assignments_due_dates_check check (private.valid_due_dates(schedule_mode, due_dates)),
  constraint assignments_resources_check check (private.valid_resources(resources))
);

create index assignments_subject_id_idx on public.assignments (subject_id, updated_at desc);

create table public.user_task_progress (
  id text primary key,
  uid uuid not null references public.users(uid) on delete cascade,
  assignment_id uuid not null references public.assignments(assignment_id) on delete cascade,
  status text not null default 'TODO',
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint user_task_progress_identity_unique unique (uid, assignment_id),
  constraint user_task_progress_id_check check (id = uid::text || '_' || assignment_id::text),
  constraint user_task_progress_status_check check (status in ('TODO', 'DONE')),
  constraint user_task_progress_note_length check (char_length(note) <= 2000)
);

create index user_task_progress_assignment_id_idx on public.user_task_progress (assignment_id);

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.sync_enrollment_subject()
returns trigger language plpgsql set search_path = '' as $$
declare selected_subject public.subjects%rowtype;
begin
  select * into selected_subject from public.subjects where subject_id = new.subject_id;
  if not found then raise exception 'subject not found'; end if;
  if new.section < 1 or new.section > selected_subject.section_count then
    raise exception 'section must be between 1 and %', selected_subject.section_count;
  end if;
  new.academic_year = selected_subject.academic_year;
  new.semester = selected_subject.semester;
  return new;
end;
$$;

create or replace function private.sync_post_subject()
returns trigger language plpgsql set search_path = '' as $$
declare selected_subject public.subjects%rowtype;
begin
  if new.subject_id is null then
    new.subject_name = null;
    return new;
  end if;
  select * into selected_subject from public.subjects where subject_id = new.subject_id;
  if not found then raise exception 'subject not found'; end if;
  if exists (select 1 from unnest(new.target_sections) section where section > selected_subject.section_count) then
    raise exception 'target section exceeds subject section count';
  end if;
  new.subject_name = selected_subject.name;
  return new;
end;
$$;

create or replace function private.sync_assignment_subject()
returns trigger language plpgsql set search_path = '' as $$
declare selected_subject public.subjects%rowtype; due_key text;
begin
  select * into selected_subject from public.subjects where subject_id = new.subject_id;
  if not found then raise exception 'subject not found'; end if;
  if new.schedule_mode = 'SPLIT' then
    for due_key in select jsonb_object_keys(new.due_dates) loop
      if substring(due_key from 5)::integer > selected_subject.section_count then
        raise exception 'due-date section exceeds subject section count';
      end if;
    end loop;
  end if;
  new.subject_name = selected_subject.name;
  new.academic_year = selected_subject.academic_year;
  new.semester = selected_subject.semester;
  return new;
end;
$$;

create or replace function private.sync_subject_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.section_count < old.section_count and (
    exists (select 1 from public.enrollments e where e.subject_id = new.subject_id and e.section > new.section_count)
    or exists (select 1 from public.posts p cross join lateral unnest(p.target_sections) section where p.subject_id = new.subject_id and section > new.section_count)
    or exists (select 1 from public.assignments a cross join lateral jsonb_object_keys(a.due_dates) due_key where a.subject_id = new.subject_id and due_key ~ '^sec_[1-9][0-9]*$' and substring(due_key from 5)::integer > new.section_count)
  ) then
    raise exception 'cannot reduce section count while higher sections are enrolled';
  end if;
  update public.enrollments set academic_year = new.academic_year, semester = new.semester, updated_at = now() where subject_id = new.subject_id;
  update public.assignments set subject_name = new.name, academic_year = new.academic_year, semester = new.semester, updated_at = now() where subject_id = new.subject_id;
  update public.posts set subject_name = new.name, updated_at = now() where subject_id = new.subject_id;
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users for each row execute function private.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects for each row execute function private.set_updated_at();
create trigger enrollments_set_updated_at before update on public.enrollments for each row execute function private.set_updated_at();
create trigger posts_set_updated_at before update on public.posts for each row execute function private.set_updated_at();
create trigger assignments_set_updated_at before update on public.assignments for each row execute function private.set_updated_at();
create trigger progress_set_updated_at before update on public.user_task_progress for each row execute function private.set_updated_at();
create trigger enrollments_sync_subject before insert or update on public.enrollments for each row execute function private.sync_enrollment_subject();
create trigger posts_sync_subject before insert or update of subject_id, subject_name, target_sections on public.posts for each row execute function private.sync_post_subject();
create trigger assignments_sync_subject before insert or update of subject_id, subject_name, academic_year, semester, schedule_mode, due_dates on public.assignments for each row execute function private.sync_assignment_subject();
create trigger subjects_sync_references after update of name, academic_year, semester, section_count on public.subjects for each row execute function private.sync_subject_references();

create view public.public_profiles as select uid, full_name from public.users;
