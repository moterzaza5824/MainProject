import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "supabase/migrations/001_initial_schema.sql",
  "supabase/migrations/002_auth_profiles.sql",
  "supabase/migrations/003_rls_policies.sql",
  "supabase/seed.sql"
];
const [schema, auth, policies, seed] = await Promise.all(files.map(file=>readFile(file,"utf8")));

for (const [index,sql] of [schema,auth,policies,seed].entries()) {
  assert.ok(sql.trim().endsWith(";"), `${files[index]} must end with a semicolon`);
  assert.doesNotMatch(sql,/TODO:\s/i,`${files[index]} still contains a TODO placeholder`);
}
for (const table of ["users","subjects","enrollments","posts","assignments","user_task_progress"]) {
  assert.match(schema,new RegExp(`create table public\\.${table}\\b`,`i`),`missing ${table} table`);
  assert.match(policies,new RegExp(`alter table public\\.${table} enable row level security`,`i`),`RLS is not enabled for ${table}`);
}
assert.match(auth,/after insert on auth\.users/i,"missing auth.users profile trigger");
assert.match(auth,/\^68\[0-9\]\{6\}@up\\\.ac\\\.th\$/i,"missing cohort email validation");
assert.match(policies,/create policy posts_select_visible/i,"missing post visibility policy");
assert.match(policies,/create policy progress_select_own\b/i,"progress must remain private");
assert.match(seed,/insert into public\.subjects/i,"missing reproducible subject seed");

console.log("Supabase contract checks passed (schema, auth trigger, RLS, seed).");
