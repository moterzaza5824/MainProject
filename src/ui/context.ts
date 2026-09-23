import type { EnrollmentRow, Repository, Snapshot, UserRow } from "../types/models";
export interface Context { root: HTMLElement; repo: Repository; user: UserRow; data: Snapshot; enrollments?: EnrollmentRow[]; reviewerName?: string | null; refresh(): Promise<void> }
