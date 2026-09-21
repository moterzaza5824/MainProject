import type { Context } from "../ui/context";
import { e } from "../utils/html";
import { href } from "../utils/routes";
import { formatDate, dueTime, dueEntries, progressFor, taskUrgency } from "../utils/tasks";
import { heading, signOut } from "../ui/shell";
import { badge, busy, confirmAction, empty, statusBadge, toast } from "../ui/primitives";
import { icon } from "../ui/icons";
import { urgencyBadge } from "./tasks";
export function renderDashboard(ctx:Context,admin=false) {
  const tasks=ctx.data.assignments, posts=ctx.data.posts;
  const pending=posts.filter(p=>p.status==="pending"),published=posts.filter(p=>p.status==="published");
  const unfinished=tasks.filter(a=>progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id)?.status!=="DONE");
  const dueSoon=unfinished.filter(a=>taskUrgency(a,progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id))==="soon").length;
  const dueWithin24=unfinished.filter(a=>taskUrgency(a,progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id))==="urgent").length;
  const overdue=unfinished.filter(a=>taskUrgency(a,progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id))==="overdue").length;
  const metrics=admin?[
    ["รออนุมัติ",ctx.data.post_counts?.pending ?? pending.length,"ตรวจสอบคำขอก่อนเผยแพร่","shield"],
    ["ประกาศที่เผยแพร่",ctx.data.post_counts?.published ?? published.length,"ข่าวสารของรุ่น","news"],
    ["งานทั้งหมด",tasks.length,"ครอบคลุมทุกกลุ่มเรียน","tasks"],
    ["งานใน 48 ชั่วโมง",tasks.filter(a=>["urgent","soon"].includes(taskUrgency(a))).length,"ตรวจสอบกำหนดส่ง","clock"]
  ]:[
    ["งานที่ยังไม่เสร็จ",unfinished.length,"รวมงานที่เลยกำหนดส่ง","tasks"],
    ["ใกล้ครบกำหนด",dueSoon,"ภายใน 24–48 ชั่วโมง","clock"],
    ["เหลือเวลาไม่เกิน 24 ชม.",dueWithin24,"งานที่ต้องเร่งทำก่อนถึงกำหนด","alert"],
    ["เลยกำหนดส่ง",overdue,"งานที่ยังไม่เสร็จและพ้นกำหนดแล้ว","alert"]
  ];
  ctx.root.innerHTML=heading(admin?"ภาพรวมผู้ดูแลระบบ":"สวัสดี, "+ctx.user.full_name.split(" ")[0]+" 👋",admin?"จัดการข่าวสารและงานของรุ่นให้อยู่ในที่เดียว":"วันนี้มีอะไรที่ต้องทำบ้าง มาวางแผนการเรียนไปด้วยกัน",admin?"ADMIN WORKSPACE":"YOUR DAILY OVERVIEW",'<span class="date-label">'+icon("calendar")+e(formatDate(new Date(),false))+"</span>")+
  '<div class="stats-grid">'+metrics.map(([label,count,caption,glyph],index)=>`<div class="stat ${index===0?"accent":""}"><div class="stat-icon">${icon(String(glyph))}</div><span class="stat-label">${label}</span><strong>${count}<small>${admin&&index<2?"รายการ":"งาน"}</small></strong><div class="stat-footer">${caption}</div></div>`).join("")+'</div>'+
  `<div class="dashboard-grid"><section class="panel"><div class="panel-title"><h2>${admin?"รายการที่รอการตรวจสอบ":"งานที่ต้องจัดการ"}</h2><a class="button small subtle" href="${href(admin?"approvals":"assignments")}">ดูทั้งหมด ${icon("arrow")}</a></div>${admin?
    pending.length?pending.slice(0,5).map(p=>`<div class="mini-task"><div class="subject-icon">${icon("news")}</div><div class="mini-task-main"><a href="${href("postDetail",p.post_id)}">${e(p.title)}</a><small>เสนอโดย ${e(p.author_name)}</small></div>${badge("รออนุมัติ","pending")}</div>`).join(""):empty("จัดการคำขอครบแล้ว","ไม่มีประกาศรอการอนุมัติ"):
    unfinished.length?unfinished.sort((a,b)=>dueTime(a)-dueTime(b)).slice(0,5).map(a=>`<div class="mini-task"><div class="subject-icon">${icon("tasks")}</div><div class="mini-task-main"><a href="${href("assignmentDetail",a.assignment_id)}">${e(a.title)}</a><small>${e(a.subject_name)} · ${e(formatDate(dueTime(a)))}</small></div>${urgencyBadge(a) || statusBadge(progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id)?.status??"TODO")}</div>`).join(""):empty("ทำงานครบแล้ว","ยังไม่มีงานที่ต้องจัดการในตอนนี้")}
    ${!admin?'<p class="note-hint" style="margin-top:20px">สรุปจากทุกกลุ่มเรียน โดยใช้กำหนดส่งที่ใกล้ที่สุด เลือก Section ที่เรียนได้ในหน้ารายการงาน</p>':""}</section>
    <section class="panel"><div class="panel-title"><h2>ข่าวสำคัญของรุ่น</h2><a class="button small subtle" href="${href("official")}">ดูทั้งหมด</a></div>${published.filter(p=>p.category==="official").sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned)||b.created_at.localeCompare(a.created_at)).slice(0,3).map(p=>`<a class="announcement-preview" href="${href("postDetail",p.post_id)}">${badge(p.is_pinned?"ปักหมุด":"ประกาศทางการ","official")}<h3>${e(p.title)}</h3><p>${e(formatDate(p.created_at))} · ${e(p.author_name)}</p></a>`).join("")||empty("ยังไม่มีประกาศ","ข่าวทางการจะแสดงที่นี่")}</section></div>
    ${admin?'<div class="actions" style="margin-top:24px"><a class="button primary" href="'+href("assignmentForm")+'">'+icon("plus")+' เพิ่มงาน</a><a class="button" href="'+href("adminPostForm")+'">'+icon("plus")+' สร้างประกาศ</a></div>':""}`;
}
export function renderAdminTasks(ctx:Context){
  ctx.root.innerHTML=heading("จัดการงานและการบ้าน","กำหนดงานของรุ่น และจัดการวันส่งแยกตามกลุ่มเรียน","ASSIGNMENT MANAGEMENT",'<a class="button primary" href="'+href("assignmentForm")+'">'+icon("plus")+' เพิ่มงาน</a>')+'<div id="admin-task-list"></div>';
  const render=()=>ctx.root.querySelector("#admin-task-list")!.innerHTML=ctx.data.assignments.length?
  '<div class="table-wrap"><table class="table"><thead><tr><th>ชื่องาน / รายวิชา</th><th>กำหนดส่ง (เวลาไทย)</th><th>รูปแบบ</th><th>จัดการ</th></tr></thead><tbody>'+[...ctx.data.assignments].sort((a,b)=>dueTime(a)-dueTime(b)).map(a=>`<tr><td class="title-cell"><a href="${href("assignmentDetail",a.assignment_id)}"><strong>${e(a.title)}</strong></a><small>${e(a.subject_name)}</small></td><td>${dueEntries(a).map(([s,d])=>'<div>'+e(s)+' · '+e(formatDate(d))+'</div>').join("")}</td><td>${badge(a.schedule_mode==="UNIFIED"?"ทั้งรุ่น":"แยก Section")}</td><td><div class="actions"><a class="button small" href="${href("assignmentForm",a.assignment_id)}" aria-label="แก้ไข ${e(a.title)}">${icon("edit")}</a><button class="button small danger" data-delete-task="${e(a.assignment_id)}" aria-label="ลบ ${e(a.title)}">${icon("trash")}</button></div></td></tr>`).join("")+"</tbody></table></div>":empty("ยังไม่มีงาน","เริ่มเพิ่มรายการงานเพื่อให้นิสิตติดตามความคืบหน้า",'<a class="button primary" href="'+href("assignmentForm")+'">เพิ่มงาน</a>');
  ctx.root.addEventListener("click",event=>{
    const b=(event.target as Element).closest<HTMLButtonElement>("[data-delete-task]");if(!b)return;
    void busy(b,async()=>{if(await confirmAction("ลบงานและการบ้าน","งานนี้และความคืบหน้าที่เกี่ยวข้องจะถูกลบ โปรดยืนยันก่อนดำเนินการ","ลบงาน")){await ctx.repo.deleteAssignment(b.dataset.deleteTask!);await ctx.refresh();render();toast("ลบงานแล้ว");}});
  });render();
}
export function renderProfile(ctx:Context) {
  const u=ctx.user;
  ctx.root.innerHTML=heading("โปรไฟล์ของฉัน","ข้อมูลบัญชีและสิทธิ์การเข้าใช้งาน","MY ACCOUNT")+
  `<section class="panel profile-card"><div class="profile-identity"><div class="avatar">${e(u.full_name.slice(0,1))}</div><div><h2>${e(u.full_name)}</h2>${badge(u.role==="admin"?"ผู้ดูแลระบบ":"นิสิต","done")}</div></div><dl class="profile-fields"><div><dt>อีเมลสถาบัน</dt><dd>${e(u.email)}</dd></div><div><dt>รหัสนิสิต</dt><dd>${e(u.student_id)}</dd></div><div><dt>บัญชีผู้ใช้</dt><dd>${u.role==="admin"?"Admin":"Student"}</dd></div><div><dt>เข้าร่วมเมื่อ</dt><dd>${e(formatDate(u.created_at,false))}</dd></div></dl>
  ${ctx.repo.mode==="demo"?'<div class="info-box">คุณกำลังใช้บัญชีทดลอง สามารถออกจากระบบแล้วเลือก “ทดลองเป็นนิสิต” หรือ “ทดลองเป็นผู้ดูแล” ที่หน้าเข้าสู่ระบบ ข้อมูลของทั้งสองบัญชีแยกความคืบหน้ากัน</div>':'<p class="note-hint">ชื่อและอีเมลมาจากบัญชีสถาบัน บทบาทผู้ดูแลกำหนดโดยระบบ</p>'}<div class="form-footer"><button class="button danger" id="profile-signout">${icon("out")} ออกจากระบบ</button></div></section>
  <section class="panel profile-card" style="margin-top:24px"><div class="panel-title"><h2>ประกาศของฉัน (ล่าสุด)</h2><div class="actions"><a class="button small" href="${href(u.role==="admin"?"adminPosts":"requests")}">${u.role==="admin"?"จัดการทั้งหมด":"ดูคำขอ"}</a><a class="button small" href="${href(u.role==="admin"?"adminPostForm":"postForm")}">สร้างประกาศ</a></div></div>${ctx.data.posts.filter(p=>p.author_id===u.uid).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,10).map(p=>`<div class="mini-task"><div class="mini-task-main"><a href="${href("postDetail",p.post_id)}">${e(p.title)}</a><small>${e(formatDate(p.created_at))}</small></div>${badge({published:"เผยแพร่แล้ว",pending:"รออนุมัติ",rejected:"ไม่อนุมัติ"}[p.status],p.status)}</div>`).join("")||empty("ยังไม่มีประกาศของคุณ","ประกาศที่สร้างและสถานะอนุมัติจะแสดงที่นี่")}</section>`;
  ctx.root.querySelector<HTMLButtonElement>("#profile-signout")!.onclick=()=>{void signOut(ctx.repo).catch(err=>toast(err.message,true));};
}
