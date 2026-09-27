import { createClient } from "@supabase/supabase-js";
import type { AssignmentInput, AssignmentRow, EnrollmentRow, PostInput, PostQuery, PostRow, ProgressRow, Repository, Snapshot, SubjectInput, TaskStatus, UserRow } from "../types/models";
import { normalizeAssignmentResources, validateAssignment, validatePost } from "./repository";
import { href } from "../utils/routes";
import { AccessDeniedError } from "../utils/errors";
const POST_FIELDS = "post_id,author_id,author_name,title,content,category,status,is_pinned,image_url,subject_id,subject_name,target_scope,target_sections,attachments,approved_by,created_at,updated_at";
const TASK_FIELDS = "assignment_id,created_by,subject_id,subject_name,academic_year,semester,title,description,submission_channel,schedule_mode,due_dates,resources,created_at,updated_at";
const SUBJECT_FIELDS = "subject_id,name,academic_year,semester,section_count";
const ENROLLMENT_FIELDS = "enrollment_id,uid,subject_id,academic_year,semester,section,created_at,updated_at";
export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  private client;
  private readonly url: string;
  private readonly key: string;
  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url.includes("your-project")) throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase");
    this.url = url.replace(/\/$/, "");
    this.key = key;
    this.client = createClient(url, key, {
      auth: {
        // Keep the user signed in while navigating between this multi-page app's
        // screens, but require a new sign-in after the browser tab is closed.
        storage: window.sessionStorage,
        persistSession: true
      }
    });
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
  onAuthStateChange(callback: (signedIn: boolean) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) callback(false);
      else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") callback(true);
    });
    return () => data.subscription.unsubscribe();
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
    if (error) {
      if (error.code === "email_not_confirmed") throw new Error("กรุณายืนยันอีเมลมหาวิทยาลัยก่อนเข้าสู่ระบบ");
      if (error.code === "over_request_rate_limit" || error.status === 429) throw new Error("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่");
      throw new Error("Username หรือ Password ไม่ถูกต้อง");
    }
    await this.currentUser();
  }
  async signInWithGoogle() {
    try {
      const response = await fetch(`${this.url}/auth/v1/settings`, { headers: { apikey: this.key } });
      if (response.ok) {
        const settings = await response.json() as { external?: { google?: boolean } };
        if (!settings.external?.google) throw new Error("Google Login ยังไม่เปิดใน Supabase กรุณาตั้งค่า Google OAuth ก่อนใช้งาน");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Google Login ยังไม่เปิด")) throw error;
      // A transient settings request must not block the OAuth attempt itself.
    }
    const { error } = await this.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(href("dashboard"), location.origin).href,
        queryParams: { hd: "up.ac.th", prompt: "select_account" }
      }
    });
    if (error) throw error;
  }
  async signOut() { const { error } = await this.client.auth.signOut({ scope: "local" }); if (error) throw error; }
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
    const normalizedProgress=progress.map(row=>{const value=row as ProgressRow&{status:string};return {...value,status:value.status==="DONE"?"DONE" as const:"TODO" as const};});
    const normalizedAssignments=(assignments as AssignmentRow[]).map(row=>({...row,resources:normalizeAssignmentResources(row.resources)}));
    return { posts, assignments: normalizedAssignments, progress: normalizedProgress, users: [user], post_counts: { pending: pending.total, published: publishedCount.count ?? 0 } };
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
    // Supabase RLS already filters official posts by the current user's
    // enrollments. Keeping pagination on the server avoids a 1,000-row cap.
    const { data, count, error } = await query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }).order("post_id").range((page-1)*size, page*size-1);
    if (error) throw error;
    return { rows: data as PostRow[], total: count ?? 0 };
  }
  async savePost(input: PostInput, id?: string, expectedUpdatedAt?: string): Promise<PostRow> {
    validatePost(input); const user = await this.user();
    const old = id ? await this.getPost(id) : null;
    if (id && !old) throw new Error("ไม่พบประกาศนี้");
    if (old && (!expectedUpdatedAt || old.updated_at !== expectedUpdatedAt)) throw new Error("ประกาศมีการเปลี่ยนแปลงระหว่างที่คุณกำลังแก้ไข กรุณาโหลดข้อมูลล่าสุด");
    if (old && old.author_id !== user.uid && user.role !== "admin") throw new Error("แก้ไขได้เฉพาะประกาศของตนเอง");
    const payload = { ...input, status: input.category === "official" && user.role !== "admin" ? "pending" : old && old.category === input.category ? old.status : "published",
      is_pinned: user.role === "admin" ? input.is_pinned : input.category === "general" && old?.category === "general" ? old.is_pinned : false,
      approved_by: old && old.category === input.category && (user.role === "admin" || input.category === "general") ? old.approved_by : input.category === "official" && user.role === "admin" ? user.uid : null, updated_at: new Date().toISOString() };
    const query = id ? this.client.from("posts").update(payload).eq("post_id", id).eq("updated_at", expectedUpdatedAt!) : this.client.from("posts").insert({ ...payload, author_id: user.uid, author_name: user.full_name });
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
  async saveAssignment(input: AssignmentInput, id?: string, expectedUpdatedAt?: string): Promise<AssignmentRow> {
    validateAssignment(input); const user = await this.user(true);
    if(!input.subject_id||!input.academic_year||!input.semester)throw new Error("กรุณาเลือกรายวิชาจากข้อมูลพื้นฐาน");
    if (id) {
      const previous = await this.client.from("assignments").select("updated_at").eq("assignment_id", id).maybeSingle();
      if (previous.error) throw previous.error;
      if (!previous.data) throw new Error("ไม่พบงานนี้");
      if (!expectedUpdatedAt || previous.data.updated_at !== expectedUpdatedAt) throw new Error("งานมีการเปลี่ยนแปลงระหว่างที่คุณกำลังแก้ไข กรุณาโหลดข้อมูลล่าสุด");
    }
    const query = id
      ? this.client.from("assignments").update({ ...input, updated_at: new Date().toISOString() }).eq("assignment_id", id).eq("updated_at", expectedUpdatedAt!)
      : this.client.from("assignments").insert({ ...input, created_by: user.uid });
    const { data, error } = await query.select(TASK_FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("งานนี้มีการเปลี่ยนแปลงระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง");
    const row=data as AssignmentRow;
    return {...row,resources:normalizeAssignmentResources(row.resources)};
  }
  async deleteAssignment(id: string) {
    await this.user(true); const { data, error } = await this.client.from("assignments").delete().eq("assignment_id", id).select("assignment_id");
    if (error) throw error; if (!data?.length) throw new Error("ไม่พบงานนี้");
  }
  async getSubjects() {
    await this.user();
    const {data,error}=await this.client.from("subjects").select(SUBJECT_FIELDS).order("academic_year",{ascending:false}).order("semester").order("name");
    if(error)throw error;
    return (data??[]).map(row=>({id:row.subject_id as string,name:row.name as string,academicYear:row.academic_year as number,semester:row.semester as "1"|"2",sectionCount:row.section_count as number}));
  }
  async saveSubject(input: SubjectInput,id?:string) {
    const user=await this.user(true),payload={name:input.name.trim(),academic_year:input.academicYear,semester:input.semester,section_count:input.sectionCount};
    const query=id?this.client.from("subjects").update(payload).eq("subject_id",id):this.client.from("subjects").insert({...payload,created_by:user.uid});
    const {data,error}=await query.select(SUBJECT_FIELDS).single();if(error)throw error;
    return {id:data.subject_id as string,name:data.name as string,academicYear:data.academic_year as number,semester:data.semester as "1"|"2",sectionCount:data.section_count as number};
  }
  async deleteSubject(id:string) {
    await this.user(true);const {data,error}=await this.client.from("subjects").delete().eq("subject_id",id).select("subject_id");
    if(error)throw error;if(!data?.length)throw new Error("ไม่พบรายวิชาหรือรายวิชากำลังถูกใช้งาน");
  }
  async getEnrollments() {
    const user=await this.user();const {data,error}=await this.client.from("enrollments").select(ENROLLMENT_FIELDS).eq("uid",user.uid).order("created_at");
    if(error)throw error;return (data??[]) as EnrollmentRow[];
  }
  async saveEnrollments(selections:{subject_id:string;section:number}[]) {
    const user=await this.user();
    if(!selections.length)throw new Error("ไม่มีรายวิชาให้บันทึก");
    if(new Set(selections.map(row=>row.subject_id)).size!==selections.length)throw new Error("พบรายวิชาซ้ำ กรุณาลองใหม่");
    if(selections.some(row=>!Number.isInteger(row.section)||row.section<1))throw new Error("กรุณาเลือก Sec ให้ถูกต้อง");
    const payload=selections.map(row=>({uid:user.uid,subject_id:row.subject_id,section:row.section}));
    const {error}=await this.client.from("enrollments").upsert(payload,{onConflict:"uid,subject_id"});if(error)throw error;
    return this.getEnrollments();
  }
  async removeEnrollment(subjectId:string) {
    const user=await this.user();const {error}=await this.client.from("enrollments").delete().eq("uid",user.uid).eq("subject_id",subjectId);if(error)throw error;
  }
  async updateSubjectReferences(subjectId:string,oldName:string,name:string,_academicYear:number,_semester:import("../types/models").AcademicSemester) {
    await this.user(true);
    const [posts,assignments]=await Promise.all([this.client.from("posts").update({subject_name:name,updated_at:new Date().toISOString()}).eq("subject_id",subjectId),this.client.from("assignments").update({subject_name:name,updated_at:new Date().toISOString()}).eq("subject_name",oldName)]);
    if(posts.error)throw posts.error;if(assignments.error)throw assignments.error;
  }
  async updateChannelReferences(oldName:string,name:string) {
    await this.user(true);const {error}=await this.client.from("assignments").update({submission_channel:name,updated_at:new Date().toISOString()}).eq("submission_channel",oldName);if(error)throw error;
  }
  async saveProgress(id: string, status: TaskStatus, note: string) {
    const user = await this.user();
    if (!["TODO", "DONE"].includes(status) || note.length > 2000) throw new Error("สถานะหรือบันทึกไม่ถูกต้อง");
    const { error } = await this.client.from("user_task_progress").upsert({ id: user.uid + "_" + id, uid: user.uid, assignment_id: id, status, note, updated_at: new Date().toISOString() }, { onConflict: "uid,assignment_id" });
    if (error) throw error;
  }
}
