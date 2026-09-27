-- Store assignment resources in the same named-link format used by the UI.
-- Existing URL-only rows are preserved and receive deterministic display names.

alter table public.assignments
  add column resources_jsonb jsonb not null default '[]'::jsonb;

update public.assignments as assignment
set resources_jsonb = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'name', 'เอกสารประกอบ ' || resource.ordinality::text,
        'url', resource.url
      )
      order by resource.ordinality
    )
    from unnest(assignment.resources) with ordinality as resource(url, ordinality)
  ),
  '[]'::jsonb
);

alter table public.assignments
  drop constraint assignments_resources_check,
  drop column resources;

alter table public.assignments
  rename column resources_jsonb to resources;

alter table public.assignments
  add constraint assignments_resources_check
  check (private.valid_attachments(resources));

drop function private.valid_resources(text[]);
