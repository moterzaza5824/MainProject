import { guardDirty } from "../utils/dirty-form";
import type { Context } from "../ui/context";
import type { AssignmentRow, ProgressRow, Section, TaskStatus } from "../types/models";
import { e, externalLink, markdown } from "../utils/html";
import { href } from "../utils/routes";
import { dueEntries, dueTime, formatDate, matchesSection, progressFor, taskUrgency } from "../utils/tasks";
import { heading } from "../ui/shell";
import { badge, busy, empty, statusBadge, toast } from "../ui/primitives";
import { icon } from "../ui/icons";

const urgencyLabels = { urgent: "ภายใน 24 ชม.", soon: "ภายใน 48 ชม.", overdue: "เลยกำหนดส่ง" };
export function urgencyBadge(task: AssignmentRow, progress?: ProgressRow, section: Section = "ALL") {
  const urgency = taskUrgency(task, progress, section);
  return urgency ? badge(urgencyLabels[urgency], urgency) : "";
}
export function sectionControl() {
  return '<div class="section-filter"><span>กลุ่มเรียน</span><div class="segmented" role="group" aria-label="กลุ่มเรียน"><button type="button" data-section="ALL" aria-pressed="true">ทั้งหมด</button><button type="button" data-section="1" aria-pressed="false">Sec 1</button><button type="button" data-section="2" aria-pressed="false">Sec 2</button></div></div>';
}
export function taskCard(task: AssignmentRow, ctx: Context, section: Section = "ALL") {
  const progress = progressFor(ctx.data.progress, ctx.user.uid, task.assignment_id), status = progress?.status ?? "TODO";
  const dates = dueEntries(task, section);
  return `<article class="task-card ${taskUrgency(task,progress,section)} ${status.toLowerCase()}">
  <div><div class="task-top"><span class="subject-label">${e(task.subject_name)}</span>${badge(task.schedule_mode === "UNIFIED" ? "ALL" : dueEntries(task).map(([label]) => label).join(" / "))}</div>
  <h3><a href="${href("assignmentDetail",task.assignment_id)}">${e(task.title)}</a></h3><p>${e(task.description.replace(/[#*]/g,""))}</p></div>
  <div class="task-meta"><div><small>${icon("clock")} กำหนดส่ง</small>${dates.map(([label,date]) => `<strong>${e(formatDate(date))}${dates.length>1 ? ' <small>'+label+'</small>' : ""}</strong>`).join("")}</div><div><small>ส่งผ่าน</small><strong>${e(task.submission_channel)}</strong></div>${urgencyBadge(task,progress,section)}</div>
  <div class="task-actions"><label class="sr-label">สถานะงาน<select data-task-status="${e(task.assignment_id)}" aria-label="สถานะ ${e(task.title)}">${["TODO","DOING","DONE"].map(s=>`<option value="${s}" ${status===s?"selected":""}>${{TODO:"○ ยังไม่เริ่ม",DOING:"◐ กำลังทำ",DONE:"✓ ทำเสร็จแล้ว"}[s as TaskStatus]}</option>`).join("")}</select></label><a href="${href("assignmentDetail",task.assignment_id)}">ดูรายละเอียด ${icon("arrow")}</a></div></article>`;
}
function bangkokMonth() {
  const d = new Date(Date.now() + 7 * 3600000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
export function calendarMarkup(tasks: AssignmentRow[], ctx: Context, month: Date, section: Section) {
  const year = month.getFullYear(), m = month.getMonth(), first = new Date(year,m,1), start = (first.getDay()+6)%7;
  const dates = tasks.flatMap(task=>dueEntries(task,section).map(([label,time])=>({task,label,time,key:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(time))})));
  const key = (d: Date) => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const todayKey = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  let cells = "";
  for(let i=0;i<42;i++){
    const date = new Date(year,m,i-start+1), events=dates.filter(x=>x.key===key(date));
    cells += `<div class="day ${date.getMonth()!==m?"outside":""} ${key(date)===todayKey?"today":""}"><span class="day-number">${date.getDate()}</span>${events.map(event=>{
      const progress=progressFor(ctx.data.progress,ctx.user.uid,event.task.assignment_id);
      const eventSection=event.label.startsWith("Sec ")?event.label.slice(4) as Section:"ALL";
      return `<a class="calendar-event ${(progress?.status??"TODO").toLowerCase()} ${taskUrgency(event.task,progress,eventSection)}" href="${href("assignmentDetail",event.task.assignment_id)}">${e(event.task.title)}<br>${e(event.label)} · ${progress?.status??"TODO"}</a>`;
    }).join("")}</div>`;
  }
  const monthly=dates.filter(x=>x.key.startsWith(year+"-"+String(m+1).padStart(2,"0"))).sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="calendar-panel"><div class="calendar-heading"><h2>${new Intl.DateTimeFormat("th-TH",{month:"long",year:"numeric"}).format(month)}</h2><div class="actions"><button class="button small" data-month="today">วันนี้</button><button class="icon-button" data-month="-1" aria-label="เดือนก่อนหน้า">${icon("left")}</button><button class="icon-button" data-month="1" aria-label="เดือนถัดไป">${icon("right")}</button></div></div>
  <div class="calendar-grid">${["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."].map(day=>'<div class="weekday">'+day+'</div>').join("")}${cells}</div>
  <div class="calendar-agenda">${monthly.length ? monthly.map(({task,label,time})=>`<div class="mini-task"><div class="subject-icon">${new Date(new Date(time).getTime()+7*3600000).getUTCDate()}</div><div class="mini-task-main"><a href="${href("assignmentDetail",task.assignment_id)}">${e(task.title)}</a><small>${e(label)} · ${e(formatDate(time))}</small></div></div>`).join("") : empty("เดือนนี้ไม่มีงาน","เลือกเดือนอื่นหรือเปลี่ยนตัวกรอง")}</div>
  ${!monthly.length ? '<p class="note-hint" style="margin-top:16px">เดือนนี้ไม่มีงานที่ตรงกับตัวกรอง</p>' : ""}
  <div class="legend">${statusBadge("TODO")}${statusBadge("DOING")}${statusBadge("DONE")}${badge("ขอบแดง: งานด่วน / เลยกำหนด","urgent")}</div></div>`;
}
export function renderTasks(ctx: Context, calendarOnly = false) {
  let section: Section = "ALL", status="ALL", subject="ALL", sort="near", urgentOnly=new URLSearchParams(location.search).get("urgent")==="true", view=calendarOnly?"calendar":"list";
  let month = bangkokMonth();
  ctx.root.innerHTML = heading(calendarOnly?"ปฏิทินงาน":"งานและการบ้าน",calendarOnly?"วางแผนกำหนดส่งของแต่ละวิชาในที่เดียว":"ติดตามงาน กำหนดส่ง และความคืบหน้าของคุณ",calendarOnly?"YOUR SCHEDULE":"ASSIGNMENT TRACKER",ctx.user.role==="admin" ? '<a class="button primary" href="'+href("assignmentForm")+'">'+icon("plus")+' เพิ่มงาน</a>' : '<span class="date-label">'+icon("calendar")+e(formatDate(new Date(),false))+'</span>')+
  '<div id="urgent-summary"></div><div class="filter-panel">'+sectionControl()+`<label>สถานะ<select id="status-filter"><option value="ALL">ทุกสถานะ</option><option value="TODO">ยังไม่เริ่ม</option><option value="DOING">กำลังทำ</option><option value="DONE">ทำเสร็จแล้ว</option></select></label><label>รายวิชา<select id="subject-filter"><option value="ALL">ทุกวิชา</option>${[...new Set(ctx.data.assignments.map(a=>a.subject_name))].map(s=>'<option>'+e(s)+'</option>').join("")}</select></label><label>เรียงตาม<select id="sort-filter"><option value="near">กำหนดส่งใกล้ที่สุด</option><option value="far">กำหนดส่งไกลที่สุด</option><option value="updated">อัปเดตล่าสุด</option></select></label></div>
  <div class="results-toolbar"><div><h2>รายการงาน</h2><small id="result-count"></small></div>${calendarOnly?"":'<div class="segmented view-toggle" role="group" aria-label="รูปแบบการแสดงผล"><button type="button" data-view="list">'+icon("list")+' รายการ</button><button type="button" data-view="calendar">'+icon("calendar")+' ปฏิทิน</button></div>'}</div><div id="task-results"></div>`;
  if(ctx.enrollments)ctx.root.querySelector(".section-filter")?.remove();
  const results = ctx.root.querySelector<HTMLElement>("#task-results")!;
  const render = () => {
    const matches=ctx.data.assignments.filter(a=>matchesSection(a,section));
    const urgentCount=matches.filter(a=>["urgent","soon"].includes(taskUrgency(a,progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id),section))).length;
    ctx.root.querySelector("#urgent-summary")!.innerHTML=urgentCount||urgentOnly ? `<div class="urgent-banner">${icon("alert")}<div><h2>ใกล้ถึงกำหนดส่ง ${urgentCount} งาน</h2><p>งานที่ยังไม่เสร็จและถึงกำหนดภายใน 48 ชั่วโมง</p></div><button class="button small" data-urgent>${urgentOnly?"แสดงงานทั้งหมด":"ดูงานใกล้ครบกำหนด"} ${icon("arrow")}</button></div>`:"";
    const data=matches.filter(a=>{const p=progressFor(ctx.data.progress,ctx.user.uid,a.assignment_id);return(status==="ALL"||(p?.status??"TODO")===status)&&(subject==="ALL"||a.subject_name===subject)&&(!urgentOnly||["urgent","soon"].includes(taskUrgency(a,p,section)));}).sort((a,b)=>sort==="updated"?b.updated_at.localeCompare(a.updated_at):(sort==="far"?-1:1)*(dueTime(a,section)-dueTime(b,section)));
    ctx.root.querySelector("#result-count")!.textContent=data.length+" งาน · เวลาไทย (UTC+7)";
    ctx.root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b=>{b.classList.toggle("active",b.dataset.view===view);b.setAttribute("aria-pressed",String(b.dataset.view===view));});
    results.innerHTML=view==="calendar"?calendarMarkup(data,ctx,month,section):data.length?'<div class="assignment-list">'+data.map(a=>taskCard(a,ctx,section)).join("")+"</div>":empty("ไม่พบงานที่ตรงกับตัวกรอง","ลองเปลี่ยนกลุ่มเรียน รายวิชา หรือสถานะ",'<button class="button" data-reset>ล้างตัวกรอง</button>');
  };
  ctx.root.addEventListener("click",event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>("button"); if(!button)return;
    if(button.dataset.section){section=button.dataset.section as Section;ctx.root.querySelectorAll("[data-section]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));render();}
    if(button.dataset.view){view=button.dataset.view;render();}
    if(button.dataset.month){month=button.dataset.month==="today"?bangkokMonth():new Date(month.getFullYear(),month.getMonth()+Number(button.dataset.month),1);render();}
    if(button.hasAttribute("data-urgent")){urgentOnly=!urgentOnly;render();}
    if(button.hasAttribute("data-reset")){section="ALL";status=subject="ALL";urgentOnly=false;ctx.root.querySelectorAll<HTMLSelectElement>("select").forEach(s=>{if(s.id.endsWith("-filter")&&s.id!=="sort-filter")s.value="ALL";});ctx.root.querySelectorAll<HTMLElement>("[data-section]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.section==="ALL")));render();}
  });
  ctx.root.addEventListener("change",async event=>{
    const input=event.target as HTMLSelectElement;
    if(input.id==="status-filter")status=input.value;
    if(input.id==="subject-filter")subject=input.value;
    if(input.id==="sort-filter")sort=input.value;
    if(input.dataset.taskStatus){const old=progressFor(ctx.data.progress,ctx.user.uid,input.dataset.taskStatus);input.disabled=true;try{await ctx.repo.saveProgress(input.dataset.taskStatus,input.value as TaskStatus,old?.note??"");await ctx.refresh();toast("บันทึกสถานะงานแล้ว");}catch(err){toast((err as Error).message,true);}finally{input.disabled=false;}}
    render();
  });
  render();
}
export function renderTaskDetail(ctx: Context) {
  const id=new URLSearchParams(location.search).get("id"), task=ctx.data.assignments.find(a=>a.assignment_id===id);
  if(!task){ctx.root.innerHTML=empty("ไม่พบงานนี้","งานอาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง",'<a class="button" href="'+href("assignments")+'">กลับไปรายการงาน</a>');return;}
  const progress=progressFor(ctx.data.progress,ctx.user.uid,task.assignment_id);
  ctx.root.innerHTML=heading("รายละเอียดงาน","ข้อมูลการบ้านและความคืบหน้าส่วนบุคคล","ASSIGNMENT DETAILS",'<a class="button" href="'+href("assignments")+'">'+icon("left")+' รายการงาน</a>')+
  `<div class="detail-grid"><article class="panel"><div class="task-top">${badge(task.subject_name,"official")}<span id="detail-urgency">${urgencyBadge(task,progress)}</span></div><h2 class="detail-title">${e(task.title)}</h2><div class="detail-meta"><span>อัปเดต ${e(formatDate(task.updated_at))}</span><span>${task.schedule_mode==="UNIFIED"?"กำหนดส่งรวมทั้งรุ่น":"กำหนดส่งแยกกลุ่มเรียน"}</span></div><div class="prose">${markdown(task.description)}</div><section class="detail-section"><h3>กำหนดส่ง <small>เวลาไทย (UTC+7)</small></h3>${dueEntries(task).map(([label,date])=>'<div class="deadline-item"><span>'+label+'</span><strong>'+e(formatDate(date))+'</strong></div>').join("")}</section><section class="detail-section"><h3>ช่องทางส่งงาน</h3><p>${e(task.submission_channel)}</p><p class="note-hint">ส่งงานผ่านช่องทางของรายวิชา การทำเครื่องหมายเสร็จในหน้านี้ไม่ใช่การส่งไฟล์</p></section><section class="detail-section"><h3>เอกสารและทรัพยากร</h3>${task.resources.length?task.resources.map((url,i)=>externalLink(url,"เอกสารประกอบ "+(i+1))).join(""):'<p class="note-hint">ยังไม่มีลิงก์เอกสารแนบ</p>'}</section>${ctx.user.role==="admin"?'<section class="detail-section"><a class="button" href="'+href("assignmentForm",task.assignment_id)+'">'+icon("edit")+' แก้ไขงาน</a></section>':""}</article>
  <aside class="panel sticky-panel"><h2>ความคืบหน้าของฉัน</h2><form id="progress-form" class="stack"><label>สถานะงาน<select name="status">${["TODO","DOING","DONE"].map(s=>'<option value="'+s+'" '+((progress?.status??"TODO")===s?"selected":"")+'>'+{TODO:"ยังไม่เริ่ม (TODO)",DOING:"กำลังทำ (DOING)",DONE:"ทำเสร็จแล้ว (DONE)"}[s as TaskStatus]+'</option>').join("")}</select></label><label>บันทึกส่วนตัว<textarea name="note" maxlength="2000" placeholder="จดสิ่งที่ต้องทำเพิ่มเติม…">${e(progress?.note??"")}</textarea></label><p class="note-hint">สถานะและบันทึกนี้เป็นข้อมูลส่วนตัวของคุณ</p><button class="button primary" type="submit">${icon("check")} บันทึกความคืบหน้า</button><p id="save-state" class="note-hint" role="status">${progress?"บันทึกล่าสุด "+e(formatDate(progress.updated_at)):"ยังไม่มีการบันทึก"}</p></form></aside></div>`;
  const form=ctx.root.querySelector<HTMLFormElement>("#progress-form")!,clearDirty=guardDirty(form);
  form.onsubmit=event=>{event.preventDefault();void busy(form.querySelector("button")!,async()=>{const fd=new FormData(form);const controls=[...form.querySelectorAll<HTMLInputElement>("select,textarea")];controls.forEach(input=>input.disabled=true);try{await ctx.repo.saveProgress(task.assignment_id,fd.get("status") as TaskStatus,String(fd.get("note")??""));clearDirty();await ctx.refresh();ctx.root.querySelector("#detail-urgency")!.innerHTML=urgencyBadge(task,progressFor(ctx.data.progress,ctx.user.uid,task.assignment_id));ctx.root.querySelector("#save-state")!.textContent="บันทึกแล้ว "+formatDate(new Date());toast("บันทึกความคืบหน้าแล้ว");}finally{controls.forEach(input=>input.disabled=false);}});};
}
