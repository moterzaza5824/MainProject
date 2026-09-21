import type { AssignmentRow, ProgressRow, Section } from "../types/models";
export function matchesSection(task: AssignmentRow, section: Section): boolean {
  return section === "ALL" || task.schedule_mode === "UNIFIED" || !!task.due_dates[section === "1" ? "sec_1" : "sec_2"];
}
export function dueEntries(task: AssignmentRow, section: Section = "ALL"): [string, string][] {
  if (task.schedule_mode === "UNIFIED") return task.due_dates.all ? [["ทั้งรุ่น", task.due_dates.all]] : [];
  const entries: [string, string][] = [];
  if (task.due_dates.sec_1 && section !== "2") entries.push(["Sec 1", task.due_dates.sec_1]);
  if (task.due_dates.sec_2 && section !== "1") entries.push(["Sec 2", task.due_dates.sec_2]);
  return entries;
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
