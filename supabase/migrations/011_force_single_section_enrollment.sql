-- Courses with a single section do not require a student-supplied choice.
-- Keeping this rule in the database protects every client, not only the web UI.
create or replace function private.sync_enrollment_subject()
returns trigger language plpgsql set search_path = '' as $$
declare selected_subject public.subjects%rowtype;
begin
  select * into selected_subject from public.subjects where subject_id = new.subject_id;
  if not found then raise exception 'subject not found'; end if;

  if selected_subject.section_count = 1 then
    new.section = 1;
  elsif new.section is null or new.section < 1 or new.section > selected_subject.section_count then
    raise exception 'section must be between 1 and %', selected_subject.section_count;
  end if;

  new.academic_year = selected_subject.academic_year;
  new.semester = selected_subject.semester;
  return new;
end;
$$;
