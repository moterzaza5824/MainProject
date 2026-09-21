import { getRepository } from "./repository";
import type { TaskStatus } from "../types/models";
export async function updateTaskProgress(assignmentId: string, status: TaskStatus, note = "") { return (await getRepository()).saveProgress(assignmentId, status, note); }
