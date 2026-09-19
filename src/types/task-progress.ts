export type TaskStatus = "TODO" | "DOING" | "DONE";
export interface TaskProgress { userId: string; assignmentId: string; status: TaskStatus; note: string | null; }
