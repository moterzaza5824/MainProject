-- Development-safe master data. Auth users are created through Supabase Auth,
-- so this seed deliberately does not fabricate rows in auth.users.
insert into public.subjects (subject_id, name, academic_year, semester, section_count)
values
  ('10000000-0000-4000-8000-000000000001', 'Database Systems', 2569, '1', 2),
  ('10000000-0000-4000-8000-000000000002', 'Object-Oriented Programming', 2569, '1', 2),
  ('10000000-0000-4000-8000-000000000003', 'Software Engineering', 2569, '1', 2),
  ('10000000-0000-4000-8000-000000000004', 'Web Development', 2569, '1', 2)
on conflict (subject_id) do update
set name = excluded.name,
    academic_year = excluded.academic_year,
    semester = excluded.semester,
    section_count = excluded.section_count;
