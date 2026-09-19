export type UserRole = "student" | "admin";
export interface UserProfile { id: string; email: string; displayName: string; role: UserRole; }
