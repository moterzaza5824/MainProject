import type { Context } from "../ui/context";
import { e } from "../utils/html";
import { href } from "../utils/routes";
import { heading } from "../ui/shell";
import { icon } from "../ui/icons";
import { toast } from "../ui/primitives";
import { addChannel, addSubject, loadCatalog } from "../services/catalog";
import { semesterLabel } from "../services/enrollment";

export function renderCatalog(ctx:Context){
  const academicYear=new Date().getFullYear()+543;
  let catalog=loadCatalog(ctx.data.assignments);
  ctx.root.innerHTML=heading("ข้อมูลพื้นฐาน","เพิ่มรายวิชาและช่องทางส่งงานก่อนนำไปใช้ในแบบฟอร์มเพิ่มงาน","MASTER DATA",'<a class="button primary" href="'+href("assignmentForm")+'">'+icon("plus")+' เพิ่มงาน</a>')+
  `<div class="catalog-layout"><section class="panel catalog-editor"><h2>เพิ่มข้อมูล</h2><p class="note-hint">ข้อมูลต้นแบบจะบันทึกเฉพาะในเบราว์เซอร์นี้จนกว่าจะเชื่อมฐานข้อมูล</p>
    <label class="field catalog-kind">ต้องการเพิ่มอะไร<select id="catalog-kind"><option value="subject">รายวิชา</option><option value="channel">ช่องทางส่งงาน</option></select></label>
    <form id="subject-catalog-form"><div class="form-error" data-error role="alert" tabindex="-1" hidden></div>
      <label class="field">ชื่อวิชา *<input name="name" required maxlength="120" placeholder="เช่น Object-Oriented Programming"></label>
      <div class="form-row"><label class="field">ปีการศึกษา *<input name="academic_year" type="number" required min="2500" max="2700" value="${academicYear}"></label><label class="field">ภาคเรียน *<select name="semester" required><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option><option value="summer">ภาคฤดูร้อน</option></select></label></div>
      <label class="field">จำนวน Sec *<input name="section_count" type="number" required min="1" max="20" value="2"><small>ระบุจำนวนกลุ่มเรียนของวิชานี้</small></label>
      <div class="form-footer"><button class="button primary" type="submit">${icon("plus")} เพิ่มรายวิชา</button></div>
    </form>
    <form id="channel-catalog-form" hidden><div class="form-error" data-error role="alert" tabindex="-1" hidden></div>
      <label class="field">ชื่อช่องทางส่งงาน *<input name="name" required maxlength="120" placeholder="เช่น Microsoft Teams"></label>
      <div class="form-footer"><button class="button primary" type="submit">${icon("plus")} เพิ่มช่องทางส่งงาน</button></div>
    </form>
  </section><section class="catalog-lists"><div class="panel"><div class="panel-title"><h2>รายวิชาที่เพิ่มแล้ว</h2><span id="subject-total"></span></div><div id="subject-catalog-list"></div></div>
  <div class="panel"><div class="panel-title"><h2>ช่องทางส่งงาน</h2><span id="channel-total"></span></div><div id="channel-catalog-list"></div></div></section></div>`;
  const kind=ctx.root.querySelector<HTMLSelectElement>("#catalog-kind")!;
  const subjectForm=ctx.root.querySelector<HTMLFormElement>("#subject-catalog-form")!;
  const channelForm=ctx.root.querySelector<HTMLFormElement>("#channel-catalog-form")!;
  const showError=(form:HTMLFormElement,error:unknown)=>{
    const target=form.querySelector<HTMLElement>("[data-error]")!;
    target.hidden=false;target.textContent=error instanceof Error?error.message:"ไม่สามารถบันทึกข้อมูลได้";target.focus();
  };
  const renderLists=()=>{
    ctx.root.querySelector("#subject-total")!.textContent=catalog.subjects.length+" วิชา";
    ctx.root.querySelector("#channel-total")!.textContent=catalog.channels.length+" ช่องทาง";
    ctx.root.querySelector("#subject-catalog-list")!.innerHTML=catalog.subjects.length?'<div class="catalog-items">'+catalog.subjects.map(row=>`<div class="catalog-item"><div><strong>${e(row.name)}</strong><span>ปีการศึกษา ${row.academicYear} · ${e(semesterLabel(row.semester))}</span></div><b>${row.sectionCount} Sec</b></div>`).join("")+"</div>":'<p class="note-hint">ยังไม่มีรายวิชา กรุณาเพิ่มรายวิชาก่อนสร้างงาน</p>';
    ctx.root.querySelector("#channel-catalog-list")!.innerHTML=catalog.channels.length?'<div class="catalog-items">'+catalog.channels.map(row=>`<div class="catalog-item"><div><strong>${e(row.name)}</strong><span>พร้อมใช้ในแบบฟอร์มเพิ่มงาน</span></div></div>`).join("")+"</div>":'<p class="note-hint">ยังไม่มีช่องทางส่งงาน</p>';
  };
  kind.onchange=()=>{const subject=kind.value==="subject";subjectForm.hidden=!subject;channelForm.hidden=subject;(subject?subjectForm:channelForm).querySelector<HTMLInputElement>("input")?.focus();};
  subjectForm.onsubmit=event=>{
    event.preventDefault();const fd=new FormData(subjectForm);
    try{
      catalog=addSubject(ctx.data.assignments,{name:String(fd.get("name")),academicYear:Number(fd.get("academic_year")),semester:String(fd.get("semester")) as "1"|"2"|"summer",sectionCount:Number(fd.get("section_count"))});
      subjectForm.reset();(subjectForm.elements.namedItem("academic_year") as HTMLInputElement).value=String(academicYear);(subjectForm.elements.namedItem("section_count") as HTMLInputElement).value="2";
      subjectForm.querySelector<HTMLElement>("[data-error]")!.hidden=true;renderLists();toast("เพิ่มรายวิชาแล้ว");
    }catch(error){showError(subjectForm,error);}
  };
  channelForm.onsubmit=event=>{
    event.preventDefault();const fd=new FormData(channelForm);
    try{
      catalog=addChannel(ctx.data.assignments,String(fd.get("name")));channelForm.reset();channelForm.querySelector<HTMLElement>("[data-error]")!.hidden=true;renderLists();toast("เพิ่มช่องทางส่งงานแล้ว");
    }catch(error){showError(channelForm,error);}
  };
  renderLists();
}
