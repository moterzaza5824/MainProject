import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { DemoRepository } from "../src/services/demo-repository";
import { validateAssignment, validatePost } from "../src/services/validation";
import { createSeed } from "../src/services/seed";
import { markdown, safeUrl } from "../src/utils/html";
import { matchesSection, taskUrgency, fromThaiInput, thaiInput, formatDate, formatTime } from "../src/utils/tasks";
import { renderTasks, renderTaskDetail, calendarMarkup } from "../src/views/tasks";
import { renderPosts, renderPostDetail, postCard } from "../src/views/posts";
import { renderPostForm, renderAssignmentForm } from "../src/views/forms";
import { renderDashboard, renderProfile, renderAdminTasks } from "../src/views/overview";
import { renderAuth } from "../src/views/auth";
import { renderCatalog } from "../src/views/catalog";
import { renderEnrollment } from "../src/views/enrollment";
import { applyStudentVisibility, loadEnrollments, saveEnrollment } from "../src/services/enrollment";
import { pageDataRequirements } from "../src/services/page-data";
import { isEligibleCohortEmail, normalizeAdminLoginEmail, sessionAuthMethod } from "../src/services/auth-policy";
import { addSubject, deleteSubject, loadCatalog, updateSubject } from "../src/services/catalog";
import { mountShell } from "../src/ui/shell";
import type { Context } from "../src/ui/context";
import type { PostInput, AssignmentInput, ProgressRow } from "../src/types/models";

let win: Window, repo: DemoRepository;
beforeEach(() => {
  win = new Window({ url: "http://localhost:5173/pages/dashboard/" });
  for (const name of ["window","document","location","localStorage","HTMLElement","HTMLFormElement","HTMLInputElement","HTMLSelectElement","Event","FormData","CustomEvent","BeforeUnloadEvent"] as const) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === "window" ? win : win[name] });
  }
  Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: win.matchMedia.bind(win) });
  document.body.innerHTML = '<div id="app"></div>';
  repo = new DemoRepository();
});
afterEach(async () => { await win.happyDOM.abort(); });
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
async function context(role: "student" | "admin" = "student"): Promise<Context> {
  await repo.signIn(role);
  const user = (await repo.currentUser())!;
  const ctx: Context = { repo, user, root: document.querySelector("#app")!, data: await repo.snapshot(), async refresh(){ ctx.data = await repo.snapshot(); } };
  return ctx;
}
const postInput = (category: "general" | "official" = "general"): PostInput => ({
  title: "ข่าวทดสอบ", content: "รายละเอียด", category, is_pinned: false,
  image_url: null, subject_id: category==="official"?"seed-subject-1":null,
  subject_name: category==="official"?"Object-Oriented Programming":null,
  target_scope: "ALL", target_sections: [], attachments: []
});
const taskInput = (): AssignmentInput => ({
  title: "งานทดสอบ", subject_name: "OOP", description: "ทำตามโจทย์", submission_channel: "Teams",
  schedule_mode: "UNIFIED", due_dates: { all: new Date(Date.now()+3600000).toISOString() }, resources: []
});

test("page data loading avoids unrelated database work", () => {
  assert.deepEqual(pageDataRequirements("official", "student", "supabase"), {
    snapshot: false, catalog: true, enrollments: true, post: false, ownPosts: false
  });
  assert.deepEqual(pageDataRequirements("dashboard", "student", "supabase"), {
    snapshot: true, catalog: true, enrollments: true, post: false, ownPosts: false
  });
  assert.deepEqual(pageDataRequirements("adminPosts", "admin", "supabase"), {
    snapshot: false, catalog: false, enrollments: false, post: false, ownPosts: false
  });
  assert.equal(pageDataRequirements("adminCatalog", "admin", "supabase").snapshot, false);
  assert.equal(pageDataRequirements("adminCatalog", "admin", "demo").snapshot, true);
  assert.equal(pageDataRequirements("profile", "student", "supabase").ownPosts, true);
});

test("cohort access accepts only 6802 student accounts", () => {
  assert.equal(isEligibleCohortEmail("68020001@up.ac.th"), true);
  assert.equal(isEligibleCohortEmail("68029999@UP.AC.TH"), true);
  assert.equal(isEligibleCohortEmail("68010001@up.ac.th"), false);
  assert.equal(isEligibleCohortEmail("68999999@up.ac.th"), false);
  assert.equal(isEligibleCohortEmail("68020001@gmail.com"), false);
  assert.equal(isEligibleCohortEmail("6802001@up.ac.th"), false);
  assert.equal(normalizeAdminLoginEmail("68020001"), "68020001@up.ac.th");
  assert.equal(normalizeAdminLoginEmail(" Admin@example.com "), "admin@example.com");
  assert.equal(normalizeAdminLoginEmail("admin"), null);
  const token = (amr: string) => `header.${btoa(JSON.stringify({ amr: [{ method: amr }] }))}.signature`;
  assert.equal(sessionAuthMethod(token("password")), "password");
  assert.equal(sessionAuthMethod(token("oauth")), "oauth");
  assert.equal(sessionAuthMethod("invalid"), "other");
});

test("role guards reject unauthorized mutations and progress remains private", async () => {
  const student = await context();
  await assert.rejects(repo.saveAssignment(taskInput()));
  await assert.rejects(repo.reviewPost("pending-workshop","approve"));
  await repo.saveProgress("oop-lab4","DONE","บันทึกของนิสิต");
  await repo.signIn("admin");
  assert.equal((await repo.snapshot()).progress.some(p=>p.uid===student.user.uid), false);
  await repo.saveProgress("oop-lab4","TODO","ผู้ดูแล");
  await repo.signIn("student");
  const rows=(await repo.snapshot()).progress.filter(p=>p.assignment_id==="oop-lab4");
  assert.equal(rows.length,1); assert.equal(rows[0].status,"DONE");
  await repo.saveProgress("oop-lab4","TODO","ใหม่");
  assert.equal((await repo.snapshot()).progress.filter(p=>p.assignment_id==="oop-lab4").length,1);
});

test("legacy progress and assignment resource URLs migrate to current formats", async () => {
  const legacy=createSeed(),row=legacy.progress[0] as unknown as {status:string};
  row.status="DOING";
  (legacy.assignments[0] as unknown as {resources:string[]}).resources=["https://example.com/legacy-brief.pdf"];
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(legacy));
  await repo.signIn("student");
  const snapshot=await repo.snapshot();
  assert.equal(snapshot.progress.find(progress=>progress.assignment_id===row.assignment_id)?.status,"TODO");
  assert.deepEqual(snapshot.assignments[0].resources,[{name:"เอกสารประกอบ 1",url:"https://example.com/legacy-brief.pdf"}]);
  assert.equal(JSON.parse(localStorage.getItem("se68-demo-data-v1")!).progress[0].status,"TODO");
});

test("password login is admin-only and Google is presented as student login", async () => {
  await assert.rejects(repo.signInWithPassword("68020001","wrong"),/Username หรือ Password/);
  await assert.rejects(repo.signInWithPassword("68020001@up.ac.th","se68student"),/Username หรือ Password/);
  await repo.signInWithPassword("admin","se68admin");
  assert.equal((await repo.currentUser())?.role,"admin");
  await repo.signOut();
  await assert.rejects(repo.signInWithGoogle(),/Supabase/);
  renderAuth(document.querySelector("#app")!,repo);
  assert.ok(document.querySelector("main.auth-content"));
  assert.ok(document.querySelector("#login-form"));
  assert.ok(document.querySelector("#google-login"));
  assert.match(document.body.textContent!,/Google Login ให้สิทธิ์นิสิตเท่านั้น/);
  const password=document.querySelector<HTMLInputElement>('[name="password"]')!,toggle=document.querySelector<HTMLButtonElement>(".password-toggle")!;
  password.value="รหัสทดสอบ";toggle.click();
  assert.equal(password.type,"text");assert.equal(password.value,"รหัสทดสอบ");assert.equal(toggle.getAttribute("aria-pressed"),"true");assert.match(toggle.textContent!,/ซ่อน/);
  toggle.click();assert.equal(password.type,"password");assert.equal(toggle.getAttribute("aria-pressed"),"false");
});

test("official approval, stale review, and student re-edit obey moderation lifecycle", async () => {
  await context();
  const post=await repo.savePost(postInput("official"));
  assert.equal(post.status,"pending");
  await repo.signIn("admin");
  await repo.savePost({...post,title:"ผู้ดูแลแก้คำผิด"},post.post_id,post.updated_at);
  assert.equal((await repo.getPost(post.post_id))!.status,"pending");
  await repo.reviewPost(post.post_id,"approve");
  await assert.rejects(repo.reviewPost(post.post_id,"reject"));
  const approved=(await repo.getPost(post.post_id))!;
  assert.equal(approved.status,"published");
  await repo.signIn("student");
  await assert.rejects(repo.savePost({...post,title:"ข้อมูลเก่า"},post.post_id,"2000-01-01T00:00:00.000Z"),/โหลดข้อมูลล่าสุด/);
  const changed=await repo.savePost({...post,title:"เพิ่มรายละเอียด"},post.post_id,approved.updated_at);
  assert.equal(changed.status,"pending"); assert.equal(changed.approved_by,null);
});

test("General author edits preserve admin pin and reviewer; other pending posts stay private", async () => {
  await context();
  const p=await repo.savePost(postInput("official"));
  await repo.signIn("admin"); await repo.reviewPost(p.post_id,"general"); await repo.pinPost(p.post_id,true);
  const moderated=(await repo.getPost(p.post_id))!;
  assert.equal(moderated.subject_id,null);assert.equal(moderated.subject_name,null);assert.equal(moderated.target_scope,"ALL");assert.deepEqual(moderated.target_sections,[]);
  await repo.signIn("student");
  const edited=await repo.savePost({...moderated,title:"แก้คำผิด",is_pinned:false},p.post_id,moderated.updated_at);
  assert.equal(edited.is_pinned,true); assert.equal(edited.approved_by,moderated.approved_by);
  const raw=JSON.parse(localStorage.getItem("se68-demo-data-v1")!);
  raw.posts.push({...p,post_id:"someone-pending",author_id:"another-student"});
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(raw));
  assert.equal(await repo.getPost("someone-pending"),null);
});

test("reject and downgrade are separate outcomes; deleting a task cascades its progress", async () => {
  await context("admin");
  await repo.reviewPost("pending-workshop","reject");
  assert.equal((await repo.getPost("pending-workshop"))!.status,"rejected");
  const a=await repo.saveAssignment(taskInput());
  await repo.saveProgress(a.assignment_id,"TODO","draft");
  await repo.deleteAssignment(a.assignment_id);
  assert.equal((await repo.snapshot()).progress.some(p=>p.assignment_id===a.assignment_id),false);
  await assert.rejects(repo.saveProgress(a.assignment_id,"DONE",""));
});

test("assignment edits reject a stale version instead of overwriting newer data", async () => {
  await context("admin");
  const assignment=await repo.saveAssignment(taskInput());
  await assert.rejects(repo.saveAssignment({...assignment,title:"ข้อมูลเก่า"},assignment.assignment_id,"2000-01-01T00:00:00.000Z"),/โหลดข้อมูลล่าสุด/);
  const updated=await repo.saveAssignment({...assignment,title:"ข้อมูลใหม่"},assignment.assignment_id,assignment.updated_at);
  assert.equal(updated.title,"ข้อมูลใหม่");
});

test("section and 48-hour urgency logic handles ALL, optional split section, and DONE", () => {
  const seed=createSeed(), base=seed.assignments[0], now=Date.now();
  const task={...base,schedule_mode:"SPLIT" as const,due_dates:{sec_1:new Date(now+24*3600000).toISOString(),sec_2:new Date(now+7*86400000).toISOString()}};
  assert.equal(matchesSection({...task,due_dates:{sec_1:task.due_dates.sec_1}},"2"),false);
  assert.equal(matchesSection({...task,schedule_mode:"UNIFIED",due_dates:{all:task.due_dates.sec_1}},"2"),true);
  assert.equal(taskUrgency(task,undefined,"1",now),"urgent");
  assert.equal(taskUrgency(task,undefined,"2",now),"");
  assert.equal(taskUrgency(task,{status:"DONE"} as ProgressRow,"ALL",now),"");
  assert.equal(taskUrgency({...task,due_dates:{sec_1:new Date(now+48*3600000).toISOString()}},undefined,"1",now),"soon");
});

test("input validation and safe formatting reject dangerous links and invalid schedules", () => {
  assert.throws(()=>validatePost({...postInput(),attachments:[{name:"X",url:"javascript:alert(1)"}]}));
  assert.throws(()=>validatePost({...postInput(),image_url:"javascript:alert(1)"}));
  assert.throws(()=>validatePost({...postInput("official"),subject_id:null,subject_name:null}),/ประกาศทางการ/);
  assert.throws(()=>validatePost({...postInput(),subject_id:"seed-subject-1",subject_name:"Object-Oriented Programming"}),/ข่าวทั่วไป/);
  assert.throws(()=>validateAssignment({...taskInput(),schedule_mode:"SPLIT",due_dates:{}}));
  assert.throws(()=>validateAssignment({...taskInput(),due_dates:{sec_1:"2026-09-20"}}));
  assert.throws(()=>validateAssignment({...taskInput(),resources:[{name:"",url:"https://example.com/brief.pdf"}]}),/ต้องมีชื่อ/);
  assert.throws(()=>validateAssignment({...taskInput(),resources:[{name:"โจทย์งาน",url:"javascript:alert(1)"}]}),/http หรือ https/);
  validateAssignment({...taskInput(),schedule_mode:"SPLIT",due_dates:{sec_2:"2026-09-20T12:00:00Z"}});
  assert.equal(safeUrl("data:text/html,bad"),null);
  document.querySelector("#app")!.innerHTML=markdown('## หัวข้อ\n<img src=x onerror="alert(1)">\n**หนา**');
  assert.equal(document.querySelector("img"),null); assert.ok(document.querySelector("strong"));
  assert.equal(thaiInput(fromThaiInput("2026-09-20T00:30")),"2026-09-20T00:30");
  assert.equal(fromThaiInput("2026-09-20T00:30"),"2026-09-19T17:30:00.000Z");
});

test("post board fetches paginated repository rows rather than dashboard subset", async () => {
  const ctx=await context(), raw=JSON.parse(localStorage.getItem("se68-demo-data-v1")!);
  raw.posts=Array.from({length:23},(_,i)=>({...raw.posts.find((p:any)=>p.category==="general"),post_id:"page-"+String(i).padStart(2,"0"),title:"ข่าว "+i}));
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(raw));
  ctx.data.posts=[];
  renderPosts(ctx,"general"); await flush();
  assert.equal(ctx.root.querySelectorAll(".post-card").length,10);
  assert.match(ctx.root.textContent!,/23 รายการ/);
  ctx.root.querySelector<HTMLButtonElement>('[data-page="1"]')!.click(); await flush();
  assert.equal(ctx.root.querySelectorAll(".post-card").length,10);
  ctx.root.querySelector<HTMLButtonElement>('[data-page="1"]')!.click(); await flush();
  assert.equal(ctx.root.querySelectorAll(".post-card").length,3);
});

test("published news boards are separated from the student's pending request page", async () => {
  const ctx=await context("student"),catalog=loadCatalog(ctx.data.assignments);
  const oop=catalog.subjects.find(row=>row.id==="seed-subject-1")!,softwareEngineering=catalog.subjects.find(row=>row.id==="seed-subject-2")!;
  saveEnrollment(ctx.user.uid,oop,1);saveEnrollment(ctx.user.uid,softwareEngineering,1);
  ctx.catalog=catalog;ctx.enrollments=loadEnrollments(ctx.user.uid);
  let queries=0,lastSubject:string|undefined;const list=repo.listPosts.bind(repo);
  repo.listPosts=async query=>{queries++;lastSubject=query.subjectId;return list(query);};
  renderPosts(ctx,"official");await flush();
  assert.match(ctx.root.querySelector("h1")!.textContent!,/ข่าวสาร/);
  assert.equal(ctx.root.querySelector('[data-category="official"]')?.classList.contains("active"),true);
  assert.equal(queries,0);assert.equal(ctx.root.querySelectorAll(".post-card").length,0);
  assert.match(ctx.root.textContent!,/เลือกรายวิชาเพื่อดูประกาศทางการ/);
  const subject=ctx.root.querySelector<HTMLSelectElement>("#official-subject")!;
  assert.equal(subject.options[0].textContent,"เลือกรายวิชา");
  assert.equal([...subject.options].some(option=>/ทุกวิชา/.test(option.textContent??"")),false);
  subject.value=oop.id;subject.dispatchEvent(new Event("change",{bubbles:true}));await flush();
  assert.equal(lastSubject,oop.id);assert.match(ctx.root.textContent!,/แจ้งเปลี่ยนห้องเรียนปฏิบัติการ OOP/);
  assert.doesNotMatch(ctx.root.textContent!,/เตรียมตัวสอบกลางภาค/);
  ctx.root.querySelector<HTMLButtonElement>('[data-category="general"]')!.click();await flush();
  assert.equal(ctx.root.querySelector('[data-category="general"]')?.classList.contains("active"),true);
  assert.equal(ctx.root.querySelector<HTMLElement>("#official-subject-panel")!.hidden,true);
  assert.equal(ctx.root.querySelector("#post-owner"),null);
  assert.equal(ctx.root.querySelector(".section-filter"),null);
  assert.doesNotMatch(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.equal(ctx.root.querySelectorAll(".badge.pending").length,0);
  assert.equal(ctx.root.querySelector('[data-category="all"]'),null);
  assert.match(ctx.root.textContent!,/ชวนทบทวนก่อนสอบ/);
  assert.doesNotMatch(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.equal(ctx.root.querySelector(".badge.official"),null);assert.ok(ctx.root.querySelector(".badge.general"));
  renderPosts(ctx,"requests");await flush();
  assert.match(ctx.root.textContent!,/คำขอประกาศของฉัน/);
  assert.match(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.ok(ctx.root.querySelector(".badge.pending"));
  assert.doesNotMatch(ctx.root.textContent!,/แบ่งปันสรุปบทเรียน/);
});

test("admin announcement rows expose a clearly labeled delete action", async () => {
  const ctx=await context("admin");
  renderPosts(ctx,"admin");await flush();
  const rows=[...ctx.root.querySelectorAll<HTMLTableRowElement>("tbody tr")];
  assert.ok(rows.length>0);
  for(const row of rows){
    const button=row.querySelector<HTMLButtonElement>("[data-delete]");
    assert.ok(button);
    assert.match(button.textContent!,/ลบ/);
    assert.equal(button.title,"ลบประกาศ");
  }
});

test("post cards lead with the author, keep context at the top, and place images after the copy", () => {
  const post={...createSeed().posts.find(p=>p.post_id==="official-lab")!,created_at:"2026-09-21T04:35:00.000Z"};
  document.querySelector("#app")!.innerHTML=postCard({...post,image_url:"https://example.com/announcement.jpg"});
  const card=document.querySelector<HTMLElement>(".post-card")!,children=[...card.children];
  const author=card.querySelector(".post-card-head .author")!,title=card.querySelector("h2")!,copy=card.querySelector(".post-card-copy")!,image=card.querySelector(".post-card-image")!;
  assert.ok(author.textContent!.includes(post.author_name));
  const timestamp=author.querySelectorAll("small");
  assert.equal(timestamp[0].textContent,formatDate(post.created_at,false));
  assert.equal(timestamp[1].textContent,`เวลา ${formatTime(post.created_at)} น.`);
  assert.match(timestamp[1].textContent!,/เวลา 11:35 น\./);
  assert.ok(children.indexOf(author.closest(".post-card-head")!)<children.indexOf(title));
  assert.ok(children.indexOf(copy)<children.indexOf(image.closest(".post-image-button")!));
  assert.equal(image.closest("button")?.getAttribute("aria-label"),`เปิดดูภาพเต็มของ ${post.title}`);
  const flags=document.querySelector(".post-card-flags")!;
  assert.match(flags.textContent!,/Object-Oriented Programming/);
  assert.match(flags.textContent!,/Sec 1/);
  assert.ok(document.querySelector(".post-card-image"));
  document.querySelector("#app")!.innerHTML=postCard(createSeed().posts.find(p=>p.is_pinned)!);
  assert.ok(document.querySelector(".post-card-flags .badge.pin"));
  assert.match(document.querySelector(".post-card-flags")!.textContent!,/ทุก Sec/);
});

test("post cards expose safe attachment links without opening post details", () => {
  const post=createSeed().posts.find(row=>row.post_id==="general-study")!;
  document.querySelector("#app")!.innerHTML=postCard(post);
  const card=document.querySelector<HTMLElement>(".post-card")!;
  const attachment=card.querySelector<HTMLAnchorElement>(".post-card-attachments .resource-link")!;
  assert.ok(attachment);
  assert.match(attachment.textContent!,/เอกสาร PostgreSQL/);
  assert.equal(attachment.href,"https://www.postgresql.org/docs/current/tutorial.html");
  assert.equal(attachment.target,"_blank");assert.match(attachment.rel,/noopener/);
  const children=[...card.children];
  assert.ok(children.indexOf(card.querySelector(".post-card-attachments")!)<children.indexOf(card.querySelector(".post-card-footer")!));
});

test("long post copy expands and feed images open with post details", async () => {
  const ctx=await context(),raw=JSON.parse(localStorage.getItem("se68-demo-data-v1")!),longContent="รายละเอียดข่าวสารที่ควรอ่านให้ครบก่อนเข้าร่วมกิจกรรม ".repeat(12);
  raw.posts=raw.posts.map((post:any)=>post.category==="general"?{...post,content:longContent,image_url:"https://example.com/tall-poster.jpg"}:post);
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(raw));
  renderPosts(ctx,"general");await flush();
  const summary=ctx.root.querySelector<HTMLElement>("[data-post-summary]")!,full=ctx.root.querySelector<HTMLElement>("[data-post-full]")!,toggle=ctx.root.querySelector<HTMLButtonElement>("[data-expand-post]")!;
  assert.ok(summary.textContent!.length<longContent.length);assert.equal(full.hidden,true);assert.equal(toggle.textContent,"ดูเพิ่มเติม");
  toggle.click();assert.equal(summary.hidden,true);assert.equal(full.hidden,false);assert.equal(toggle.getAttribute("aria-expanded"),"true");assert.equal(toggle.textContent,"ย่อ");
  toggle.click();assert.equal(summary.hidden,false);assert.equal(full.hidden,true);assert.equal(toggle.getAttribute("aria-expanded"),"false");
  ctx.root.querySelector<HTMLButtonElement>("[data-image-post]")!.click();
  const viewer=document.querySelector<HTMLDialogElement>("dialog.image-viewer")!;
  assert.ok(viewer);assert.equal(viewer.open,true);
  assert.ok(viewer.querySelector(".image-viewer-layout"));assert.ok(viewer.querySelector(".image-viewer-stage"));assert.match(viewer.querySelector(".image-viewer-info")!.textContent!,/รายละเอียดข่าวสารที่ควรอ่านให้ครบ/);
  assert.equal(viewer.querySelector<HTMLImageElement>(".image-viewer-image")!.src,"https://example.com/tall-poster.jpg");
  viewer.close();
});

test("post previews use two-line summaries and route posts over ten lines to detail", async () => {
  const ctx=await context(),raw=JSON.parse(localStorage.getItem("se68-demo-data-v1")!),longLines=Array.from({length:11},(_,index)=>`บรรทัดที่ ${index+1} สำหรับทดสอบประกาศ`).join("\n");
  const general=raw.posts.find((post:any)=>post.category==="general");
  raw.posts=raw.posts.map((post:any)=>post.post_id===general.post_id?{...post,content:longLines}:post);
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(raw));
  renderPosts(ctx,"general");await flush();
  const summary=ctx.root.querySelector<HTMLElement>("[data-post-summary]")!,toggle=ctx.root.querySelector<HTMLButtonElement>("[data-expand-post]")!;
  assert.equal(summary.textContent,longLines);assert.equal(toggle.dataset.expandPost,"detail");assert.equal(toggle.textContent,"ดูเพิ่มเติม");
  toggle.click();
  assert.equal(win.location.pathname,"/pages/posts/detail/");assert.equal(new URLSearchParams(win.location.search).get("id"),general.post_id);
});

test("announcement form keeps general targeting optional and requires course-aware targeting for official news", async () => {
  const ctx=await context("student");
  renderPostForm(ctx);
  let form=ctx.root.querySelector<HTMLFormElement>("#post-form")!;
  const generalSubject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const generalAudience=form.elements.namedItem("audience") as HTMLSelectElement;
  assert.equal(generalSubject.required,false);assert.equal(generalSubject.disabled,true);
  assert.equal(generalAudience.disabled,true);
  assert.equal(ctx.root.querySelector<HTMLElement>("#course-targeting-fields")!.hidden,true);
  (form.elements.namedItem("title") as HTMLInputElement).value="ข่าวทั่วไปทั้งรุ่น";
  (form.elements.namedItem("content") as HTMLTextAreaElement).value="รายละเอียดสำหรับเพื่อนร่วมรุ่น";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  await flush();
  const general=(await repo.snapshot()).posts.find(p=>p.title==="ข่าวทั่วไปทั้งรุ่น")!;
  assert.equal(general.subject_id,null);assert.equal(general.target_scope,"ALL");
  const stored=JSON.parse(localStorage.getItem("se68-demo-data-v1")!);
  stored.posts=stored.posts.map((row:any)=>({...row,created_at:"2026-01-01T00:00:00.000Z"}));
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(stored));

  win.location.href="http://localhost:5173/pages/posts/create/";renderPostForm(ctx);
  form=ctx.root.querySelector<HTMLFormElement>("#post-form")!;
  const category=form.elements.namedItem("category") as HTMLSelectElement;
  const subject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const audience=form.elements.namedItem("audience") as HTMLSelectElement;
  category.value="official";category.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(subject.required,true);assert.equal(subject.disabled,false);assert.equal(ctx.root.querySelector<HTMLElement>("#course-targeting-fields")!.hidden,false);
  assert.doesNotMatch(subject.options[0].textContent!,/ทั้งรุ่น/);
  subject.value=subject.options[1].value;subject.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(audience.disabled,false);assert.equal(audience.required,true);
  assert.match(audience.textContent!,/ทุก Sec/);assert.match(audience.textContent!,/Sec 1/);
  audience.value="SEC:1";
  (form.elements.namedItem("title") as HTMLInputElement).value="ข่าวทางการเฉพาะ Sec";
  (form.elements.namedItem("content") as HTMLTextAreaElement).value="รายละเอียดที่ต้องรออนุมัติ";
  (form.elements.namedItem("image_url") as HTMLInputElement).value="https://example.com/news.jpg";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));await flush();
  const official=(await repo.snapshot()).posts.find(p=>p.title==="ข่าวทางการเฉพาะ Sec")!;
  assert.equal(official.status,"pending");assert.ok(official.subject_name);
  assert.equal(official.target_scope,"SPECIFIC");assert.deepEqual(official.target_sections,[1]);
  assert.equal(official.image_url,"https://example.com/news.jpg");
});

test("announcement form locks a one-section subject to Sec 1 and saves that audience", async () => {
  const ctx=await context("admin");
  addSubject(ctx.data.assignments,{name:"วิชาที่มีหนึ่งกลุ่มเรียน",academicYear:2569,semester:"1",sectionCount:1});
  const oneSection=loadCatalog(ctx.data.assignments).subjects.find(row=>row.name==="วิชาที่มีหนึ่งกลุ่มเรียน")!;
  renderPostForm(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#post-form")!;
  const category=form.elements.namedItem("category") as HTMLSelectElement;
  const subject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const audience=form.elements.namedItem("audience") as HTMLSelectElement;
  category.value="official";category.dispatchEvent(new Event("change",{bubbles:true}));
  subject.value=oneSection.id;subject.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(audience.value,"SEC:1");assert.equal(audience.disabled,true);assert.equal(audience.required,false);
  assert.match(audience.textContent!,/Sec 1 \(กำหนดอัตโนมัติ\)/);
  assert.match(ctx.root.querySelector("#targeting-note")!.textContent!,/กำหนดผู้รับเป็น Sec 1 อัตโนมัติ/);
  (form.elements.namedItem("title") as HTMLInputElement).value="ประกาศสำหรับวิชา Sec เดียว";
  (form.elements.namedItem("content") as HTMLTextAreaElement).value="รายละเอียดประกาศ";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));await flush();
  const saved=(await repo.snapshot()).posts.find(row=>row.title==="ประกาศสำหรับวิชา Sec เดียว")!;
  assert.equal(saved.subject_id,oneSection.id);
  assert.equal(saved.target_scope,"SPECIFIC");assert.deepEqual(saved.target_sections,[1]);
});

test("admin can pin cohort-wide general news without course targeting", async () => {
  const ctx=await context("admin");
  renderPostForm(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#post-form")!,subject=form.elements.namedItem("subject_id") as HTMLSelectElement,audience=form.elements.namedItem("audience") as HTMLSelectElement;
  assert.equal(ctx.root.querySelector<HTMLElement>("#course-targeting-fields")!.hidden,true);assert.equal(subject.disabled,true);assert.equal(audience.disabled,true);
  assert.match(ctx.root.querySelector("#targeting-note")!.textContent!,/หน้าภาพรวมของทุกคน/);
  (form.elements.namedItem("pinned") as HTMLInputElement).checked=true;
  (form.elements.namedItem("title") as HTMLInputElement).value="ข่าวประชาสัมพันธ์ปักหมุดทั้งรุ่น";
  (form.elements.namedItem("content") as HTMLTextAreaElement).value="รายละเอียดสำหรับนิสิตทุกคน";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));await flush();
  const saved=(await repo.snapshot()).posts.find(row=>row.title==="ข่าวประชาสัมพันธ์ปักหมุดทั้งรุ่น")!;
  assert.equal(saved.category,"general");assert.equal(saved.subject_id,null);assert.equal(saved.subject_name,null);assert.equal(saved.target_scope,"ALL");assert.deepEqual(saved.target_sections,[]);assert.equal(saved.is_pinned,true);
  await repo.signIn("student");
  assert.equal((await repo.listPosts({category:"general",status:"published",enrollments:[]})).rows.some(row=>row.post_id===saved.post_id),true);
});

test("failed post query shows an actionable retry", async () => {
  const ctx=await context(),catalog=loadCatalog(ctx.data.assignments),oop=catalog.subjects.find(row=>row.id==="seed-subject-1")!, list=repo.listPosts.bind(repo); let fail=true;
  saveEnrollment(ctx.user.uid,oop,1);ctx.catalog=catalog;ctx.enrollments=loadEnrollments(ctx.user.uid);
  repo.listPosts=async q=>{if(fail)throw new Error("offline");return list(q);};
  renderPosts(ctx,"official"); await flush();
  const subject=ctx.root.querySelector<HTMLSelectElement>("#official-subject")!;subject.value=oop.id;subject.dispatchEvent(new Event("change",{bubbles:true}));await flush();
  assert.ok(ctx.root.querySelector("[data-retry]"));
  fail=false; ctx.root.querySelector<HTMLButtonElement>("[data-retry]")!.click(); await flush();
  assert.ok(ctx.root.querySelector(".post-card"));
});

test("list status select saves and detail refresh removes stale urgency", async () => {
  const ctx=await context();
  renderTasks(ctx);
  const select=ctx.root.querySelector<HTMLSelectElement>('[data-task-status="oop-lab4"]')!;
  assert.deepEqual([...select.options].map(option=>option.value),["TODO","DONE"]);
  assert.deepEqual([...select.options].map(option=>option.textContent),["○ ยังไม่เสร็จ","✓ เสร็จแล้ว"]);
  assert.equal(ctx.root.querySelector<HTMLSelectElement>("#status-filter")!.textContent!.includes("กำลังทำ"),false);
  select.value="DONE";select.dispatchEvent(new Event("change",{bubbles:true}));await flush();
  assert.equal((await repo.snapshot()).progress.find(p=>p.assignment_id==="oop-lab4")!.status,"DONE");
  await repo.saveProgress("oop-lab4","TODO","");await ctx.refresh();
  win.location.href="http://localhost:5173/pages/assignments/detail/?id=oop-lab4";
  renderTaskDetail(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#progress-form")!;
  assert.deepEqual([...(form.elements.namedItem("status") as HTMLSelectElement).options].map(option=>option.value),["TODO","DONE"]);
  (form.elements.namedItem("status") as HTMLSelectElement).value="DONE";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  assert.equal((form.elements.namedItem("note") as HTMLTextAreaElement).disabled,true);
  await flush();
  assert.equal((form.elements.namedItem("note") as HTMLTextAreaElement).disabled,false);
  assert.equal(ctx.root.querySelector("#detail-urgency")!.textContent,"");
  assert.match(ctx.root.querySelector("#save-state")!.textContent!,/บันทึกแล้ว/);
});

test("calendar uses per-section deadlines and month navigation works", async () => {
  const ctx=await context(), base=ctx.data.assignments[0], now=Date.parse("2026-09-15T03:00:00Z");
  const task={...base,schedule_mode:"SPLIT" as const,due_dates:{sec_1:new Date(now+3600000).toISOString(),sec_2:new Date(now+7*86400000).toISOString()}};
  const realNow=Date.now;
  try {
    Date.now=()=>now;
    ctx.root.innerHTML=calendarMarkup([task],ctx,new Date(2026,8,1),"ALL");
    const sec1=[...ctx.root.querySelectorAll(".calendar-event")].find(el=>el.textContent?.includes("Sec 1"));
    const sec2=[...ctx.root.querySelectorAll(".calendar-event")].find(el=>el.textContent?.includes("Sec 2"));
    assert.ok(sec1);assert.ok(sec2);
    assert.equal(sec1.classList.contains("urgent"),true);
    assert.equal(sec2.classList.contains("urgent"),false);
  } finally { Date.now=realNow; }
  renderTasks(ctx,true);
  const title=ctx.root.querySelector(".calendar-heading h2")!.textContent;
  ctx.root.querySelector<HTMLButtonElement>('[data-month="1"]')!.click();
  assert.notEqual(ctx.root.querySelector(".calendar-heading h2")!.textContent,title);
});

test("assignment editor toggles and disables hidden schedule inputs", async () => {
  const ctx=await context("admin");renderAssignmentForm(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("form")!;
  assert.equal(ctx.root.querySelector<HTMLElement>("#split-fields")!.hidden,true);
  assert.equal((form.elements.namedItem("sec_1") as HTMLInputElement).disabled,true);
  const mode=form.elements.namedItem("mode") as HTMLSelectElement;
  mode.value="SPLIT";mode.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(ctx.root.querySelector<HTMLElement>("#unified-fields")!.hidden,true);
  assert.equal((form.elements.namedItem("all") as HTMLInputElement).disabled,true);
});

test("assignment editor publishes one-section subjects to the whole course without section splitting", async () => {
  const ctx=await context("admin");
  addSubject(ctx.data.assignments,{name:"วิชางานกลุ่มเดียว",academicYear:2569,semester:"1",sectionCount:1});
  const oneSection=loadCatalog(ctx.data.assignments).subjects.find(row=>row.name==="วิชางานกลุ่มเดียว")!;
  renderAssignmentForm(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#assignment-form")!;
  const subject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const mode=form.elements.namedItem("mode") as HTMLSelectElement;
  subject.value=oneSection.id;subject.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(mode.value,"UNIFIED");assert.equal(mode.disabled,true);
  assert.equal(ctx.root.querySelector<HTMLElement>("#unified-fields")!.hidden,false);
  assert.equal(ctx.root.querySelector<HTMLElement>("#split-fields")!.hidden,true);
  assert.match(ctx.root.querySelector("#schedule-note")!.textContent!,/เผยแพร่งานให้ทั้งวิชา/);
  (form.elements.namedItem("submission_channel") as HTMLInputElement).value="Microsoft Teams ห้องวิชา";
  (form.elements.namedItem("title") as HTMLInputElement).value="งานสำหรับทั้งวิชา";
  (form.elements.namedItem("description") as HTMLTextAreaElement).value="รายละเอียดงาน";
  (form.elements.namedItem("all") as HTMLInputElement).value="2026-10-01T10:00";
  ctx.root.querySelector<HTMLButtonElement>("#add-assignment-resource")!.click();
  (ctx.root.querySelector("[data-resource-name]") as HTMLInputElement).value="โจทย์ Sprint Review";
  (ctx.root.querySelector("[data-resource-url]") as HTMLInputElement).value="https://example.com/sprint-review";
  form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));await flush();
  const saved=(await repo.snapshot()).assignments.find(row=>row.title==="งานสำหรับทั้งวิชา")!;
  assert.equal(saved.subject_id,oneSection.id);assert.equal(saved.schedule_mode,"UNIFIED");
  assert.equal(saved.submission_channel,"Microsoft Teams ห้องวิชา");
  assert.deepEqual(saved.resources,[{name:"โจทย์ Sprint Review",url:"https://example.com/sprint-review"}]);
  assert.ok(saved.due_dates.all);assert.equal(saved.due_dates.sec_1,undefined);
});

test("assignment editor filters subjects by academic year and defaults to the latest year", async () => {
  const ctx=await context("admin");
  addSubject(ctx.data.assignments,{name:"วิชาเก่าสำหรับทดสอบ",academicYear:2568,semester:"1",sectionCount:2});
  addSubject(ctx.data.assignments,{name:"วิชาใหม่สำหรับทดสอบ",academicYear:2570,semester:"1",sectionCount:2});
  renderAssignmentForm(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#assignment-form")!,year=form.elements.namedItem("academic_year_filter") as HTMLSelectElement,subject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  assert.equal(year.value,"2570");assert.match(subject.textContent!,/วิชาใหม่สำหรับทดสอบ/);assert.doesNotMatch(subject.textContent!,/วิชาเก่าสำหรับทดสอบ|Object-Oriented Programming/);
  year.value="2568";year.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(subject.value,"");assert.match(subject.textContent!,/วิชาเก่าสำหรับทดสอบ/);assert.doesNotMatch(subject.textContent!,/วิชาใหม่สำหรับทดสอบ/);
});

test("assignment details show meaningful resource names", async () => {
  const ctx=await context("student");
  win.location.href="http://localhost:5173/pages/assignments/detail/?id=oop-lab4";
  renderTaskDetail(ctx);
  const resource=ctx.root.querySelector<HTMLAnchorElement>(".resource-link")!;
  assert.match(resource.textContent!,/บทเรียน Java: Inheritance/);
  assert.equal(resource.href,"https://docs.oracle.com/javase/tutorial/java/IandI/subclasses.html");
});

test("master data manages subjects while each assignment accepts a custom submission channel", async () => {
  const ctx=await context("admin");renderCatalog(ctx);
  assert.equal(ctx.root.querySelector("#catalog-kind"),null);
  assert.equal(ctx.root.querySelector("#channel-catalog-form"),null);
  const subjectForm=ctx.root.querySelector<HTMLFormElement>("#subject-catalog-form")!;
  (subjectForm.elements.namedItem("name") as HTMLInputElement).value="Discrete Mathematics";
  (subjectForm.elements.namedItem("academic_year") as HTMLInputElement).value="2569";
  (subjectForm.elements.namedItem("section_count") as HTMLInputElement).value="3";
  subjectForm.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  renderAssignmentForm(ctx);
  assert.match((ctx.root.querySelector('[name="subject_id"]') as HTMLSelectElement).textContent!,/Discrete Mathematics · ปี 2569 · ภาคเรียนที่ 1 · 3 Sec/);
  assert.ok(ctx.root.querySelector<HTMLInputElement>('[name="submission_channel"]'));
  assert.equal(ctx.root.querySelector('[name="channel_id"]'),null);
  const catalog=loadCatalog(ctx.data.assignments),subject=catalog.subjects.find(row=>row.name==="Discrete Mathematics")!;
  assert.equal(deleteSubject(ctx.data.assignments,ctx.data.posts,subject.id).subjects.some(row=>row.id===subject.id),false);
  assert.throws(()=>deleteSubject(ctx.data.assignments,ctx.data.posts,loadCatalog(ctx.data.assignments).subjects.find(row=>row.name==="Object-Oriented Programming")!.id),/ใช้งานอยู่/);
  const oop=loadCatalog(ctx.data.assignments).subjects.find(row=>row.name==="Object-Oriented Programming")!;
  const edited=updateSubject(ctx.data.assignments,ctx.data.posts,oop.id,{name:"Advanced Object-Oriented Programming",academicYear:oop.academicYear,semester:oop.semester,sectionCount:oop.sectionCount});
  await repo.updateSubjectReferences(oop.id,oop.name,edited.subjects.find(row=>row.id===oop.id)!.name,oop.academicYear,oop.semester);
  const subjectSnapshot=await repo.snapshot();
  assert.ok(subjectSnapshot.assignments.filter(row=>row.subject_id===oop.id).every(row=>row.subject_name==="Advanced Object-Oriented Programming"));
  assert.ok(subjectSnapshot.posts.filter(row=>row.subject_id===oop.id).every(row=>row.subject_name==="Advanced Object-Oriented Programming"));
});

test("all page renderers provide content for both roles and missing records", async () => {
  for(const role of ["student","admin"] as const){
    const ctx=await context(role);
    for(const render of [renderDashboard,renderProfile,renderPostForm,renderAdminTasks,...(role==="admin"?[renderCatalog]:[])]){
      render(ctx);assert.ok(ctx.root.querySelector("h1"));
    }
    renderAuth(ctx.root,repo);assert.ok(ctx.root.querySelector("#login-form"));assert.ok(ctx.root.querySelector("#google-login"));
    renderAuth(ctx.root,repo,true);assert.ok(ctx.root.querySelector("#change-account"));
    win.location.href="http://localhost:5173/pages/posts/detail/?id=missing";
    renderPostDetail(ctx);assert.match(ctx.root.textContent!,/ไม่พบประกาศ/);
    renderTaskDetail(ctx);assert.match(ctx.root.textContent!,/ไม่พบงาน/);
    win.location.href="http://localhost:5173/pages/dashboard/";
  }
});

test("student enrollment stores one section per course and filters assignments and official news", async () => {
  const ctx=await context("student"),catalog=loadCatalog(ctx.data.assignments),oop=catalog.subjects.find(row=>row.name==="Object-Oriented Programming")!;
  saveEnrollment(ctx.user.uid,oop,1);
  const enrollments=loadEnrollments(ctx.user.uid);
  assert.equal(enrollments.length,1);assert.equal(enrollments[0].section,1);assert.equal(enrollments[0].semester,"1");
  const filtered=applyStudentVisibility(await repo.snapshot(),ctx.user,enrollments,catalog);
  assert.ok(filtered.assignments.length>0);assert.ok(filtered.assignments.every(task=>task.subject_name==="Object-Oriented Programming"));
  assert.equal(filtered.assignments.find(task=>task.assignment_id==="oop-lab4")?.due_dates.sec_2,undefined);
  assert.ok(filtered.posts.some(post=>post.category==="general"));
  assert.ok(filtered.posts.some(post=>post.post_id==="official-lab"));
  assert.equal(filtered.posts.some(post=>post.post_id==="official-exam"),false);
  ctx.enrollments=enrollments;renderEnrollment(ctx);
  assert.match(ctx.root.textContent!,/ลงทะเบียนแล้ว 1 วิชา/);assert.match(ctx.root.textContent!,/Sec 1/);
  const registrationLink=ctx.root.querySelector<HTMLAnchorElement>('a[href="https://reg.up.ac.th/"]')!;
  assert.ok(registrationLink);assert.equal(registrationLink.target,"_blank");assert.ok(registrationLink.classList.contains("button"));assert.ok(registrationLink.classList.contains("registration-check-button"));assert.match(registrationLink.textContent!,/ตรวจสอบ Sec/);
  const yearSelect=ctx.root.querySelector<HTMLSelectElement>("#enrollment-year")!;
  assert.equal(yearSelect.value,String(Math.max(...catalog.subjects.map(row=>row.academicYear))));
  yearSelect.value="ALL";yearSelect.dispatchEvent(new Event("change",{bubbles:true}));assert.equal(yearSelect.value,"ALL");
  assert.doesNotMatch(ctx.root.textContent!,/ภาคฤดูร้อน/);
  const other=catalog.subjects.find(row=>row.id!==oop.id)!;
  const otherSection=ctx.root.querySelector<HTMLSelectElement>(`[data-enrollment-section="${other.id}"]`)!;
  assert.equal(otherSection.value,"");
  ctx.root.querySelector<HTMLButtonElement>("[data-save-all-enrollments]")!.click();
  assert.equal(loadEnrollments(ctx.user.uid).length,1);
  ctx.root.querySelectorAll<HTMLSelectElement>('[data-enrollment-section]').forEach(select=>{if(!select.value)select.value="1";});
  otherSection.value="2";otherSection.dispatchEvent(new Event("change",{bubbles:true}));
  assert.equal(otherSection.value,"2");
  ctx.root.querySelector<HTMLButtonElement>("[data-save-all-enrollments]")!.click();
  assert.equal(loadEnrollments(ctx.user.uid).length,catalog.subjects.length);
  assert.equal(loadEnrollments(ctx.user.uid).find(row=>row.subject_id===other.id)?.section,2);
  const oopSection=ctx.root.querySelector<HTMLSelectElement>(`[data-enrollment-section="${oop.id}"]`)!;
  oopSection.value="2";ctx.root.querySelector<HTMLButtonElement>("[data-save-all-enrollments]")!.click();
  const updated=loadEnrollments(ctx.user.uid);
  assert.equal(updated.length,catalog.subjects.length);assert.equal(updated.find(row=>row.subject_id===oop.id)?.section,2);
});

test("single-section courses select and save Sec 1 automatically", async () => {
  const ctx=await context("student");
  addSubject(ctx.data.assignments,{name:"วิชาที่มี Sec เดียว",academicYear:2569,semester:"1",sectionCount:1});
  const catalog=loadCatalog(ctx.data.assignments),subject=catalog.subjects.find(row=>row.name==="วิชาที่มี Sec เดียว")!;
  const saved=saveEnrollment(ctx.user.uid,subject,99);
  assert.equal(saved.find(row=>row.subject_id===subject.id)?.section,1);
  ctx.catalog=catalog;ctx.enrollments=saved;renderEnrollment(ctx);
  const select=ctx.root.querySelector<HTMLSelectElement>(`[data-enrollment-section="${subject.id}"]`)!;
  assert.equal(select.value,"1");assert.equal(select.disabled,true);assert.match(select.textContent!,/Sec 1 \(อัตโนมัติ\)/);
  assert.match(ctx.root.textContent!,/วิชาที่มี Sec เดียวระบบจะเลือก Sec 1 ให้/);
});

test("student dashboard summarizes unsubmitted work and prioritizes score-saving deadlines", async () => {
  const ctx=await context("student");
  const now=Date.now(),source=ctx.data.assignments.slice(0,3);
  ctx.data.assignments=[
    {...source[0],assignment_id:"overdue-test",title:"งานเลยกำหนด",schedule_mode:"UNIFIED",due_dates:{all:new Date(now-2*3600000).toISOString()}},
    {...source[0],assignment_id:"later-test",title:"งานที่ยังมีเวลา",schedule_mode:"UNIFIED",due_dates:{all:new Date(now+72*3600000).toISOString()}},
    {...source[1],assignment_id:"soon-test",title:"งานภายใน 48 ชั่วโมง",schedule_mode:"UNIFIED",due_dates:{all:new Date(now+36*3600000).toISOString()}},
    {...source[2],assignment_id:"urgent-test",title:"งานภายใน 24 ชั่วโมง",schedule_mode:"UNIFIED",due_dates:{all:new Date(now+2*3600000).toISOString()}}
  ];
  ctx.data.progress=[];
  const general=ctx.data.posts.find(post=>post.category==="general")!;
  ctx.data.posts=ctx.data.posts.map(post=>post.post_id===general.post_id?{...post,status:"published",is_pinned:true}:post);
  renderDashboard(ctx);
  const stats=ctx.root.querySelector(".stats-grid")?.textContent ?? "";
  const calendarLink=ctx.root.querySelector<HTMLAnchorElement>('.heading-actions a[href="/pages/calendar/"]');
  assert.ok(calendarLink);assert.match(calendarLink.textContent!,/ดูปฏิทิน/);
  assert.equal(ctx.root.querySelectorAll(".stats-grid .stat").length,3);
  assert.match(stats,/งานทั้งหมดที่ยังไม่ได้ส่ง/);
  assert.match(stats,/ต้องส่งภายใน 48 ชม\./);
  assert.match(stats,/เลยกำหนดส่ง/);
  assert.doesNotMatch(stats,/24–48|กำลังทำ|ทำเสร็จแล้ว/);
  const taskRows=[...ctx.root.querySelectorAll<HTMLElement>(".dashboard-grid>section:first-child .mini-task")];
  assert.deepEqual(taskRows.map(row=>row.querySelector("a")?.textContent),["งานภายใน 24 ชั่วโมง","งานภายใน 48 ชั่วโมง","งานเลยกำหนด","งานที่ยังมีเวลา"]);
  assert.match(taskRows[0].querySelector(".badge")!.textContent!,/เหลือ 2 ชม\./);
  assert.match(taskRows[1].querySelector(".badge")!.textContent!,/เหลือ 36 ชม\./);
  assert.ok(taskRows[0].querySelector(".badge.urgent"));assert.ok(taskRows[1].querySelector(".badge.soon"));
  assert.ok(ctx.root.querySelector(".announcement-preview .badge.pin"));
  assert.ok(ctx.root.querySelector(".announcement-preview .badge.general"));
  assert.match(ctx.root.textContent!,/ข่าวประชาสัมพันธ์ของรุ่น/);assert.equal(ctx.root.querySelector('.panel-title a[href="/pages/posts/general/"]')!==null,true);
  assert.doesNotMatch(ctx.root.querySelectorAll(".dashboard-grid>section")[1].textContent!,/เตรียมตัวสอบกลางภาค|ประกาศทางการ/);
});

test("sidebar collapse preference persists and active menu is correct", async () => {
  const ctx=await context();
  mountShell(ctx.user,"official",repo);
  const newsLink=document.querySelector<HTMLAnchorElement>('a[href="/pages/posts/official/"]')!;
  assert.match(newsLink.textContent!,/ข่าวสาร/);
  assert.equal(document.querySelector('a[href="/pages/posts/general/"]'),null);
  assert.equal(newsLink.getAttribute("aria-current"),"page");
  mountShell(ctx.user,"assignments",repo);
  assert.match(document.querySelector('[aria-current="page"]')!.textContent!,/งานและการบ้าน/);
  assert.ok(document.querySelector('a[href="/pages/posts/requests/"]'));
  const studentMenu=[...document.querySelectorAll<HTMLAnchorElement>("#sidebar-nav>a")].map(link=>link.textContent!.trim());
  assert.deepEqual(studentMenu,["ภาพรวม","ข่าวสาร","งานและการบ้าน","คำขอประกาศของฉัน","รายวิชาของฉัน","โปรไฟล์"]);
  const accountCaption=[...document.querySelectorAll<HTMLElement>("#sidebar-nav .nav-caption")].find(caption=>caption.textContent==="บัญชี")!;
  assert.equal(accountCaption.nextElementSibling?.textContent?.trim(),"รายวิชาของฉัน");
  assert.equal(document.querySelector('a[href="/pages/calendar/"]'),null);
  document.querySelector<HTMLButtonElement>("#collapse-menu")!.click();
  assert.equal(localStorage.getItem("se68-sidebar-collapsed"),"true");
  assert.ok(document.body.classList.contains("sidebar-collapsed"));
  document.querySelector<HTMLButtonElement>("#collapse-menu")!.click();
  assert.equal(document.body.classList.contains("sidebar-collapsed"),false);
});
