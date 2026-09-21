import type { Context } from "../ui/context";
import type { AssignmentInput, PostInput } from "../types/models";
import { e, markdown } from "../utils/html";
import { href, navigate } from "../utils/routes";
import { fromThaiInput, thaiInput } from "../utils/tasks";
import { heading } from "../ui/shell";
import { dialog, empty } from "../ui/primitives";
import { icon } from "../ui/icons";
import { validateAssignment, validatePost } from "../services/repository";
import { guardDirty } from "../utils/dirty-form";
import { loadCatalog } from "../services/catalog";
function errorIn(form:HTMLFormElement,error:unknown){
  const element=form.querySelector<HTMLElement>("[data-error]")!;
  element.hidden=false;element.textContent=error instanceof Error?error.message:"ไม่สามารถบันทึกได้ กรุณาลองใหม่";element.focus();
}
export function renderPostForm(ctx:Context){
  const id=new URLSearchParams(location.search).get("id")??undefined, post=ctx.data.posts.find(p=>p.post_id===id);
  if(id&&(!post||(post.author_id!==ctx.user.uid&&ctx.user.role!=="admin"))){ctx.root.innerHTML=empty("ไม่สามารถแก้ไขประกาศ","ไม่พบประกาศหรือคุณไม่มีสิทธิ์");return;}
  ctx.root.innerHTML=heading(id?"แก้ไขประกาศ":"สร้างประกาศ",ctx.user.role==="admin"?"เผยแพร่และจัดการข่าวสารของรุ่น":"แบ่งปันข่าวสาร หรือเสนอเป็นประกาศทางการ","WRITE AN ANNOUNCEMENT",'<a class="button" href="'+href(ctx.user.role==="admin"?"adminPosts":"general")+'">'+icon("left")+' กลับ</a>')+
  `<form class="panel form-panel" id="post-form"><div data-error class="form-error" role="alert" tabindex="-1" hidden></div>
  <section class="form-section"><h2>เนื้อหาประกาศ</h2><label class="field">หัวข้อ <span aria-hidden="true">*</span><input name="title" required maxlength="160" placeholder="เช่น แจ้งเปลี่ยนห้องเรียนวิชา OOP" value="${e(post?.title??"")}"></label><label class="field">รายละเอียด <span aria-hidden="true">*</span><textarea name="content" required maxlength="10000" rows="9" placeholder="รายละเอียดที่เพื่อนร่วมรุ่นควรทราบ…">${e(post?.content??"")}</textarea><small>รองรับ ## หัวข้อ, **ตัวหนา**, รายการ - และ code ใน backtick · HTML จะแสดงเป็นข้อความ</small></label><button class="button small" type="button" id="preview-post">${icon("book")} ดูตัวอย่างเนื้อหา</button></section>
  <section class="form-section"><h2>การเผยแพร่</h2><label class="field">ประเภทประกาศ<select name="category"><option value="general" ${post?.category==="general"?"selected":""}>ประกาศทั่วไป</option><option value="official" ${post?.category==="official"?"selected":""}>ประกาศทางการ</option></select></label>
  <p class="info-box" id="publication-note"></p>${ctx.user.role==="admin"?'<label class="check-label"><input type="checkbox" name="pinned" '+(post?.is_pinned?"checked":"")+'> ปักหมุดประกาศหลังเผยแพร่</label>':""}</section>
  <section class="form-section"><h2>ลิงก์เอกสารแนบ</h2><p class="note-hint">แนบลิงก์ Google Drive, OneDrive หรือแหล่งข้อมูลภายนอก</p><div id="attachments"></div><button class="button small" type="button" id="add-link">${icon("plus")} เพิ่มลิงก์</button></section>
  <div class="form-footer"><a class="button" href="${href(ctx.user.role==="admin"?"adminPosts":"general")}">ยกเลิก</a><button class="button primary" type="submit" id="post-submit">${id?"บันทึกการแก้ไข":"เผยแพร่ประกาศ"}</button></div></form>`;
  const form=ctx.root.querySelector<HTMLFormElement>("#post-form")!, clearDirty=guardDirty(form), links=form.querySelector<HTMLElement>("#attachments")!;
  const addLink=(name="",url="")=>{const row=document.createElement("div");row.className="attachment-row";row.innerHTML='<label>ชื่อเอกสาร<input required maxlength="100" data-link-name value="'+e(name)+'"></label><label>URL<input required type="url" data-link-url placeholder="https://" value="'+e(url)+'"></label><button type="button" class="icon-button" aria-label="ลบลิงก์">'+icon("close")+'</button>';row.querySelector("button")!.onclick=()=>{row.remove();form.dispatchEvent(new Event("input"));};links.append(row);};
  post?.attachments.forEach(a=>addLink(a.name,a.url));
  form.querySelector<HTMLButtonElement>("#add-link")!.onclick=()=>{addLink();links.querySelector<HTMLInputElement>(".attachment-row:last-child input")?.focus();};
  const updateNote=()=>{
    const official=(form.elements.namedItem("category") as HTMLSelectElement).value==="official";
    form.querySelector("#publication-note")!.textContent=official?(ctx.user.role==="admin"?(post&&post.status!=="published"?"การแก้ไขคงสถานะเดิม กรุณาดำเนินการอนุมัติที่หน้าตรวจสอบคำขอ":"ผู้ดูแลสามารถเผยแพร่ประกาศทางการได้ทันที"):"ประกาศทางการจะรอผู้ดูแลตรวจสอบ หากแก้ไขเนื้อหาจะส่งกลับไปรออนุมัติ"):"ประกาศทั่วไปเผยแพร่ให้เพื่อนร่วมรุ่นเห็นได้ทันที";
    form.querySelector("#post-submit")!.textContent=id?"บันทึกการแก้ไข":official&&ctx.user.role!=="admin"?"ส่งคำขออนุมัติ":"เผยแพร่ประกาศ";
  };
  (form.elements.namedItem("category") as HTMLSelectElement).onchange=updateNote;updateNote();
  form.querySelector<HTMLButtonElement>("#preview-post")!.onclick=()=>dialog("ตัวอย่างประกาศ",'<div class="prose">'+markdown((form.elements.namedItem("content") as HTMLTextAreaElement).value)+'</div>',true);
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>("[type=submit]")!;if(button.disabled)return;button.disabled=true;
    const fd=new FormData(form);
    const input:PostInput={title:String(fd.get("title")).trim(),content:String(fd.get("content")).trim(),category:fd.get("category") as PostInput["category"],is_pinned:fd.has("pinned"),target_scope:"ALL",target_sections:[],attachments:[...links.querySelectorAll(".attachment-row")].map(row=>({name:row.querySelector<HTMLInputElement>("[data-link-name]")!.value.trim(),url:row.querySelector<HTMLInputElement>("[data-link-url]")!.value.trim()}))};
    try{validatePost(input);const saved=await ctx.repo.savePost(input,id);clearDirty();navigate("postDetail",saved.post_id);}catch(error){errorIn(form,error);button.disabled=false;}
  };
}
export function renderAssignmentForm(ctx:Context){
  const id=new URLSearchParams(location.search).get("id")??undefined,task=ctx.data.assignments.find(a=>a.assignment_id===id);
  if(id&&!task){ctx.root.innerHTML=empty("ไม่พบงานนี้","กลับไปหน้าจัดการงานเพื่อเลือกรายการอีกครั้ง");return;}
  const catalog=loadCatalog(ctx.data.assignments);
  const selectedSubject=catalog.subjects.find(row=>row.name===task?.subject_name)?.id??(task?"legacy-subject":"");
  const selectedChannel=catalog.channels.find(row=>row.name===task?.submission_channel)?.id??(task?"legacy-channel":"");
  const subjectOptions=(task&&selectedSubject==="legacy-subject"?'<option value="legacy-subject" selected>'+e(task.subject_name)+' · ข้อมูลเดิม</option>':"")+catalog.subjects.map(row=>`<option value="${e(row.id)}" ${row.id===selectedSubject?"selected":""}>${e(row.name)} · ปีการศึกษา ${row.academicYear} · ${row.sectionCount} Sec</option>`).join("");
  const channelOptions=(task&&selectedChannel==="legacy-channel"?'<option value="legacy-channel" selected>'+e(task.submission_channel)+' · ข้อมูลเดิม</option>':"")+catalog.channels.map(row=>`<option value="${e(row.id)}" ${row.id===selectedChannel?"selected":""}>${e(row.name)}</option>`).join("");
  const missing=!catalog.subjects.length||!catalog.channels.length;
  ctx.root.innerHTML=heading(id?"แก้ไขงาน":"เพิ่มงานและการบ้าน","เลือกรายวิชาและช่องทางส่งจากข้อมูลพื้นฐาน แล้วกำหนดรายละเอียดของงาน","ASSIGNMENT EDITOR",'<div class="actions"><a class="button" href="'+href("adminAssignments")+'">'+icon("left")+' จัดการงาน</a><a class="button" href="'+href("adminCatalog")+'">'+icon("book")+' ข้อมูลพื้นฐาน</a></div>')+
  `<form class="panel form-panel" id="assignment-form"><div class="form-error" data-error role="alert" tabindex="-1" hidden></div>
  ${missing?'<div class="info-box">ต้องเพิ่มรายวิชาและช่องทางส่งงานให้ครบก่อนสร้างงานใหม่ <a href="'+href("adminCatalog")+'">ไปที่ข้อมูลพื้นฐาน</a></div>':""}
  <section class="form-section"><h2>รายละเอียดงาน</h2><div class="form-row"><label class="field">รายวิชา *<select name="subject_id" required><option value="">เลือกรายวิชา</option>${subjectOptions}</select><small id="subject-summary">เลือกรายวิชาที่เพิ่มไว้ในหน้าข้อมูลพื้นฐาน</small></label><label class="field">ช่องทางส่งงาน *<select name="channel_id" required><option value="">เลือกช่องทางส่งงาน</option>${channelOptions}</select><small>หากยังไม่มีตัวเลือก ให้เพิ่มในหน้าข้อมูลพื้นฐานก่อน</small></label></div><label class="field">ชื่องาน *<input name="title" required maxlength="160" value="${e(task?.title??"")}" placeholder="Lab 4: Inheritance"></label><label class="field">คำอธิบาย *<textarea name="description" required maxlength="10000" rows="7">${e(task?.description??"")}</textarea></label></section>
  <section class="form-section"><h2>กำหนดส่ง</h2><label class="field">รูปแบบกำหนดส่ง<select name="mode"><option value="UNIFIED" ${task?.schedule_mode!=="SPLIT"?"selected":""}>รวมทั้งรุ่น (UNIFIED)</option><option value="SPLIT" ${task?.schedule_mode==="SPLIT"?"selected":""}>แยกกลุ่มเรียน (SPLIT)</option></select></label><div id="unified-fields"><label class="field">กำหนดส่งทั้งรุ่น *<input name="all" type="datetime-local" value="${e(thaiInput(task?.due_dates.all))}"></label></div><div id="split-fields" class="form-row"><label class="field">Sec 1<input name="sec_1" type="datetime-local" value="${e(thaiInput(task?.due_dates.sec_1))}"><small>เว้นว่างถ้างานไม่เกี่ยวข้องกับ Sec 1</small></label><label class="field">Sec 2<input name="sec_2" type="datetime-local" value="${e(thaiInput(task?.due_dates.sec_2))}"><small>เว้นว่างถ้างานไม่เกี่ยวข้องกับ Sec 2</small></label></div><p class="note-hint">ทุกเวลาที่กรอกเป็นเวลาไทย (UTC+7) · SPLIT ต้องมีวันส่งอย่างน้อยหนึ่งกลุ่มเรียน</p></section>
  <section class="form-section"><h2>ลิงก์โจทย์และทรัพยากร</h2><label class="field">URL เอกสาร<textarea name="resources" rows="3" placeholder="https://…\nหนึ่งลิงก์ต่อหนึ่งบรรทัด">${e(task?.resources.join("\n")??"")}</textarea><small>ใช้ลิงก์ภายนอกแทนการอัปโหลดไฟล์</small></label></section><div class="form-footer"><a class="button" href="${href("adminAssignments")}">ยกเลิก</a><button class="button primary" type="submit">${icon("check")} ${id?"บันทึกการแก้ไข":"เพิ่มงาน"}</button></div></form>`;
  const form=ctx.root.querySelector<HTMLFormElement>("#assignment-form")!,clearDirty=guardDirty(form);
  const subjectSelect=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const updateSubjectSummary=()=>{const row=catalog.subjects.find(item=>item.id===subjectSelect.value);form.querySelector("#subject-summary")!.textContent=row?`ปีการศึกษา ${row.academicYear} · ${row.sectionCount} Sec`:"เลือกรายวิชาที่เพิ่มไว้ในหน้าข้อมูลพื้นฐาน";};
  subjectSelect.onchange=updateSubjectSummary;updateSubjectSummary();
  const toggle=()=>{
    const unified=(form.elements.namedItem("mode") as HTMLSelectElement).value==="UNIFIED";
    form.querySelector<HTMLElement>("#unified-fields")!.hidden=!unified;form.querySelector<HTMLElement>("#split-fields")!.hidden=unified;
    (form.elements.namedItem("all") as HTMLInputElement).disabled=!unified;(form.elements.namedItem("all") as HTMLInputElement).required=unified;
    ["sec_1","sec_2"].forEach(key=>(form.elements.namedItem(key) as HTMLInputElement).disabled=unified);
  };(form.elements.namedItem("mode") as HTMLSelectElement).onchange=toggle;toggle();
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>("[type=submit]")!;if(button.disabled)return;button.disabled=true;
    try{
      const fd=new FormData(form),mode=fd.get("mode") as AssignmentInput["schedule_mode"],dates:AssignmentInput["due_dates"]={};
      const subject=catalog.subjects.find(row=>row.id===String(fd.get("subject_id"))),channel=catalog.channels.find(row=>row.id===String(fd.get("channel_id")));
      const subjectName=subject?.name??(fd.get("subject_id")==="legacy-subject"?task?.subject_name:""),channelName=channel?.name??(fd.get("channel_id")==="legacy-channel"?task?.submission_channel:"");
      if(!subjectName||!channelName)throw new Error("กรุณาเลือกรายวิชาและช่องทางส่งงานจากข้อมูลพื้นฐาน");
      for(const key of(mode==="UNIFIED"?["all"]:["sec_1","sec_2"]) as (keyof AssignmentInput["due_dates"])[]){const value=String(fd.get(key)??"");if(value)dates[key]=fromThaiInput(value);}
      const input:AssignmentInput={subject_name:subjectName,title:String(fd.get("title")).trim(),description:String(fd.get("description")).trim(),submission_channel:channelName,schedule_mode:mode,due_dates:dates,resources:String(fd.get("resources")).split("\n").map(s=>s.trim()).filter(Boolean)};
      validateAssignment(input);const saved=await ctx.repo.saveAssignment(input,id);clearDirty();navigate("assignmentDetail",saved.assignment_id);
    }catch(error){errorIn(form,error);button.disabled=false;}
  };
}
