import type { AssignmentInput, Attachment, PostInput } from "../types/models";
import { safeUrl } from "../utils/html";

export function normalizeAssignmentResources(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((resource, index) => {
    if (typeof resource === "string") {
      const url = resource.trim();
      return url ? [{ name: `เอกสารประกอบ ${index + 1}`, url }] : [];
    }
    if (!resource || typeof resource !== "object") return [];
    const row = resource as { name?: unknown; url?: unknown };
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) return [];
    const name = typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : `เอกสารประกอบ ${index + 1}`;
    return [{ name, url }];
  });
}

export function validatePost(input: PostInput): void {
  if (!input.title.trim() || !input.content.trim()) throw new Error("กรุณาระบุหัวข้อและเนื้อหาประกาศ");
  if (input.title.length > 160 || input.content.length > 10000) throw new Error("หัวข้อยาวได้ไม่เกิน 160 และเนื้อหาไม่เกิน 10,000 ตัวอักษร");
  if (!["official", "general"].includes(input.category)) throw new Error("ประเภทประกาศไม่ถูกต้อง");
  const hasSubjectId = !!input.subject_id?.trim();
  const hasSubjectName = !!input.subject_name?.trim();
  const hasSubject = hasSubjectId && hasSubjectName;
  if (hasSubjectId !== hasSubjectName) throw new Error("ข้อมูลรายวิชาไม่ครบถ้วน กรุณาเลือกรายวิชาใหม่");
  if (input.category === "official" && !hasSubject) throw new Error("ประกาศทางการต้องเลือกรายวิชาและกลุ่มผู้รับ");
  if (input.category === "general" && (hasSubject || input.target_scope !== "ALL" || input.target_sections.length)) throw new Error("ข่าวทั่วไปเป็นข่าวประชาสัมพันธ์ทั้งรุ่นและต้องไม่ระบุรายวิชาหรือ Sec");
  if (!hasSubject && input.target_scope === "SPECIFIC") throw new Error("กรุณาเลือกรายวิชาก่อนระบุ Sec");
  if (input.target_scope === "SPECIFIC" && (!input.target_sections.length || !input.target_sections.every(section => Number.isInteger(section) && section > 0) || new Set(input.target_sections).size !== input.target_sections.length)) throw new Error("กรุณาเลือกกลุ่มเรียนให้ถูกต้อง");
  if (input.target_scope === "ALL" && input.target_sections.length) throw new Error("ประกาศทั้งรุ่นต้องไม่ระบุกลุ่มเรียนเฉพาะ");
  if (!["ALL", "SPECIFIC"].includes(input.target_scope)) throw new Error("กลุ่มเป้าหมายไม่ถูกต้อง");
  if (input.image_url && !safeUrl(input.image_url)) throw new Error("ลิงก์รูปภาพต้องเป็น http หรือ https");
  if (input.attachments.some(attachment => !attachment.name.trim() || !safeUrl(attachment.url))) throw new Error("ลิงก์เอกสารต้องมีชื่อและเป็น http หรือ https");
}

export function validateAssignment(input: AssignmentInput): void {
  if (![input.title, input.subject_name, input.description, input.submission_channel].every(value => value.trim())) throw new Error("กรุณาระบุข้อมูลงานให้ครบ");
  if (!["UNIFIED", "SPLIT"].includes(input.schedule_mode)) throw new Error("รูปแบบกำหนดส่งไม่ถูกต้อง");
  const keys = Object.keys(input.due_dates);
  if (keys.some(key => input.schedule_mode === "UNIFIED" ? key !== "all" : !/^sec_[1-9][0-9]*$/.test(key))) throw new Error("กำหนดส่งไม่ตรงกับรูปแบบที่เลือก");
  if (input.title.length > 160 || input.subject_name.length > 120 || input.submission_channel.length > 120 || input.description.length > 10000) throw new Error("ข้อมูลยาวเกินกำหนด");
  const dates = input.schedule_mode === "UNIFIED"
    ? [input.due_dates.all]
    : Object.entries(input.due_dates).filter(([key]) => key.startsWith("sec_")).map(([, date]) => date).filter(Boolean);
  if (!dates.length || dates.some(date => !date || !Number.isFinite(Date.parse(date)))) throw new Error("กรุณากำหนดวันส่งอย่างน้อยหนึ่งกลุ่มให้ถูกต้อง");
  if (input.resources.some(resource => !resource.name.trim() || resource.name.length > 100 || !safeUrl(resource.url))) throw new Error("เอกสารแนบต้องมีชื่อไม่เกิน 100 ตัวอักษร และ URL ต้องเป็น http หรือ https");
}
