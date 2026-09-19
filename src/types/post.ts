export type PostCategory = "official" | "general";
export type PostStatus = "pending" | "published" | "rejected";
export interface Post { id: string; title: string; content: string; category: PostCategory; status: PostStatus; targetScope: "ALL" | "SEC_1" | "SEC_2"; }
