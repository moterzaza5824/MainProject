-- Prevent profile-name impersonation and validate real calendar timestamps.

create or replace function private.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.uid = old.uid;
    new.email = old.email;
    new.student_id = old.student_id;
    if not private.is_admin() then
      new.full_name = old.full_name;
      new.role = old.role;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.valid_due_dates(mode text, value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  due_key text;
  due_value jsonb;
  key_count integer := 0;
  due_text text;
  parts text[];
  due_year integer;
  due_month integer;
  due_day integer;
  due_hour integer;
  due_minute integer;
  due_second integer;
  offset_hour integer;
  offset_minute integer;
  maximum_day integer;
begin
  if jsonb_typeof(value) <> 'object' or value = '{}'::jsonb then return false; end if;
  for due_key, due_value in select * from jsonb_each(value) loop
    if jsonb_typeof(due_value) <> 'string' then return false; end if;
    key_count := key_count + 1;
    due_text := due_value #>> '{}';
    parts := regexp_match(
      due_text,
      '^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.[0-9]{1,6})?)?(Z|([+-])([0-9]{2}):([0-9]{2}))$'
    );
    if parts is null then return false; end if;

    due_year := parts[1]::integer;
    due_month := parts[2]::integer;
    due_day := parts[3]::integer;
    due_hour := parts[4]::integer;
    due_minute := parts[5]::integer;
    due_second := coalesce(parts[7], '0')::integer;
    offset_hour := coalesce(parts[11], '0')::integer;
    offset_minute := coalesce(parts[12], '0')::integer;

    if due_year not between 1 and 9999
      or due_month not between 1 and 12
      or due_hour not between 0 and 23
      or due_minute not between 0 and 59
      or due_second not between 0 and 59
      or offset_hour not between 0 and 14
      or offset_minute not between 0 and 59
      or (offset_hour = 14 and offset_minute <> 0) then return false;
    end if;

    maximum_day := case due_month
      when 2 then case when due_year % 400 = 0 or (due_year % 4 = 0 and due_year % 100 <> 0) then 29 else 28 end
      when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
      else 31
    end;
    if due_day not between 1 and maximum_day then return false; end if;

    if (mode = 'UNIFIED' and due_key <> 'all')
      or (mode = 'SPLIT' and due_key !~ '^sec_[1-9][0-9]*$') then return false;
    end if;
  end loop;
  return (mode = 'UNIFIED' and value ? 'all' and key_count = 1)
    or (mode = 'SPLIT' and not (value ? 'all'));
exception when others then return false;
end;
$$;

alter table public.assignments
  drop constraint assignments_due_dates_check,
  add constraint assignments_due_dates_check check (private.valid_due_dates(schedule_mode, due_dates));

