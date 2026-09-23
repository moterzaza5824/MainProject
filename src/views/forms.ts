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
import { semesterLabel } from "../services/enrollment";
function errorIn(form:HTMLFormElement,error:unknown){
  const element=form.querySelector<HTMLElement>("[data-error]")!;
  element.hidden=false;element.textContent=error instanceof Error?error.message:"ไม่สามารถบันทึกได้ กรุณาลองใหม่";element.focus();
}
export function renderPostForm(ctx:Context){
  const id=new URLSearchParams(location.search).get("id")??undefined, post=ctx.data.posts.find(p=>p.post_id===id);
  if(id&&(!post||(post.author_id!==ctx.user.uid&&ctx.user.role!=="admin"))){ctx.root.innerHTML=empty("ไม่สามารถแก้ไขประกาศ","ไม่พบประกาศหรือคุณไม่มีสิทธิ์");return;}
  const catalog=loadCatalog(ctx.data.assignments);
  const availableSubjects=ctx.user.role==="student"&&ctx.enrollments?catalog.subjects.filter(row=>ctx.enrollments!.some(enrollment=>enrollment.subject_id===row.id)):catalog.subjects;
  const matchedSubject=availableSubjects.find(row=>row.id===post?.subject_id)||availableSubjects.find(row=>row.name===post?.subject_name);
  const selectedSubject=matchedSubject?.id??(post?.subject_name?"legacy-subject":"");
  const subjectOptions=(post?.subject_name&&selectedSubject==="legacy-subject"?`<option value="legacy-subject" selected>${e(post.subject_name)} · ข้อมูลเดิม</option>`:"")+availableSubjects.map(row=>`<option value="${e(row.id)}" ${row.id===selectedSubject?"selected":""}>${e(row.name)} · ปี ${row.academicYear} · ${e(semesterLabel(row.semester))} · ${row.sectionCount} Sec</option>`).join("");
  const initialAudience=post?.subject_name?(post.target_scope==="SPECIFIC"&&post.target_sections.length===1?`SEC:${post.target_sections[0]}`:"ALL"):"";
  ctx.root.innerHTML=heading(id?"แก้ไขประกาศ":"สร้างประกาศ",ctx.user.role==="admin"?"เผยแพร่และจัดการข่าวสารของรุ่น":"แบ่งปันข่าวสาร หรือเสนอเป็นประกาศทางการ","WRITE AN ANNOUNCEMENT",'<a class="button" href="'+href(ctx.user.role==="admin"?"adminPosts":"official")+'">'+icon("left")+' กลับ</a>')+
  `<form class="panel form-panel" id="post-form"><div data-error class="form-error" role="alert" tabindex="-1" hidden></div>
  <section class="form-section"><h2>ประเภทและเนื้อหาข่าวสาร</h2><label class="field">ประเภทข่าวสาร <span aria-hidden="true">*</span><select name="category" required><option value="general" ${post?.category==="general"?"selected":""}>ข่าวสารทั่วไป</option><option value="official" ${post?.category==="official"?"selected":""}>ข่าวสารทางการ</option></select></label><label class="field">หัวข้อ <span aria-hidden="true">*</span><input name="title" required maxlength="160" placeholder="เช่น แจ้งเปลี่ยนห้องเรียนวิชา OOP" value="${e(post?.title??"")}"></label><label class="field">รายละเอียด <span aria-hidden="true">*</span><textarea name="content" required maxlength="10000" rows="9" placeholder="รายละเอียดที่เพื่อนร่วมรุ่นควรทราบ…">${e(post?.content??"")}</textarea><small>รองรับ ## หัวข้อ, **ตัวหนา**, รายการ - และ code ใน backtick · HTML จะแสดงเป็นข้อความ</small></label><button class="button small" type="button" id="preview-post">${icon("book")} ดูตัวอย่างเนื้อหา</button><p class="info-box" id="publication-note"></p>${ctx.user.role==="admin"?'<label class="check-label"><input type="checkbox" name="pinned" '+(post?.is_pinned?"checked":"")+'> ปักหมุดประกาศหลังเผยแพร่</label>':""}</section>
  <section class="form-section"><h2>รูปภาพและเอกสาร <small class="optional-label">ไม่บังคับ</small></h2><label class="field">URL รูปภาพ<input name="image_url" type="url" maxlength="2048" placeholder="https://example.com/image.jpg" value="${e(post?.image_url??"")}"><small>ระยะ Frontend ใช้ลิงก์รูปภาพก่อน และเปลี่ยนเป็นอัปโหลดเข้า Storage ได้เมื่อเชื่อม Backend</small></label><p class="note-hint">แนบลิงก์ Google Drive, OneDrive หรือแหล่งข้อมูลภายนอก</p><div id="attachments"></div><button class="button small" type="button" id="add-link">${icon("plus")} เพิ่มลิงก์เอกสาร</button></section>
  <section class="form-section"><h2>รายวิชาและกลุ่มผู้รับ</h2>${!catalog.subjects.length?'<div class="info-box">ยังไม่มีข้อมูลรายวิชา กรุณาให้ผู้ดูแลเพิ่มรายวิชาในหน้าข้อมูลพื้นฐานก่อนสร้างข่าวทางการ</div>':""}<div class="form-row"><label class="field">ข่าวสารของวิชา <span class="conditional-required" aria-hidden="true"></span><select name="subject_id"><option value="">ไม่ระบุรายวิชา</option>${subjectOptions}</select><small>ข่าวทางการจำเป็นต้องเลือก · ข่าวทั่วไปเว้นว่างได้</small></label><label class="field">กลุ่มผู้รับ <span class="conditional-required" aria-hidden="true"></span><select name="audience" disabled><option value="">เลือกรายวิชาก่อน</option></select><small>ตัวเลือก Sec จะอิงจากจำนวน Sec ของวิชาที่เลือก</small></label></div><p class="note-hint" id="targeting-note"></p></section>
  <div class="form-footer"><a class="button" href="${href(ctx.user.role==="admin"?"adminPosts":"official")}">ยกเลิก</a><button class="button primary" type="submit" id="post-submit">${id?"บันทึกการแก้ไข":"เผยแพร่ประกาศ"}</button></div></form>`;
  const form=ctx.root.querySelector<HTMLFormElement>("#post-form")!, clearDirty=guardDirty(form), links=form.querySelector<HTMLElement>("#attachments")!;
  const addLink=(name="",url="")=>{const row=document.createElement("div");row.className="attachment-row";row.innerHTML='<label>ชื่อเอกสาร<input required maxlength="100" data-link-name value="'+e(name)+'"></label><label>URL<input required type="url" data-link-url placeholder="https://" value="'+e(url)+'"></label><button type="button" class="icon-button" aria-label="ลบลิงก์">'+icon("close")+'</button>';row.querySelector("button")!.onclick=()=>{row.remove();form.dispatchEvent(new Event("input"));};links.append(row);};
  post?.attachments.forEach(a=>addLink(a.name,a.url));
  form.querySelector<HTMLButtonElement>("#add-link")!.onclick=()=>{addLink();links.querySelector<HTMLInputElement>(".attachment-row:last-child input")?.focus();};
  const categorySelect=form.elements.namedItem("category") as HTMLSelectElement;
  const subjectSelect=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const audienceSelect=form.elements.namedItem("audience") as HTMLSelectElement;
  const subjectFor=(value:string)=>value==="legacy-subject"&&post?.subject_name?{id:post.subject_id??"legacy-subject",name:post.subject_name,academicYear:new Date().getFullYear()+543,semester:"1" as const,sectionCount:Math.max(2,...post.target_sections)}:availableSubjects.find(row=>row.id===value);
  const renderAudience=(desired=audienceSelect.value||initialAudience)=>{
    const subject=subjectFor(subjectSelect.value);
    if(!subject){audienceSelect.innerHTML='<option value="">เลือกรายวิชาก่อน</option>';audienceSelect.disabled=true;audienceSelect.required=false;return;}
    if(subject.sectionCount===1){
      audienceSelect.innerHTML='<option value="SEC:1">Sec 1 (กำหนดอัตโนมัติ)</option>';
      audienceSelect.value="SEC:1";audienceSelect.disabled=true;audienceSelect.required=false;return;
    }
    audienceSelect.disabled=false;
    audienceSelect.innerHTML='<option value="">เลือกกลุ่มผู้รับ</option><option value="ALL">ทุก Sec ของวิชานี้</option>'+Array.from({length:subject.sectionCount},(_,index)=>`<option value="SEC:${index+1}">Sec ${index+1}</option>`).join("");
    if([...audienceSelect.options].some(option=>option.value===desired))audienceSelect.value=desired;
  };
  const updateNote=()=>{
    const official=categorySelect.value==="official",subject=subjectFor(subjectSelect.value),singleSection=subject?.sectionCount===1;
    subjectSelect.required=official;
    audienceSelect.required=(official||!!subjectSelect.value)&&!audienceSelect.disabled;
    form.querySelectorAll<HTMLElement>(".conditional-required").forEach(mark=>mark.textContent=official?"*":"");
    form.querySelector("#publication-note")!.textContent=official?(ctx.user.role==="admin"?(post&&post.status!=="published"?"การแก้ไขคงสถานะเดิม กรุณาดำเนินการอนุมัติที่หน้าตรวจสอบคำขอ":"ผู้ดูแลสามารถเผยแพร่ประกาศทางการได้ทันที"):"ประกาศทางการจะรอผู้ดูแลตรวจสอบ หากแก้ไขเนื้อหาจะส่งกลับไปรออนุมัติ"):"ประกาศทั่วไปเผยแพร่ให้เพื่อนร่วมรุ่นเห็นได้ทันที";
    form.querySelector("#targeting-note")!.textContent=singleSection?"รายวิชานี้มี 1 Sec ระบบกำหนดกลุ่มผู้รับเป็น Sec 1 อัตโนมัติ":official?"ข่าวทางการต้องเลือกรายวิชา และเลือกทุก Sec หรือ Sec ใด Sec หนึ่ง":"ข่าวทั่วไปไม่จำเป็นต้องระบุรายวิชาหรือ Sec แต่หากเลือกรายวิชา ต้องเลือกกลุ่มผู้รับให้ครบด้วย";
    form.querySelector("#post-submit")!.textContent=id?"บันทึกการแก้ไข":official&&ctx.user.role!=="admin"?"ส่งคำขออนุมัติ":"เผยแพร่ประกาศ";
  };
  categorySelect.onchange=updateNote;
  subjectSelect.onchange=()=>{renderAudience("");updateNote();};
  renderAudience(initialAudience);updateNote();
  form.querySelector<HTMLButtonElement>("#preview-post")!.onclick=()=>dialog("ตัวอย่างประกาศ",'<div class="prose">'+markdown((form.elements.namedItem("content") as HTMLTextAreaElement).value)+'</div>',true);
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>("[type=submit]")!;if(button.disabled)return;button.disabled=true;
    try{
      const fd=new FormData(form),category=fd.get("category") as PostInput["category"],subject=subjectFor(String(fd.get("subject_id")??"")),audience=subject?.sectionCount===1?"SEC:1":String(fd.get("audience")??"");
      if(category==="official"&&(!subject||!audience))throw new Error("ประกาศทางการต้องเลือกรายวิชาและกลุ่มผู้รับ");
      if(subject&&!audience)throw new Error("เมื่อเลือกรายวิชา กรุณาเลือกทุก Sec หรือ Sec ที่ต้องการ");
      const section=audience.startsWith("SEC:")?Number(audience.slice(4)):null;
      if(section&&subject&&section>subject.sectionCount)throw new Error("Sec ที่เลือกไม่อยู่ในรายวิชานี้");
      const targeted=!!subject&&!!audience;
      const input:PostInput={title:String(fd.get("title")).trim(),content:String(fd.get("content")).trim(),category,is_pinned:fd.has("pinned"),image_url:String(fd.get("image_url")??"").trim()||null,subject_id:targeted?subject.id:null,subject_name:targeted?subject.name:null,target_scope:section?"SPECIFIC":"ALL",target_sections:section?[section]:[],attachments:[...links.querySelectorAll(".attachment-row")].map(row=>({name:row.querySelector<HTMLInputElement>("[data-link-name]")!.value.trim(),url:row.querySelector<HTMLInputElement>("[data-link-url]")!.value.trim()}))};
      validatePost(input);const saved=await ctx.repo.savePost(input,id);clearDirty();navigate("postDetail",saved.post_id);
    }catch(error){errorIn(form,error);button.disabled=false;}
  };
}
export function renderAssignmentForm(ctx:Context){
  const id=new URLSearchParams(location.search).get("id")??undefined,task=ctx.data.assignments.find(a=>a.assignment_id===id);
  if(id&&!task){ctx.root.innerHTML=empty("ไม่พบงานนี้","กลับไปหน้าจัดการงานเพื่อเลือกรายการอีกครั้ง");return;}
  const catalog=loadCatalog(ctx.data.assignments);
  const matchedSubject=catalog.subjects.find(row=>row.id===task?.subject_id)??catalog.subjects.find(row=>row.name===task?.subject_name&&(!task?.academic_year||row.academicYear===task.academic_year)&&(!task?.semester||row.semester===task.semester));
  const selectedSubject=matchedSubject?.id??(task?"legacy-subject":"");
  const initialUnifiedDue=matchedSubject?.sectionCount===1?(task?.due_dates.all??task?.due_dates.sec_1):task?.due_dates.all;
  const selectedChannel=catalog.channels.find(row=>row.name===task?.submission_channel)?.id??(task?"legacy-channel":"");
  const subjectOptions=(task&&selectedSubject==="legacy-subject"?'<option value="legacy-subject" selected>'+e(task.subject_name)+' · ข้อมูลเดิม</option>':"")+catalog.subjects.map(row=>`<option value="${e(row.id)}" ${row.id===selectedSubject?"selected":""}>${e(row.name)} · ปี ${row.academicYear} · ${e(semesterLabel(row.semester))} · ${row.sectionCount} Sec</option>`).join("");
  const channelOptions=(task&&selectedChannel==="legacy-channel"?'<option value="legacy-channel" selected>'+e(task.submission_channel)+' · ข้อมูลเดิม</option>':"")+catalog.channels.map(row=>`<option value="${e(row.id)}" ${row.id===selectedChannel?"selected":""}>${e(row.name)}</option>`).join("");
  const missing=!catalog.subjects.length||!catalog.channels.length;
  ctx.root.innerHTML=heading(id?"แก้ไขงาน":"เพิ่มงานและการบ้าน","เลือกรายวิชาและช่องทางส่งจากข้อมูลพื้นฐาน แล้วกำหนดรายละเอียดของงาน","ASSIGNMENT EDITOR",'<div class="actions"><a class="button" href="'+href("adminAssignments")+'">'+icon("left")+' จัดการงาน</a><a class="button" href="'+href("adminCatalog")+'">'+icon("book")+' ข้อมูลพื้นฐาน</a></div>')+
  `<form class="panel form-panel" id="assignment-form"><div class="form-error" data-error role="alert" tabindex="-1" hidden></div>
  ${missing?'<div class="info-box">ต้องเพิ่มรายวิชาและช่องทางส่งงานให้ครบก่อนสร้างงานใหม่ <a href="'+href("adminCatalog")+'">ไปที่ข้อมูลพื้นฐาน</a></div>':""}
  <section class="form-section"><h2>รายละเอียดงาน</h2><div class="form-row"><label class="field">รายวิชา *<select name="subject_id" required><option value="">เลือกรายวิชา</option>${subjectOptions}</select><small id="subject-summary">เลือกรายวิชาที่เพิ่มไว้ในหน้าข้อมูลพื้นฐาน</small></label><label class="field">ช่องทางส่งงาน *<select name="channel_id" required><option value="">เลือกช่องทางส่งงาน</option>${channelOptions}</select><small>หากยังไม่มีตัวเลือก ให้เพิ่มในหน้าข้อมูลพื้นฐานก่อน</small></label></div><label class="field">ชื่องาน *<input name="title" required maxlength="160" value="${e(task?.title??"")}" placeholder="Lab 4: Inheritance"></label><label class="field">คำอธิบาย *<textarea name="description" required maxlength="10000" rows="7">${e(task?.description??"")}</textarea></label></section>
  <section class="form-section"><h2>กำหนดส่ง</h2><label class="field">รูปแบบกำหนดส่ง<select name="mode"><option value="UNIFIED" ${task?.schedule_mode!=="SPLIT"?"selected":""}>รวมทุก Sec ของวิชา (UNIFIED)</option><option value="SPLIT" ${task?.schedule_mode==="SPLIT"?"selected":""}>แยกกลุ่มเรียน (SPLIT)</option></select></label><div id="unified-fields"><label class="field">กำหนดส่งทั้งวิชา *<input name="all" type="datetime-local" value="${e(thaiInput(initialUnifiedDue))}"></label></div><div id="split-fields" class="form-row"></div><p class="note-hint" id="schedule-note">ทุกเวลาที่กรอกเป็นเวลาไทย (UTC+7) · ช่อง Sec จะสร้างตามรายวิชาที่เลือก และต้องมีวันส่งอย่างน้อยหนึ่งกลุ่ม</p></section>
  <section class="form-section"><h2>ลิงก์โจทย์และทรัพยากร</h2><label class="field">URL เอกสาร<textarea name="resources" rows="3" placeholder="https://…\nหนึ่งลิงก์ต่อหนึ่งบรรทัด">${e(task?.resources.join("\n")??"")}</textarea><small>ใช้ลิงก์ภายนอกแทนการอัปโหลดไฟล์</small></label></section><div class="form-footer"><a class="button" href="${href("adminAssignments")}">ยกเลิก</a><button class="button primary" type="submit">${icon("check")} ${id?"บันทึกการแก้ไข":"เพิ่มงาน"}</button></div></form>`;
  const form=ctx.root.querySelector<HTMLFormElement>("#assignment-form")!,clearDirty=guardDirty(form);
  const subjectSelect=form.elements.namedItem("subject_id") as HTMLSelectElement;
  const splitFields=form.querySelector<HTMLElement>("#split-fields")!;
  const legacySections=Math.max(2,...Object.keys(task?.due_dates??{}).filter(key=>key.startsWith("sec_")).map(key=>Number(key.slice(4))));
  const selectedCatalog=()=>catalog.subjects.find(item=>item.id===subjectSelect.value);
  const renderSplitFields=()=>{
    const values=new Map([...splitFields.querySelectorAll<HTMLInputElement>('input[name^="sec_"]')].map(input=>[input.name,input.value]));
    const count=selectedCatalog()?.sectionCount??(subjectSelect.value==="legacy-subject"?legacySections:2);
    splitFields.innerHTML=count?Array.from({length:count},(_,index)=>{const key=`sec_${index+1}`,value=values.get(key)??thaiInput(task?.due_dates[key as `sec_${number}`]);return `<label class="field">Sec ${index+1}<input name="${key}" type="datetime-local" value="${e(value)}"><small>เว้นว่างถ้างานไม่เกี่ยวข้องกับ Sec ${index+1}</small></label>`;}).join(""):'<p class="note-hint">เลือกรายวิชาก่อนเพื่อสร้างช่องกำหนดส่งตามจำนวน Sec</p>';
  };
  const updateSubject=()=>{const row=selectedCatalog();form.querySelector("#subject-summary")!.textContent=row?`ปี ${row.academicYear} · ${semesterLabel(row.semester)} · ${row.sectionCount} Sec`:"เลือกรายวิชาที่เพิ่มไว้ในหน้าข้อมูลพื้นฐาน";renderSplitFields();toggle();};
  const toggle=()=>{
    const modeSelect=form.elements.namedItem("mode") as HTMLSelectElement,singleSection=selectedCatalog()?.sectionCount===1;
    if(singleSection)modeSelect.value="UNIFIED";
    modeSelect.disabled=singleSection;
    const unified=modeSelect.value==="UNIFIED";
    form.querySelector<HTMLElement>("#unified-fields")!.hidden=!unified;form.querySelector<HTMLElement>("#split-fields")!.hidden=unified;
    (form.elements.namedItem("all") as HTMLInputElement).disabled=!unified;(form.elements.namedItem("all") as HTMLInputElement).required=unified;
    splitFields.querySelectorAll<HTMLInputElement>('input[name^="sec_"]').forEach(input=>input.disabled=unified);
    form.querySelector("#schedule-note")!.textContent=singleSection?"รายวิชานี้มี 1 Sec ระบบจะเผยแพร่งานให้ทั้งวิชาโดยอัตโนมัติ โดยไม่แบ่งกลุ่มเรียน":"ทุกเวลาที่กรอกเป็นเวลาไทย (UTC+7) · เลือกกำหนดส่งรวมทุก Sec หรือแยกตามกลุ่มเรียน";
  };
  subjectSelect.onchange=updateSubject;(form.elements.namedItem("mode") as HTMLSelectElement).onchange=toggle;renderSplitFields();updateSubject();
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>("[type=submit]")!;if(button.disabled)return;button.disabled=true;
    try{
      const fd=new FormData(form),dates:AssignmentInput["due_dates"]={};
      const subject=catalog.subjects.find(row=>row.id===String(fd.get("subject_id"))),channel=catalog.channels.find(row=>row.id===String(fd.get("channel_id")));
      const mode:AssignmentInput["schedule_mode"]=subject?.sectionCount===1?"UNIFIED":fd.get("mode") as AssignmentInput["schedule_mode"];
      const subjectName=subject?.name??(fd.get("subject_id")==="legacy-subject"?task?.subject_name:""),channelName=channel?.name??(fd.get("channel_id")==="legacy-channel"?task?.submission_channel:"");
      if(!subjectName||!channelName)throw new Error("กรุณาเลือกรายวิชาและช่องทางส่งงานจากข้อมูลพื้นฐาน");
      const keys=mode==="UNIFIED"?["all"]:[...splitFields.querySelectorAll<HTMLInputElement>('input[name^="sec_"]')].map(input=>input.name);
      for(const key of keys){const value=String(fd.get(key)??"");if(value)dates[key as keyof AssignmentInput["due_dates"]]=fromThaiInput(value);}
      const input:AssignmentInput={subject_id:subject?.id??task?.subject_id??null,subject_name:subjectName,academic_year:subject?.academicYear??task?.academic_year??null,semester:subject?.semester??task?.semester??null,title:String(fd.get("title")).trim(),description:String(fd.get("description")).trim(),submission_channel:channelName,schedule_mode:mode,due_dates:dates,resources:String(fd.get("resources")).split("\n").map(s=>s.trim()).filter(Boolean)};
      validateAssignment(input);const saved=await ctx.repo.saveAssignment(input,id);clearDirty();navigate("assignmentDetail",saved.assignment_id);
    }catch(error){errorIn(form,error);button.disabled=false;}
  };
}
