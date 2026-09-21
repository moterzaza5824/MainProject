import type { AssignmentInput, PostInput, PostQuery, Repository, Snapshot, Role, TaskStatus, UserRow } from "../types/models";
import { createSeed } from "./seed";
import { safeUrl } from "../utils/html";

const STORE = "se68-demo-data-v1", SESSION = "se68-demo-user-v1";
export function validatePost(input: PostInput): void {
  if (!input.title.trim() || !input.content.trim()) throw new Error("กรุณาระบุหัวข้อและเนื้อหาประกาศ");
  if (input.title.length > 160 || input.content.length > 10000) throw new Error("หัวข้อยาวได้ไม่เกิน 160 และเนื้อหาไม่เกิน 10,000 ตัวอักษร");
  if (!["official","general"].includes(input.category)) throw new Error("ประเภทประกาศไม่ถูกต้อง");
  if (input.target_scope === "SPECIFIC" && (!input.target_sections.length || !input.target_sections.every(n => n === 1 || n === 2) || new Set(input.target_sections).size !== input.target_sections.length)) throw new Error("กรุณาเลือกกลุ่มเรียนให้ถูกต้อง");
  if (input.target_scope === "ALL" && input.target_sections.length) throw new Error("ประกาศทั้งรุ่นต้องไม่ระบุกลุ่มเรียนเฉพาะ");
  if (!["ALL","SPECIFIC"].includes(input.target_scope)) throw new Error("กลุ่มเป้าหมายไม่ถูกต้อง");
  if (input.attachments.some(a => !a.name.trim() || !safeUrl(a.url))) throw new Error("ลิงก์เอกสารต้องมีชื่อและเป็น http หรือ https");
}
export function validateAssignment(input: AssignmentInput): void {
  if (![input.title, input.subject_name, input.description, input.submission_channel].every(x => x.trim())) throw new Error("กรุณาระบุข้อมูลงานให้ครบ");
  if (!["UNIFIED","SPLIT"].includes(input.schedule_mode)) throw new Error("รูปแบบกำหนดส่งไม่ถูกต้อง");
  const keys = Object.keys(input.due_dates);
  if (keys.some(key => input.schedule_mode === "UNIFIED" ? key !== "all" : !["sec_1","sec_2"].includes(key))) throw new Error("กำหนดส่งไม่ตรงกับรูปแบบที่เลือก");
  if (input.title.length > 160 || input.subject_name.length > 120 || input.submission_channel.length > 120 || input.description.length > 10000) throw new Error("ข้อมูลยาวเกินกำหนด");
  const dates = input.schedule_mode === "UNIFIED" ? [input.due_dates.all] : [input.due_dates.sec_1, input.due_dates.sec_2].filter(Boolean);
  if (!dates.length || dates.some(d => !d || !Number.isFinite(Date.parse(d)))) throw new Error("กรุณากำหนดวันส่งอย่างน้อยหนึ่งกลุ่มให้ถูกต้อง");
  if (input.resources.some(url => !safeUrl(url))) throw new Error("ลิงก์โจทย์ต้องเป็น http หรือ https");
}
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;
  private read(): Snapshot {
    const text = localStorage.getItem(STORE);
    if (!text) { const data = createSeed(); this.write(data); return data; }
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data.users) || !Array.isArray(data.assignments) || !Array.isArray(data.posts) || !Array.isArray(data.progress)) throw new Error();
      return data;
    } catch { throw new Error("ข้อมูลตัวอย่างในเบราว์เซอร์เสียหาย กรุณาล้างข้อมูลเว็บไซต์แล้วลองใหม่"); }
  }
  private write(data: Snapshot): void {
    try { localStorage.setItem(STORE, JSON.stringify(data)); }
    catch { throw new Error("ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์ กรุณาตรวจพื้นที่จัดเก็บและสิทธิ์"); }
  }
  async currentUser(): Promise<UserRow | null> {
    const uid = localStorage.getItem(SESSION);
    return uid ? this.read().users.find(u => u.uid === uid) ?? null : null;
  }
  private async user(admin = false): Promise<UserRow> {
    const user = await this.currentUser();
    if (!user || (admin && user.role !== "admin")) throw new Error("คุณไม่มีสิทธิ์ดำเนินการนี้");
    return user;
  }
  async signIn(role: Role = "student"): Promise<void> {
    const user = this.read().users.find(u => u.role === role)!;
    localStorage.setItem(SESSION, user.uid);
  }
  async signInWithPassword(username: string, password: string): Promise<void> {
    const normalized = username.trim().toLowerCase().replace(/@up\.ac\.th$/, "");
    const account = normalized === "admin" && password === "se68admin"
      ? this.read().users.find(u => u.role === "admin")
      : normalized === "68020001" && password === "se68student"
        ? this.read().users.find(u => u.role === "student") : undefined;
    if (!account) throw new Error("Username หรือ Password ไม่ถูกต้อง");
    localStorage.setItem(SESSION, account.uid);
  }
  async signInWithGoogle(): Promise<void> {
    throw new Error("Google Login ใช้งานได้เมื่อเชื่อม Supabase และตั้งค่า Google OAuth แล้ว");
  }
  async signOut(): Promise<void> { localStorage.removeItem(SESSION); }
  async snapshot(): Promise<Snapshot> {
    const user = await this.user(), data = this.read();
    return { ...data, posts: data.posts.filter(p => p.status === "published" || p.author_id === user.uid || user.role === "admin"), progress: data.progress.filter(p => p.uid === user.uid), post_counts: { pending: data.posts.filter(p => p.status === "pending").length, published: data.posts.filter(p => p.status === "published").length } };
  }
  async getPost(id: string) { return (await this.snapshot()).posts.find(p => p.post_id === id) ?? null; }
  async getReviewerName(uid: string) { await this.user(); return this.read().users.find(u => u.uid === uid)?.full_name ?? null; }
  async listPosts(query: PostQuery) {
    const user = await this.user(), data = await this.snapshot();
    const rows = data.posts.filter(p =>
      (!query.category || p.category === query.category) &&
      (!query.status || p.status === query.status) &&
      (!query.own || p.author_id === user.uid) &&
      (!query.processed || !!p.approved_by || p.status === "rejected") &&
      (!query.section || query.section === "ALL" || p.target_scope === "ALL" || p.target_sections.includes(Number(query.section)))
    ).sort((a,b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at) || a.post_id.localeCompare(b.post_id));
    const size = Math.min(15, Math.max(1, query.pageSize ?? 10)), page = Math.max(1, query.page ?? 1);
    return { rows: rows.slice((page-1)*size, page*size), total: rows.length };
  }
  async savePost(input: PostInput, id?: string) {
    validatePost(input);
    const user = await this.user(), data = this.read(), old = data.posts.find(p => p.post_id === id);
    if (id && !old) throw new Error("ไม่พบประกาศนี้");
    if (old && old.author_id !== user.uid && user.role !== "admin") throw new Error("แก้ไขได้เฉพาะประกาศของตนเอง");
    if (!id && data.posts.filter(p => p.author_id === user.uid && Date.now() - Date.parse(p.created_at) < 60000).length >= 3) throw new Error("สร้างประกาศได้ไม่เกิน 3 ครั้งต่อนาที กรุณารอสักครู่");
    const post = { ...input, post_id: id ?? crypto.randomUUID(), author_id: old?.author_id ?? user.uid, author_name: old?.author_name ?? user.full_name,
      status: input.category === "official" && user.role !== "admin" ? "pending" as const : old && old.category === input.category ? old.status : "published" as const,
      is_pinned: user.role === "admin" ? input.is_pinned : input.category === "general" && old?.category === "general" ? old.is_pinned : false,
      approved_by: old && old.category === input.category && (user.role === "admin" || input.category === "general") ? old.approved_by : input.category === "official" && user.role === "admin" ? user.uid : null,
      created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
    data.posts = old ? data.posts.map(p => p.post_id === id ? post : p) : [post, ...data.posts];
    this.write(data); return post;
  }
  async reviewPost(id: string, action: "approve" | "reject" | "general"): Promise<void> {
    const user = await this.user(true), data = this.read(), post = data.posts.find(p => p.post_id === id);
    if (!post || post.status !== "pending") throw new Error("ประกาศนี้ถูกดำเนินการแล้ว กรุณาโหลดข้อมูลใหม่");
    post.status = action === "reject" ? "rejected" : "published";
    if (action === "general") post.category = "general";
    post.approved_by = user.uid; post.updated_at = new Date().toISOString();
    this.write(data);
  }
  async pinPost(id: string, pinned: boolean): Promise<void> {
    await this.user(true); const data = this.read(), post = data.posts.find(p => p.post_id === id);
    if (!post || post.status !== "published") throw new Error("ปักหมุดได้เฉพาะประกาศที่เผยแพร่แล้ว");
    post.is_pinned = pinned; post.updated_at = new Date().toISOString(); this.write(data);
  }
  async deletePost(id: string): Promise<void> {
    const user = await this.user(), data = this.read(), post = data.posts.find(p => p.post_id === id);
    if (!post || (post.author_id !== user.uid && user.role !== "admin")) throw new Error("ไม่มีสิทธิ์ลบประกาศนี้");
    data.posts = data.posts.filter(p => p.post_id !== id); this.write(data);
  }
  async saveAssignment(input: AssignmentInput, id?: string) {
    validateAssignment(input); const user = await this.user(true), data = this.read(), old = data.assignments.find(a => a.assignment_id === id);
    if (id && !old) throw new Error("ไม่พบงานนี้");
    const row = { ...input, assignment_id: id ?? crypto.randomUUID(), created_by: old?.created_by ?? user.uid, created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
    data.assignments = old ? data.assignments.map(a => a.assignment_id === id ? row : a) : [row, ...data.assignments];
    this.write(data); return row;
  }
  async deleteAssignment(id: string): Promise<void> {
    await this.user(true); const data = this.read();
    data.assignments = data.assignments.filter(a => a.assignment_id !== id);
    data.progress = data.progress.filter(p => p.assignment_id !== id);
    this.write(data);
  }
  async saveProgress(id: string, status: TaskStatus, note: string): Promise<void> {
    const user = await this.user(), data = this.read();
    if (!data.assignments.some(a => a.assignment_id === id)) throw new Error("งานนี้ถูกลบแล้ว");
    if (!["TODO", "DOING", "DONE"].includes(status) || note.length > 2000) throw new Error("สถานะหรือบันทึกไม่ถูกต้อง");
    const row = { id: user.uid + "_" + id, uid: user.uid, assignment_id: id, status, note, updated_at: new Date().toISOString() };
    data.progress = [...data.progress.filter(p => p.id !== row.id), row]; this.write(data);
  }
}
let selected: Promise<Repository> | undefined;
export function getRepository(): Promise<Repository> {
  const mode = import.meta.env.VITE_DATA_MODE;
  if (mode && mode !== "demo" && mode !== "supabase") return Promise.reject(new Error("VITE_DATA_MODE ต้องเป็น demo หรือ supabase"));
  return selected ??= import.meta.env.VITE_DATA_MODE === "supabase"
    ? import("./supabase-repository").then(m => new m.SupabaseRepository())
    : Promise.resolve(new DemoRepository());
}
