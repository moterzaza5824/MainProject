import type { AcademicSemester, AssignmentRow } from "../types/models";

const STORE = "se68-master-data-v1";

export interface SubjectCatalogRow {
  id: string;
  name: string;
  academicYear: number;
  semester: AcademicSemester;
  sectionCount: number;
}
export interface ChannelCatalogRow {
  id: string;
  name: string;
}
export interface MasterCatalog {
  subjects: SubjectCatalogRow[];
  channels: ChannelCatalogRow[];
}

const normalize = (value:string) => value.trim().replace(/\s+/g," ");
const id = (prefix:string) => prefix+"-"+crypto.randomUUID();
function defaults(assignments:AssignmentRow[]):MasterCatalog {
  const academicYear=new Date().getFullYear()+543;
  const subjectMap=new Map<string,Omit<SubjectCatalogRow,"id">>();
  assignments.filter(row=>row.subject_name.trim()).forEach(row=>{
    const year=row.academic_year??academicYear,semester=row.semester??"1",key=row.subject_id??`${row.subject_name.trim()}|${year}|${semester}`;
    const sectionCount=Math.max(1,...Object.keys(row.due_dates).filter(name=>name.startsWith("sec_")).map(name=>Number(name.slice(4))));
    if(!subjectMap.has(key))subjectMap.set(key,{name:row.subject_name.trim(),academicYear:year,semester,sectionCount:Math.max(2,sectionCount)});
  });
  const ordered=[...subjectMap.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name)||b[1].academicYear-a[1].academicYear||a[1].semester.localeCompare(b[1].semester));
  const subjects=ordered.map(([key,row],index)=>({id:key.includes("|")?"seed-subject-"+index:key,...row}));
  const channels=[...new Set(assignments.map(a=>a.submission_channel.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map((name,index)=>({
    id:"seed-channel-"+index,name
  }));
  return {subjects,channels};
}
function valid(value:unknown):value is MasterCatalog {
  if(!value||typeof value!=="object")return false;
  const data=value as MasterCatalog;
  return Array.isArray(data.subjects)&&Array.isArray(data.channels)&&
    data.subjects.every(row=>typeof row.id==="string"&&typeof row.name==="string"&&Number.isInteger(row.academicYear)&&["1","2"].includes(row.semester)&&Number.isInteger(row.sectionCount))&&
    data.channels.every(row=>typeof row.id==="string"&&typeof row.name==="string");
}
function write(catalog:MasterCatalog):void {
  try{localStorage.setItem(STORE,JSON.stringify(catalog));}
  catch{throw new Error("ไม่สามารถบันทึกข้อมูลพื้นฐานในเบราว์เซอร์นี้ได้");}
}
export function loadCatalog(assignments:AssignmentRow[]=[]):MasterCatalog {
  try{
    const stored=localStorage.getItem(STORE);
    if(stored){
      const parsed=JSON.parse(stored) as Partial<MasterCatalog>;
      if(Array.isArray(parsed.subjects)&&Array.isArray(parsed.channels)){
        const legacySubjects=parsed.subjects as Array<Omit<SubjectCatalogRow,"semester">&{semester?:string}>;
        const migrated={...parsed,subjects:legacySubjects.filter(row=>row.semester!=="summer").map(row=>({...row,semester:row.semester==="2"?"2" as const:"1" as const}))};
        if(valid(migrated)){if(JSON.stringify(migrated)!==stored)write(migrated);return migrated;}
      }
    }
  }catch{/* create a clean frontend catalog below */}
  const catalog=defaults(assignments);write(catalog);return catalog;
}
export function addSubject(assignments:AssignmentRow[],input:{name:string;academicYear:number;semester:AcademicSemester;sectionCount:number}):MasterCatalog {
  const catalog=loadCatalog(assignments),name=normalize(input.name);
  if(!name||name.length>120)throw new Error("กรุณาระบุชื่อวิชาไม่เกิน 120 ตัวอักษร");
  if(!Number.isInteger(input.academicYear)||input.academicYear<2500||input.academicYear>2700)throw new Error("ปีการศึกษาต้องอยู่ระหว่าง 2500–2700");
  if(!["1","2"].includes(input.semester))throw new Error("กรุณาเลือกภาคเรียนให้ถูกต้อง");
  if(!Number.isInteger(input.sectionCount)||input.sectionCount<1||input.sectionCount>20)throw new Error("จำนวน Sec ต้องอยู่ระหว่าง 1–20");
  if(catalog.subjects.some(row=>row.academicYear===input.academicYear&&row.semester===input.semester&&row.name.localeCompare(name,undefined,{sensitivity:"accent"})===0))throw new Error("มีรายวิชานี้ในปีและภาคเรียนที่เลือกแล้ว");
  catalog.subjects.unshift({id:id("subject"),name,academicYear:input.academicYear,semester:input.semester,sectionCount:input.sectionCount});
  write(catalog);return catalog;
}
export function addChannel(assignments:AssignmentRow[],nameInput:string):MasterCatalog {
  const catalog=loadCatalog(assignments),name=normalize(nameInput);
  if(!name||name.length>120)throw new Error("กรุณาระบุชื่อช่องทางส่งงานไม่เกิน 120 ตัวอักษร");
  if(catalog.channels.some(row=>row.name.localeCompare(name,undefined,{sensitivity:"accent"})===0))throw new Error("มีช่องทางส่งงานนี้แล้ว");
  catalog.channels.unshift({id:id("channel"),name});
  write(catalog);return catalog;
}
