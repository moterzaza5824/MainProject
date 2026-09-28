-- General news is cohort-wide publicity. Course/section targeting belongs only
-- to official news. Preserve existing course-targeted posts by reclassifying
-- them as official before enforcing the new invariant.
update public.posts
set category = 'official', updated_at = now()
where category = 'general' and subject_id is not null;

alter table public.posts
add constraint posts_general_cohort_wide_check check (
  category <> 'general'
  or (
    subject_id is null
    and subject_name is null
    and target_scope = 'ALL'
    and cardinality(target_sections) = 0
  )
);

drop policy if exists posts_select_visible on public.posts;

create policy posts_select_visible on public.posts for select to authenticated
using (
  (select private.is_admin())
  or author_id = (select auth.uid())
  or (
    status = 'published'
    and category = 'general'
    and subject_id is null
  )
  or (
    status = 'published'
    and category = 'official'
    and exists (
      select 1 from public.enrollments e
      where e.uid = (select auth.uid())
        and e.subject_id = posts.subject_id
        and (posts.target_scope = 'ALL' or e.section = any(posts.target_sections))
    )
  )
);
