import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { DemoRepository, validateAssignment, validatePost } from "../src/services/repository";
import { createSeed } from "../src/services/seed";
import { markdown, safeUrl } from "../src/utils/html";
import { matchesSection, taskUrgency, fromThaiInput, thaiInput } from "../src/utils/tasks";
import { renderTasks, renderTaskDetail, calendarMarkup } from "../src/views/tasks";
import { renderPosts, renderPostDetail, postCard } from "../src/views/posts";
import { renderPostForm, renderAssignmentForm } from "../src/views/forms";
import { renderDashboard, renderProfile, renderAdminTasks } from "../src/views/overview";
import { renderAuth } from "../src/views/auth";
import { renderCatalog } from "../src/views/catalog";
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

test("role guards reject unauthorized mutations and progress remains private", async () => {
  const student = await context();
  await assert.rejects(repo.saveAssignment(taskInput()));
  await assert.rejects(repo.reviewPost("pending-workshop","approve"));
  await repo.saveProgress("oop-lab4","DONE","บันทึกของนิสิต");
  await repo.signIn("admin");
  assert.equal((await repo.snapshot()).progress.some(p=>p.uid===student.user.uid), false);
  await repo.saveProgress("oop-lab4","DOING","ผู้ดูแล");
  await repo.signIn("student");
  const rows=(await repo.snapshot()).progress.filter(p=>p.assignment_id==="oop-lab4");
  assert.equal(rows.length,1); assert.equal(rows[0].status,"DONE");
  await repo.saveProgress("oop-lab4","TODO","ใหม่");
  assert.equal((await repo.snapshot()).progress.filter(p=>p.assignment_id==="oop-lab4").length,1);
});

test("demo username/password login validates credentials and Google explains setup", async () => {
  await assert.rejects(repo.signInWithPassword("68020001","wrong"),/Username หรือ Password/);
  await repo.signInWithPassword("68020001@up.ac.th","se68student");
  assert.equal((await repo.currentUser())?.role,"student");
  await repo.signOut();
  await repo.signInWithPassword("admin","se68admin");
  assert.equal((await repo.currentUser())?.role,"admin");
  await repo.signOut();
  await assert.rejects(repo.signInWithGoogle(),/Supabase/);
  renderAuth(document.querySelector("#app")!,repo);
  assert.ok(document.querySelector("#login-form"));
  assert.ok(document.querySelector("#google-login"));
  assert.match(document.body.textContent!,/@up\.ac\.th/);
});

test("official approval, stale review, and student re-edit obey moderation lifecycle", async () => {
  await context();
  const post=await repo.savePost(postInput("official"));
  assert.equal(post.status,"pending");
  await repo.signIn("admin");
  await repo.savePost({...post,title:"ผู้ดูแลแก้คำผิด"},post.post_id);
  assert.equal((await repo.getPost(post.post_id))!.status,"pending");
  await repo.reviewPost(post.post_id,"approve");
  await assert.rejects(repo.reviewPost(post.post_id,"reject"));
  assert.equal((await repo.getPost(post.post_id))!.status,"published");
  await repo.signIn("student");
  const changed=await repo.savePost({...post,title:"เพิ่มรายละเอียด"},post.post_id);
  assert.equal(changed.status,"pending"); assert.equal(changed.approved_by,null);
});

test("General author edits preserve admin pin and reviewer; other pending posts stay private", async () => {
  await context();
  const p=await repo.savePost(postInput("official"));
  await repo.signIn("admin"); await repo.reviewPost(p.post_id,"general"); await repo.pinPost(p.post_id,true);
  const moderated=(await repo.getPost(p.post_id))!;
  await repo.signIn("student");
  const edited=await repo.savePost({...moderated,title:"แก้คำผิด",is_pinned:false},p.post_id);
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
  await repo.saveProgress(a.assignment_id,"DOING","draft");
  await repo.deleteAssignment(a.assignment_id);
  assert.equal((await repo.snapshot()).progress.some(p=>p.assignment_id===a.assignment_id),false);
  await assert.rejects(repo.saveProgress(a.assignment_id,"DONE",""));
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
  assert.throws(()=>validateAssignment({...taskInput(),schedule_mode:"SPLIT",due_dates:{}}));
  assert.throws(()=>validateAssignment({...taskInput(),due_dates:{sec_1:"2026-09-20"}}));
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
  const ctx=await context("student");
  renderPosts(ctx,"official");await flush();
  assert.match(ctx.root.querySelector("h1")!.textContent!,/ข่าวสาร/);
  assert.equal(ctx.root.querySelector('[data-category="official"]')?.classList.contains("active"),true);
  ctx.root.querySelector<HTMLButtonElement>('[data-category="general"]')!.click();await flush();
  assert.equal(ctx.root.querySelector('[data-category="general"]')?.classList.contains("active"),true);
  assert.equal(ctx.root.querySelector("#post-owner"),null);
  assert.equal(ctx.root.querySelector(".section-filter"),null);
  assert.doesNotMatch(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.equal(ctx.root.querySelectorAll(".badge.pending").length,0);
  ctx.root.querySelector<HTMLButtonElement>('[data-category="all"]')!.click();await flush();
  assert.equal(ctx.root.querySelector('[data-category="all"]')?.classList.contains("active"),true);
  assert.match(ctx.root.textContent!,/เตรียมตัวสอบกลางภาค/);
  assert.match(ctx.root.textContent!,/ชวนทบทวน Database/);
  assert.doesNotMatch(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.ok(ctx.root.querySelector(".badge.official"));assert.ok(ctx.root.querySelector(".badge.general"));
  renderPosts(ctx,"requests");await flush();
  assert.match(ctx.root.textContent!,/คำขอประกาศของฉัน/);
  assert.match(ctx.root.textContent!,/ขอประกาศกิจกรรม Workshop Git/);
  assert.ok(ctx.root.querySelector(".badge.pending"));
  assert.doesNotMatch(ctx.root.textContent!,/แบ่งปันสรุปบทเรียน/);
});

test("post cards lead with the author, keep context at the top, and place images after the copy", () => {
  const post=createSeed().posts.find(p=>p.post_id==="official-lab")!;
  document.querySelector("#app")!.innerHTML=postCard({...post,image_url:"https://example.com/announcement.jpg"});
  const card=document.querySelector<HTMLElement>(".post-card")!,children=[...card.children];
  const author=card.querySelector(".post-card-head .author")!,title=card.querySelector("h2")!,copy=card.querySelector(":scope > p")!,image=card.querySelector(".post-card-image")!;
  assert.ok(author.textContent!.includes(post.author_name));
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

test("clicking a feed image opens a full-image viewer", async () => {
  const ctx=await context(),raw=JSON.parse(localStorage.getItem("se68-demo-data-v1")!);
  raw.posts=raw.posts.map((post:any)=>post.category==="general"?{...post,image_url:"https://example.com/tall-poster.jpg"}:post);
  localStorage.setItem("se68-demo-data-v1",JSON.stringify(raw));
  renderPosts(ctx,"general");await flush();
  ctx.root.querySelector<HTMLButtonElement>("[data-image-url]")!.click();
  const viewer=document.querySelector<HTMLDialogElement>("dialog.image-viewer")!;
  assert.ok(viewer);assert.equal(viewer.open,true);
  assert.equal(viewer.querySelector<HTMLImageElement>(".image-viewer-image")!.src,"https://example.com/tall-poster.jpg");
  viewer.close();
});

test("announcement form keeps general targeting optional and requires course-aware targeting for official news", async () => {
  const ctx=await context("student");
  renderPostForm(ctx);
  let form=ctx.root.querySelector<HTMLFormElement>("#post-form")!;
  const generalSubject=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const generalAudience=form.elements.namedItem("audience") as HTMLSelectElement;
  assert.equal(generalSubject.required,false);
  assert.equal(generalAudience.disabled,true);
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
  assert.equal(subject.required,true);
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

test("failed post query shows an actionable retry", async () => {
  const ctx=await context(), list=repo.listPosts.bind(repo); let fail=true;
  repo.listPosts=async q=>{if(fail)throw new Error("offline");return list(q);};
  renderPosts(ctx,"official"); await flush();
  assert.ok(ctx.root.querySelector("[data-retry]"));
  fail=false; ctx.root.querySelector<HTMLButtonElement>("[data-retry]")!.click(); await flush();
  assert.ok(ctx.root.querySelector(".post-card"));
});

test("list status select saves and detail refresh removes stale urgency", async () => {
  const ctx=await context();
  renderTasks(ctx);
  const select=ctx.root.querySelector<HTMLSelectElement>('[data-task-status="oop-lab4"]')!;
  select.value="DONE";select.dispatchEvent(new Event("change",{bubbles:true}));await flush();
  assert.equal((await repo.snapshot()).progress.find(p=>p.assignment_id==="oop-lab4")!.status,"DONE");
  await repo.saveProgress("oop-lab4","TODO","");await ctx.refresh();
  win.location.href="http://localhost:5173/pages/assignments/detail/?id=oop-lab4";
  renderTaskDetail(ctx);
  const form=ctx.root.querySelector<HTMLFormElement>("#progress-form")!;
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

test("master data page adds subject and channel choices used by the assignment form", async () => {
  const ctx=await context("admin");renderCatalog(ctx);
  const kind=ctx.root.querySelector<HTMLSelectElement>("#catalog-kind")!;
  const subjectForm=ctx.root.querySelector<HTMLFormElement>("#subject-catalog-form")!;
  (subjectForm.elements.namedItem("name") as HTMLInputElement).value="Discrete Mathematics";
  (subjectForm.elements.namedItem("academic_year") as HTMLInputElement).value="2569";
  (subjectForm.elements.namedItem("section_count") as HTMLInputElement).value="3";
  subjectForm.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  kind.value="channel";kind.dispatchEvent(new Event("change",{bubbles:true}));
  const channelForm=ctx.root.querySelector<HTMLFormElement>("#channel-catalog-form")!;
  assert.equal(channelForm.hidden,false);
  (channelForm.elements.namedItem("name") as HTMLInputElement).value="Moodle";
  channelForm.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  renderAssignmentForm(ctx);
  assert.match((ctx.root.querySelector('[name="subject_id"]') as HTMLSelectElement).textContent!,/Discrete Mathematics · ปีการศึกษา 2569 · 3 Sec/);
  assert.match((ctx.root.querySelector('[name="channel_id"]') as HTMLSelectElement).textContent!,/Moodle/);
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

test("student dashboard prioritizes 24-hour and overdue work instead of progress totals", async () => {
  const ctx=await context("student");
  renderDashboard(ctx);
  const stats=ctx.root.querySelector(".stats-grid")?.textContent ?? "";
  assert.match(stats,/เหลือเวลาไม่เกิน 24 ชม\./);
  assert.match(stats,/ภายใน 24–48 ชั่วโมง/);
  assert.match(stats,/เลยกำหนดส่ง/);
  assert.doesNotMatch(stats,/กำลังทำ|ทำเสร็จแล้ว/);
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
  document.querySelector<HTMLButtonElement>("#collapse-menu")!.click();
  assert.equal(localStorage.getItem("se68-sidebar-collapsed"),"true");
  assert.ok(document.body.classList.contains("sidebar-collapsed"));
  document.querySelector<HTMLButtonElement>("#collapse-menu")!.click();
  assert.equal(document.body.classList.contains("sidebar-collapsed"),false);
});
