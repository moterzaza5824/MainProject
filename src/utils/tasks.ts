import type { AssignmentRow, ProgressRow, Section } from "../types/models";
export function matchesSection(task: AssignmentRow, section: Section): boolean {
  return section === "ALL" || task.schedule_mode === "UNIFIED" || !!task.due_dates[`sec_${Number(section)}`];
}
export function dueEntries(task: AssignmentRow, section: Section = "ALL"): [string, string][] {
  if (task.schedule_mode === "UNIFIED") return task.due_dates.all ? [["ทั้งรุ่น", task.due_dates.all]] : [];
  return Object.entries(task.due_dates)
    .filter((entry):entry is [string,string]=>/^sec_[1-9][0-9]*$/.test(entry[0])&&!!entry[1])
    .map(([key,date])=>[Number(key.slice(4)),date] as const)
    .filter(([number])=>section==="ALL"||number===Number(section))
    .sort((a,b)=>a[0]-b[0]).map(([number,date])=>[`Sec ${number}`,date]);
}
export function dueTime(task: AssignmentRow, section: Section = "ALL"): number {
  const values = dueEntries(task, section).map(([, value]) => Date.parse(value)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : Infinity;
}
export function taskUrgency(task: AssignmentRow, progress?: ProgressRow, section: Section = "ALL", now = Date.now()): "overdue" | "urgent" | "soon" | "" {
  if (progress?.status === "DONE") return "";
  const hours = (dueTime(task, section) - now) / 3600000;
  return hours < 0 ? "overdue" : hours <= 24 ? "urgent" : hours <= 48 ? "soon" : "";
}
export function progressFor(rows: ProgressRow[], uid: string, id: string): ProgressRow | undefined {
  return rows.find(row => row.uid === uid && row.assignment_id === id);
}
export function formatDate(value: string | number | Date, withTime = true): string {
  if (!Number.isFinite(new Date(value).getTime())) return "ไม่พบกำหนดส่ง";
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}
export function formatTime(value: string | number | Date): string {
  if (!Number.isFinite(new Date(value).getTime())) return "ไม่พบเวลา";
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
export function thaiInput(value?: string): string {
  if (!value) return "";
  if (!Number.isFinite(Date.parse(value))) return "";
  const date = new Date(new Date(value).getTime() + 7 * 3600000);
  return date.toISOString().slice(0, 16);
}
export function fromThaiInput(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value + ":00+07:00"))) throw new Error("วันที่หรือเวลาไม่ถูกต้อง");
  return new Date(value + ":00+07:00").toISOString();
}
