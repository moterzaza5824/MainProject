import type { EnrollmentRow, MasterCatalog, Repository, Snapshot, UserRow } from "../types/models";
export interface Context { root: HTMLElement; repo: Repository; user: UserRow; data: Snapshot; catalog?: MasterCatalog; enrollments?: EnrollmentRow[]; reviewerName?: string | null; refresh(): Promise<void> }
