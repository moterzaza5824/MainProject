import type { Context } from "../ui/context";
import { e } from "../utils/html";
import { href } from "../utils/routes";
import { heading } from "../ui/shell";
import { icon } from "../ui/icons";
import { confirmAction, dialog, toast } from "../ui/primitives";
import { addSubject, deleteSubject, loadCatalog, updateSubject } from "../services/catalog";
import { hasEnrollmentsForSubject, maxEnrollmentSectionForSubject, semesterLabel, updateEnrollmentSubject } from "../services/enrollment";

export function renderCatalog(ctx:Context){
  const academicYear=new Date().getFullYear()+543;
  let catalog=loadCatalog(ctx.data.assignments);
  ctx.root.innerHTML=heading("ข้อมูลพื้นฐาน","จัดการรายวิชา ปีการศึกษา ภาคเรียน และจำนวน Sec สำหรับใช้ในระบบ","MASTER DATA",'<a class="button primary" href="'+href("assignmentForm")+'">'+icon("plus")+' เพิ่มงาน</a>')+
  `<div class="catalog-layout"><section class="panel catalog-editor"><h2>เพิ่มรายวิชา</h2><p class="note-hint">ข้อมูลต้นแบบจะบันทึกเฉพาะในเบราว์เซอร์นี้จนกว่าจะเชื่อมฐานข้อมูล</p>
    <form id="subject-catalog-form"><div class="form-error" data-error role="alert" tabindex="-1" hidden></div>
      <label class="field">ชื่อวิชา *<input name="name" required maxlength="120" placeholder="เช่น Object-Oriented Programming"></label>
      <div class="form-row"><label class="field">ปีการศึกษา *<input name="academic_year" type="number" required min="2500" max="2700" value="${academicYear}"></label><label class="field">ภาคเรียน *<select name="semester" required><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option></select></label></div>
      <label class="field">จำนวน Sec *<input name="section_count" type="number" required min="1" max="20" value="2"><small>ระบุจำนวนกลุ่มเรียนของวิชานี้</small></label>
      <div class="form-footer"><button class="button primary" type="submit">${icon("plus")} เพิ่มรายวิชา</button></div>
    </form>
  </section><section class="catalog-lists"><div class="panel"><div class="panel-title"><h2>รายวิชาที่เพิ่มแล้ว</h2><span id="subject-total"></span></div><div id="subject-catalog-list"></div></div></section></div>`;
  const subjectForm=ctx.root.querySelector<HTMLFormElement>("#subject-catalog-form")!;
  const showError=(form:HTMLFormElement,error:unknown)=>{
    const target=form.querySelector<HTMLElement>("[data-error]")!;
    target.hidden=false;target.textContent=error instanceof Error?error.message:"ไม่สามารถบันทึกข้อมูลได้";target.focus();
  };
  const renderLists=()=>{
    ctx.root.querySelector("#subject-total")!.textContent=catalog.subjects.length+" วิชา";
    ctx.root.querySelector("#subject-catalog-list")!.innerHTML=catalog.subjects.length?'<div class="catalog-items">'+catalog.subjects.map(row=>`<div class="catalog-item"><div><strong>${e(row.name)}</strong><span>ปีการศึกษา ${row.academicYear} · ${e(semesterLabel(row.semester))}</span></div><div class="catalog-item-actions"><b>${row.sectionCount} Sec</b><button class="icon-button" type="button" data-edit-subject="${e(row.id)}" aria-label="แก้ไขรายวิชา ${e(row.name)}" title="แก้ไขรายวิชา">${icon("edit")}</button><button class="icon-button danger" type="button" data-delete-subject="${e(row.id)}" aria-label="ลบรายวิชา ${e(row.name)}" title="ลบรายวิชา">${icon("trash")}</button></div></div>`).join("")+"</div>":'<p class="note-hint">ยังไม่มีรายวิชา กรุณาเพิ่มรายวิชาก่อนสร้างงาน</p>';
  };
  subjectForm.onsubmit=event=>{
    event.preventDefault();const fd=new FormData(subjectForm);
    try{
      catalog=addSubject(ctx.data.assignments,{name:String(fd.get("name")),academicYear:Number(fd.get("academic_year")),semester:String(fd.get("semester")) as "1"|"2",sectionCount:Number(fd.get("section_count"))});
      subjectForm.reset();(subjectForm.elements.namedItem("academic_year") as HTMLInputElement).value=String(academicYear);(subjectForm.elements.namedItem("section_count") as HTMLInputElement).value="2";
      subjectForm.querySelector<HTMLElement>("[data-error]")!.hidden=true;renderLists();toast("เพิ่มรายวิชาแล้ว");
    }catch(error){showError(subjectForm,error);}
  };
  const editSubject=(subjectId:string)=>{const subject=catalog.subjects.find(row=>row.id===subjectId);if(!subject)return;const modal=dialog("แก้ไขรายวิชา",`<form id="edit-subject-form"><div class="form-error" data-error role="alert" tabindex="-1" hidden></div><label class="field">ชื่อวิชา *<input name="name" required maxlength="120" value="${e(subject.name)}"></label><div class="form-row"><label class="field">ปีการศึกษา *<input name="academic_year" type="number" required min="2500" max="2700" value="${subject.academicYear}"></label><label class="field">ภาคเรียน *<select name="semester"><option value="1" ${subject.semester==="1"?"selected":""}>ภาคเรียนที่ 1</option><option value="2" ${subject.semester==="2"?"selected":""}>ภาคเรียนที่ 2</option></select></label></div><label class="field">จำนวน Sec *<input name="section_count" type="number" required min="1" max="20" value="${subject.sectionCount}"></label><p class="note-hint">ระบบจะอัปเดตชื่องาน ประกาศ และข้อมูลลงทะเบียนที่อ้างอิงรายวิชานี้ โดยคงรหัสเดิมไว้</p><div class="dialog-footer"><button class="button" type="button" data-close-edit>ยกเลิก</button><button class="button primary" type="submit">บันทึกการแก้ไข</button></div></form>`);const form=modal.querySelector<HTMLFormElement>("#edit-subject-form")!;form.querySelector<HTMLButtonElement>("[data-close-edit]")!.onclick=()=>modal.close();form.onsubmit=event=>{event.preventDefault();void(async()=>{const button=form.querySelector<HTMLButtonElement>('[type="submit"]')!,fd=new FormData(form),input={name:String(fd.get("name")),academicYear:Number(fd.get("academic_year")),semester:String(fd.get("semester")) as "1"|"2",sectionCount:Number(fd.get("section_count"))};button.disabled=true;try{const previous={name:subject.name,academicYear:subject.academicYear,semester:subject.semester,sectionCount:subject.sectionCount};catalog=updateSubject(ctx.data.assignments,ctx.data.posts,subject.id,input,maxEnrollmentSectionForSubject(subject.id));const updated=catalog.subjects.find(row=>row.id===subject.id)!;try{await ctx.repo.updateSubjectReferences(subject.id,subject.name,updated.name,updated.academicYear,updated.semester);}catch(error){catalog=updateSubject(ctx.data.assignments,ctx.data.posts,subject.id,previous,maxEnrollmentSectionForSubject(subject.id));throw error;}updateEnrollmentSubject(updated);await ctx.refresh();renderLists();modal.close();toast("อัปเดตรายวิชาและข้อมูลที่เกี่ยวข้องแล้ว");}catch(error){const target=form.querySelector<HTMLElement>("[data-error]")!;target.hidden=false;target.textContent=error instanceof Error?error.message:"แก้ไขรายวิชาไม่สำเร็จ";button.disabled=false;}})();};};
  ctx.root.addEventListener("click",event=>{const button=(event.target as Element).closest<HTMLButtonElement>("button");if(!button)return;
    if(button.dataset.editSubject)editSubject(button.dataset.editSubject);
    if(button.dataset.deleteSubject){const subject=catalog.subjects.find(row=>row.id===button.dataset.deleteSubject);if(!subject)return;void confirmAction("ลบรายวิชา",`ต้องการลบ ${subject.name} ปี ${subject.academicYear} ${semesterLabel(subject.semester)} ใช่ไหม`,"ลบรายวิชา").then(confirmed=>{if(!confirmed)return;try{catalog=deleteSubject(ctx.data.assignments,ctx.data.posts,subject.id,hasEnrollmentsForSubject(subject.id));renderLists();toast("ลบรายวิชาแล้ว");}catch(error){toast(error instanceof Error?error.message:"ลบรายวิชาไม่สำเร็จ",true);}});}
  });
  renderLists();
}
