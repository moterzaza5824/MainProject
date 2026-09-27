-- Fix due-date validation discovered by remote database lint after the initial deploy.
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
