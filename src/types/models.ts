export type Role = "student" | "admin";
export type Section = "ALL" | "1" | "2";
export type TaskStatus = "TODO" | "DOING" | "DONE";
export type PostCategory = "official" | "general";
export type PostStatus = "published" | "pending" | "rejected";
export interface UserRow {
  uid: string; email: string; student_id: string; full_name: string; role: Role;
  created_at: string; updated_at: string;
}
export interface Attachment { name: string; url: string }
export interface PostRow {
  post_id: string; author_id: string; author_name: string; title: string; content: string;
  category: PostCategory; status: PostStatus; is_pinned: boolean;
  target_scope: "ALL" | "SPECIFIC"; target_sections: number[]; attachments: Attachment[];
  approved_by?: string | null; created_at: string; updated_at: string;
}
export interface AssignmentRow {
  assignment_id: string; created_by: string; subject_name: string; title: string;
  description: string; submission_channel: string; schedule_mode: "UNIFIED" | "SPLIT";
  due_dates: { all?: string; sec_1?: string; sec_2?: string };
  resources: string[]; created_at: string; updated_at: string;
}
export interface ProgressRow {
  id: string; uid: string; assignment_id: string; status: TaskStatus; note?: string; updated_at: string;
}
export type PostInput = Pick<PostRow, "title" | "content" | "category" | "target_scope" | "target_sections" | "attachments" | "is_pinned">;
export type AssignmentInput = Pick<AssignmentRow, "subject_name" | "title" | "description" | "submission_channel" | "schedule_mode" | "due_dates" | "resources">;
export interface Snapshot { users: UserRow[]; posts: PostRow[]; assignments: AssignmentRow[]; progress: ProgressRow[]; post_counts?: { pending: number; published: number } }
export interface PostQuery { category?: PostCategory; section?: Section; own?: boolean; status?: PostStatus; processed?: boolean; page?: number; pageSize?: number }
export interface PostPage { rows: PostRow[]; total: number }
export interface Repository {
  mode: "demo" | "supabase";
  currentUser(): Promise<UserRow | null>;
  signIn(role?: Role): Promise<void>;
  signInWithPassword(username: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  listPosts(query: PostQuery): Promise<PostPage>;
  getPost(id: string): Promise<PostRow | null>;
  getReviewerName(uid: string): Promise<string | null>;
  savePost(input: PostInput, id?: string): Promise<PostRow>;
  reviewPost(id: string, action: "approve" | "reject" | "general"): Promise<void>;
  pinPost(id: string, pinned: boolean): Promise<void>;
  deletePost(id: string): Promise<void>;
  saveAssignment(input: AssignmentInput, id?: string): Promise<AssignmentRow>;
  deleteAssignment(id: string): Promise<void>;
  saveProgress(id: string, status: TaskStatus, note: string): Promise<void>;
}
