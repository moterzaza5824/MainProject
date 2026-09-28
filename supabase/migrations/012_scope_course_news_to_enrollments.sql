-- A general post without a subject remains cohort-wide. Once a subject is
-- selected, both general and official posts are visible only to students in
-- the matching course/section. Admins and authors retain access.
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
    and subject_id is not null
    and exists (
      select 1 from public.enrollments e
      where e.uid = (select auth.uid())
        and e.subject_id = posts.subject_id
        and (posts.target_scope = 'ALL' or e.section = any(posts.target_sections))
    )
  )
);
