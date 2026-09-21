import type { AssignmentRow } from "../types/models";

const STORE = "se68-master-data-v1";

export interface SubjectCatalogRow {
  id: string;
  name: string;
  academicYear: number;
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
  const subjects=[...new Set(assignments.map(a=>a.subject_name.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map((name,index)=>({
    id:"seed-subject-"+index,name,academicYear,sectionCount:2
  }));
  const channels=[...new Set(assignments.map(a=>a.submission_channel.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map((name,index)=>({
    id:"seed-channel-"+index,name
  }));
  return {subjects,channels};
}
function valid(value:unknown):value is MasterCatalog {
  if(!value||typeof value!=="object")return false;
  const data=value as MasterCatalog;
  return Array.isArray(data.subjects)&&Array.isArray(data.channels)&&
    data.subjects.every(row=>typeof row.id==="string"&&typeof row.name==="string"&&Number.isInteger(row.academicYear)&&Number.isInteger(row.sectionCount))&&
    data.channels.every(row=>typeof row.id==="string"&&typeof row.name==="string");
}
function write(catalog:MasterCatalog):void {
  try{localStorage.setItem(STORE,JSON.stringify(catalog));}
  catch{throw new Error("ไม่สามารถบันทึกข้อมูลพื้นฐานในเบราว์เซอร์นี้ได้");}
}
export function loadCatalog(assignments:AssignmentRow[]=[]):MasterCatalog {
  try{
    const stored=localStorage.getItem(STORE);
    if(stored){const parsed:unknown=JSON.parse(stored);if(valid(parsed))return parsed;}
  }catch{/* create a clean frontend catalog below */}
  const catalog=defaults(assignments);write(catalog);return catalog;
}
export function addSubject(assignments:AssignmentRow[],input:{name:string;academicYear:number;sectionCount:number}):MasterCatalog {
  const catalog=loadCatalog(assignments),name=normalize(input.name);
  if(!name||name.length>120)throw new Error("กรุณาระบุชื่อวิชาไม่เกิน 120 ตัวอักษร");
  if(!Number.isInteger(input.academicYear)||input.academicYear<2500||input.academicYear>2700)throw new Error("ปีการศึกษาต้องอยู่ระหว่าง 2500–2700");
  if(!Number.isInteger(input.sectionCount)||input.sectionCount<1||input.sectionCount>20)throw new Error("จำนวน Sec ต้องอยู่ระหว่าง 1–20");
  if(catalog.subjects.some(row=>row.academicYear===input.academicYear&&row.name.localeCompare(name,undefined,{sensitivity:"accent"})===0))throw new Error("มีรายวิชานี้ในปีการศึกษาที่เลือกแล้ว");
  catalog.subjects.unshift({id:id("subject"),name,academicYear:input.academicYear,sectionCount:input.sectionCount});
  write(catalog);return catalog;
}
export function addChannel(assignments:AssignmentRow[],nameInput:string):MasterCatalog {
  const catalog=loadCatalog(assignments),name=normalize(nameInput);
  if(!name||name.length>120)throw new Error("กรุณาระบุชื่อช่องทางส่งงานไม่เกิน 120 ตัวอักษร");
  if(catalog.channels.some(row=>row.name.localeCompare(name,undefined,{sensitivity:"accent"})===0))throw new Error("มีช่องทางส่งงานนี้แล้ว");
  catalog.channels.unshift({id:id("channel"),name});
  write(catalog);return catalog;
}
