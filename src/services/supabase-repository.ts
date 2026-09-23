import { createClient } from "@supabase/supabase-js";
import type { AssignmentInput, AssignmentRow, PostInput, PostQuery, PostRow, ProgressRow, Repository, Snapshot, TaskStatus, UserRow } from "../types/models";
import { validateAssignment, validatePost } from "./repository";
import { href } from "../utils/routes";
import { AccessDeniedError } from "../utils/errors";
import { canViewPostForEnrollments } from "./enrollment";
const POST_FIELDS = "post_id,author_id,author_name,title,content,category,status,is_pinned,image_url,subject_id,subject_name,target_scope,target_sections,attachments,approved_by,created_at,updated_at";
const TASK_FIELDS = "assignment_id,created_by,subject_name,title,description,submission_channel,schedule_mode,due_dates,resources,created_at,updated_at";
export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  private client;
  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url.includes("your-project")) throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase");
    this.client = createClient(url, key);
  }
  async currentUser(): Promise<UserRow | null> {
    const session = await this.client.auth.getSession();
    if (session.error) throw session.error;
    if (!session.data.session) return null;
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    if (!data.user) return null;
    if (!/^68[0-9]{6}@up\.ac\.th$/i.test(data.user.email ?? "")) { await this.signOut(); throw new AccessDeniedError("บัญชีนี้ไม่ใช่บัญชีนิสิตรหัส 68 @up.ac.th"); }
    const result = await this.client.from("users").select("uid,email,student_id,full_name,role,created_at,updated_at").eq("uid", data.user.id).single();
    if (result.error) throw new Error("ยังไม่พบข้อมูลผู้ใช้ กรุณาตรวจสอบการสร้างโปรไฟล์ในระบบ");
    return result.data as UserRow;
  }
  private async user(admin = false) {
    const user = await this.currentUser();
    if (!user || (admin && user.role !== "admin")) throw new Error("ไม่มีสิทธิ์ดำเนินการ");
    return user;
  }
  async signIn() {
    await this.signInWithGoogle();
  }
  async signInWithPassword(username: string, password: string) {
    const value = username.trim().toLowerCase();
    const email = value.includes("@") ? value : value + "@up.ac.th";
    if (!/^68[0-9]{6}@up\.ac\.th$/i.test(email)) throw new AccessDeniedError("กรุณาใช้ Username นิสิตรหัส 68 หรืออีเมล @up.ac.th");
    if (!password) throw new Error("กรุณากรอก Password");
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Username หรือ Password ไม่ถูกต้อง");
    await this.currentUser();
  }
  async signInWithGoogle() {
    const { error } = await this.client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: new URL(href("dashboard"), location.origin).href, queryParams: { hd: "up.ac.th" } } });
    if (error) throw error;
  }
  async signOut() { const { error } = await this.client.auth.signOut(); if (error) throw error; }
  async snapshot(): Promise<Snapshot> {
    const user = await this.user();
    // Batch paging avoids the default 1,000-row truncation. Replace with server-filtered
    // repository queries if this cohort-sized dataset outgrows a single snapshot.
    const readAll = async (table: string, fields: string, key: string, own = false) => {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = this.client.from(table).select(fields).order(key).range(offset, offset + 499);
        if (own) query = query.eq("uid", user.uid);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 500) return rows;
      }
    };
    const [official, mine, pending, publishedCount, assignments, progress] = await Promise.all([
      this.listPosts({ category: "official", status: "published", pageSize: 3 }),
      this.listPosts({ own: true, pageSize: 10 }),
      user.role === "admin" ? this.listPosts({ status: "pending", pageSize: 5 }) : Promise.resolve({ rows: [], total: 0 }),
      this.client.from("posts").select("post_id", { count: "exact", head: true }).eq("status", "published"),
      readAll("assignments", TASK_FIELDS, "assignment_id"),
      readAll("user_task_progress", "id,uid,assignment_id,status,note,updated_at", "id", true)
    ]);
    if (publishedCount.error) throw publishedCount.error;
    const posts = [...new Map([...official.rows, ...mine.rows, ...pending.rows].map(p => [p.post_id, p])).values()];
    return { posts, assignments: assignments as AssignmentRow[], progress: progress as ProgressRow[], users: [user], post_counts: { pending: pending.total, published: publishedCount.count ?? 0 } };
  }
  async getPost(id: string): Promise<PostRow | null> {
    await this.user();
    const { data, error } = await this.client.from("posts").select(POST_FIELDS).eq("post_id", id).maybeSingle();
    if (error) throw error;
    return data as PostRow | null;
  }
  async getReviewerName(uid: string): Promise<string | null> {
    await this.user();
    const { data, error } = await this.client.from("public_profiles").select("full_name").eq("uid", uid).maybeSingle();
    if (error) throw error;
    return data?.full_name ?? null;
  }
  async listPosts(options: PostQuery) {
    const user = await this.user();
    const size = Math.min(15, Math.max(1, options.pageSize ?? 10)), page = Math.max(1, options.page ?? 1);
    let query = this.client.from("posts").select(POST_FIELDS, { count: "exact" });
    if (options.category) query = query.eq("category", options.category);
    if (options.status) query = query.eq("status", options.status);
    if (options.own) query = query.eq("author_id", user.uid);
    if (options.processed) query = query.or("approved_by.not.is.null,status.eq.rejected");
    if (options.section && options.section !== "ALL") query = query.or("target_scope.eq.ALL,target_sections.cs.{" + options.section + "}");
    if (options.enrollments) {
      const { data, error } = await query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }).order("post_id").limit(1000);
      if (error) throw error;
      const visible=(data as PostRow[]).filter(post=>canViewPostForEnrollments(post,options.enrollments!,user.uid));
      return {rows:visible.slice((page-1)*size,page*size),total:visible.length};
    }
    const { data, count, error } = await query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }).order("post_id").range((page-1)*size, page*size-1);
    if (error) throw error;
    return { rows: data as PostRow[], total: count ?? 0 };
  }
  async savePost(input: PostInput, id?: string): Promise<PostRow> {
    validatePost(input); const user = await this.user();
    const old = id ? await this.getPost(id) : null;
    if (id && !old) throw new Error("ไม่พบประกาศนี้");
    if (old && old.author_id !== user.uid && user.role !== "admin") throw new Error("แก้ไขได้เฉพาะประกาศของตนเอง");
    const payload = { ...input, status: input.category === "official" && user.role !== "admin" ? "pending" : old && old.category === input.category ? old.status : "published",
      is_pinned: user.role === "admin" ? input.is_pinned : input.category === "general" && old?.category === "general" ? old.is_pinned : false,
      approved_by: old && old.category === input.category && (user.role === "admin" || input.category === "general") ? old.approved_by : input.category === "official" && user.role === "admin" ? user.uid : null, updated_at: new Date().toISOString() };
    const query = id ? this.client.from("posts").update(payload).eq("post_id", id).eq("updated_at", old!.updated_at) : this.client.from("posts").insert({ ...payload, author_id: user.uid, author_name: user.full_name });
    const { data, error } = await query.select(POST_FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ประกาศมีการเปลี่ยนแปลงระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง");
    return data as PostRow;
  }
  async reviewPost(id: string, action: "approve" | "reject" | "general") {
    const user = await this.user(true);
    const { data, error } = await this.client.from("posts").update({ status: action === "reject" ? "rejected" : "published", ...(action === "general" ? { category: "general" } : {}), approved_by: user.uid, updated_at: new Date().toISOString() }).eq("post_id", id).eq("status", "pending").select("post_id");
    if (error) throw error; if (!data?.length) throw new Error("ประกาศนี้ถูกดำเนินการแล้ว กรุณาโหลดใหม่");
  }
  async pinPost(id: string, pinned: boolean) {
    await this.user(true);
    const { data, error } = await this.client.from("posts").update({ is_pinned: pinned, updated_at: new Date().toISOString() }).eq("post_id", id).eq("status", "published").select("post_id");
    if (error) throw error; if (!data?.length) throw new Error("ไม่สามารถปักหมุดประกาศนี้");
  }
  async deletePost(id: string) {
    await this.user(); const { data, error } = await this.client.from("posts").delete().eq("post_id", id).select("post_id");
    if (error) throw error; if (!data?.length) throw new Error("ไม่มีสิทธิ์หรือไม่พบประกาศนี้");
  }
  async saveAssignment(input: AssignmentInput, id?: string): Promise<AssignmentRow> {
    validateAssignment(input); const user = await this.user(true);
    const {subject_id:_subjectId,academic_year:_academicYear,semester:_semester,...databaseInput}=input;
    const query = id ? this.client.from("assignments").update({ ...databaseInput, updated_at: new Date().toISOString() }).eq("assignment_id", id) : this.client.from("assignments").insert({ ...databaseInput, created_by: user.uid });
    const { data, error } = await query.select(TASK_FIELDS).single(); if (error) throw error; return data as AssignmentRow;
  }
  async deleteAssignment(id: string) {
    await this.user(true); const { data, error } = await this.client.from("assignments").delete().eq("assignment_id", id).select("assignment_id");
    if (error) throw error; if (!data?.length) throw new Error("ไม่พบงานนี้");
  }
  async saveProgress(id: string, status: TaskStatus, note: string) {
    const user = await this.user();
    if (!["TODO", "DOING", "DONE"].includes(status) || note.length > 2000) throw new Error("สถานะหรือบันทึกไม่ถูกต้อง");
    const { error } = await this.client.from("user_task_progress").upsert({ id: user.uid + "_" + id, uid: user.uid, assignment_id: id, status, note, updated_at: new Date().toISOString() }, { onConflict: "uid,assignment_id" });
    if (error) throw error;
  }
}
