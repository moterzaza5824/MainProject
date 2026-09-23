import type { AssignmentRow, EnrollmentRow, PostRow, Snapshot, UserRow } from "../types/models";
import type { MasterCatalog, SubjectCatalogRow } from "./catalog";

const STORE = "se68-student-enrollments-v1";

const read = ():EnrollmentRow[] => {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORE)??"[]") as unknown;
    if(!Array.isArray(parsed))return [];
    return parsed.filter((row):row is EnrollmentRow=>!!row&&typeof row==="object"&&typeof row.enrollment_id==="string"&&typeof row.uid==="string"&&typeof row.subject_id==="string"&&Number.isInteger(row.academic_year)&&["1","2"].includes(row.semester)&&Number.isInteger(row.section)&&row.section>0);
  } catch { return []; }
};
const write=(rows:EnrollmentRow[])=>{
  try { localStorage.setItem(STORE,JSON.stringify(rows)); }
  catch { throw new Error("ไม่สามารถบันทึกการลงทะเบียนในเบราว์เซอร์นี้ได้"); }
};
export const semesterLabel=(semester:SubjectCatalogRow["semester"])=>`ภาคเรียนที่ ${semester}`;
export const loadEnrollments=(uid:string)=>read().filter(row=>row.uid===uid);
export const hasEnrollmentsForSubject=(subjectId:string)=>read().some(row=>row.subject_id===subjectId);
export const maxEnrollmentSectionForSubject=(subjectId:string)=>Math.max(0,...read().filter(row=>row.subject_id===subjectId).map(row=>row.section));
export function updateEnrollmentSubject(subject:SubjectCatalogRow):void {
  const rows=read();
  write(rows.map(row=>row.subject_id===subject.id?{...row,academic_year:subject.academicYear,semester:subject.semester,updated_at:new Date().toISOString()}:row));
}
export function saveEnrollments(uid:string,selections:{subject:SubjectCatalogRow;section:number}[]):EnrollmentRow[] {
  if(!selections.length)throw new Error("ไม่มีรายวิชาให้บันทึก");
  if(new Set(selections.map(row=>row.subject.id)).size!==selections.length)throw new Error("พบรายวิชาซ้ำ กรุณาลองใหม่");
  selections.forEach(({subject,section})=>{if(!Number.isInteger(section)||section<1||section>subject.sectionCount)throw new Error(`กรุณาเลือก Sec ของ ${subject.name} ให้ถูกต้อง`);});
  const rows=read(),now=new Date().toISOString(),subjectIds=new Set(selections.map(row=>row.subject.id));
  const saved=selections.map(({subject,section})=>{const old=rows.find(row=>row.uid===uid&&row.subject_id===subject.id);return {enrollment_id:old?.enrollment_id??crypto.randomUUID(),uid,subject_id:subject.id,academic_year:subject.academicYear,semester:subject.semester,section,created_at:old?.created_at??now,updated_at:now};});
  write([...rows.filter(row=>row.uid!==uid||!subjectIds.has(row.subject_id)),...saved]);
  return loadEnrollments(uid);
}
export function saveEnrollment(uid:string,subject:SubjectCatalogRow,section:number):EnrollmentRow[] { return saveEnrollments(uid,[{subject,section}]); }
export function removeEnrollment(uid:string,subjectId:string):EnrollmentRow[] {
  write(read().filter(row=>!(row.uid===uid&&row.subject_id===subjectId)));
  return loadEnrollments(uid);
}
const subjectForAssignment=(task:AssignmentRow,catalog:MasterCatalog)=>task.subject_id?catalog.subjects.find(row=>row.id===task.subject_id):catalog.subjects.find(row=>row.name===task.subject_name&&(!task.academic_year||row.academicYear===task.academic_year)&&(!task.semester||row.semester===task.semester));
export function canViewPostForEnrollments(post:PostRow,enrollments:EnrollmentRow[],uid?:string):boolean {
  if(post.author_id===uid||post.category==="general")return true;
  if(!post.subject_id)return false;
  const enrollment=enrollments.find(row=>row.subject_id===post.subject_id);
  return !!enrollment&&(post.target_scope==="ALL"||post.target_sections.includes(enrollment.section));
}
export function applyStudentVisibility(data:Snapshot,user:UserRow,enrollments:EnrollmentRow[],catalog:MasterCatalog):Snapshot {
  if(user.role!=="student")return data;
  const assignments=data.assignments.flatMap(task=>{
    const subject=subjectForAssignment(task,catalog),enrollment=subject&&enrollments.find(row=>row.subject_id===subject.id);
    if(!enrollment)return [];
    if(task.schedule_mode==="UNIFIED")return [task];
    const due=task.due_dates[`sec_${enrollment.section}`];
    return due?[{...task,due_dates:{[`sec_${enrollment.section}`]:due}}]:[];
  });
  const visibleIds=new Set(assignments.map(task=>task.assignment_id));
  return {...data,assignments,posts:data.posts.filter(post=>canViewPostForEnrollments(post,enrollments,user.uid)),progress:data.progress.filter(row=>visibleIds.has(row.assignment_id))};
}
