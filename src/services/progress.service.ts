import { supabase } from "./supabase-client";
import type { TaskStatus } from "../types/task-progress";

export async function updateTaskProgress(assignmentId: string, status: TaskStatus) {
  return supabase.from("user_task_progress").upsert({ assignment_id: assignmentId, status });
}
