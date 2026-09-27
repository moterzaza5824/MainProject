import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const migrationNames = (await readdir("supabase/migrations"))
  .filter(name=>name.endsWith(".sql"))
  .sort();
const files = [...migrationNames.map(name=>`supabase/migrations/${name}`), "supabase/seed.sql"];
const contents = await Promise.all(files.map(file=>readFile(file,"utf8")));
const schema = contents[migrationNames.indexOf("001_initial_schema.sql")];
const auth = contents[migrationNames.indexOf("002_auth_profiles.sql")];
const policies = contents[migrationNames.indexOf("003_rls_policies.sql")];
const resourcesMigration = contents[migrationNames.indexOf("005_assignment_resources_jsonb.sql")];
const hardeningMigration = contents[migrationNames.indexOf("006_harden_backend_integrity.sql")];
const integrityMigration = contents[migrationNames.indexOf("007_close_integrity_gaps.sql")];
const cohortMigration = contents[migrationNames.indexOf("008_restrict_cohort_to_6802.sql")];
const adminPasswordMigration = contents[migrationNames.indexOf("009_require_password_for_admin.sql")];
const externalAdminMigration = contents[migrationNames.indexOf("010_allow_external_admin_emails.sql")];
const seed = contents.at(-1);

for (const [index,sql] of contents.entries()) {
  assert.ok(sql.trim().endsWith(";"), `${files[index]} must end with a semicolon`);
  assert.doesNotMatch(sql,/TODO:\s/i,`${files[index]} still contains a TODO placeholder`);
}
for (const table of ["users","subjects","enrollments","posts","assignments","user_task_progress"]) {
  assert.match(schema,new RegExp(`create table public\\.${table}\\b`,`i`),`missing ${table} table`);
  assert.match(policies,new RegExp(`alter table public\\.${table} enable row level security`,`i`),`RLS is not enabled for ${table}`);
}
assert.match(auth,/after insert on auth\.users/i,"missing auth.users profile trigger");
assert.match(cohortMigration,/\^6802\[0-9\]\{4\}@up\\\.ac\\\.th\$/i,"missing 6802 cohort email validation");
assert.match(cohortMigration,/as restrictive for all to authenticated/i,"missing restrictive cohort RLS gate");
assert.match(cohortMigration,/private\.is_cohort_member\(\)/i,"missing cohort membership function");
assert.match(adminPasswordMigration,/entry\s*->>\s*'method'\s*=\s*'password'/i,"admin gate must require a password AMR claim");
assert.match(adminPasswordMigration,/private\.is_password_session\(\)/i,"admin role must require a password-authenticated session");
assert.doesNotMatch(adminPasswordMigration,/actor\.role\s*<>\s*'admin'/i,"post moderation must not trust the stored role without the session method");
assert.match(externalAdminMigration,/initial_role\s*:=\s*'pending_admin'/i,"external password accounts must start without application access");
assert.match(externalAdminMigration,/private\.has_app_access\(\)/i,"RLS must support approved external administrators");
assert.match(externalAdminMigration,/private\.is_password_session\(\)/i,"external administrators must still require a password session");
assert.match(externalAdminMigration,/as restrictive for all to authenticated/i,"external admin access gate must remain restrictive");
assert.match(policies,/create policy posts_select_visible/i,"missing post visibility policy");
assert.match(policies,/create policy progress_select_own\b/i,"progress must remain private");
assert.match(resourcesMigration,/rename column resources_jsonb to resources/i,"assignment resources must migrate to jsonb");
assert.match(resourcesMigration,/private\.valid_attachments\(resources\)/i,"assignment resources must validate named links");
assert.match(hardeningMigration,/progress_insert_visible_assignment/i,"progress writes must require a visible assignment");
assert.match(hardeningMigration,/new\.created_by\s*=\s*\(select auth\.uid\(\)\)/i,"database must own audit identities");
assert.match(integrityMigration,/new\.full_name\s*=\s*old\.full_name/i,"students must not be able to forge profile names");
assert.match(integrityMigration,/maximum_day/i,"due dates must validate real calendar days");
assert.match(seed,/insert into public\.subjects/i,"missing reproducible subject seed");

console.log("Supabase contract checks passed (schema, auth trigger, RLS, seed).");
