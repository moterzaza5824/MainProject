import type { Repository, Snapshot, UserRow } from "../types/models";
export interface Context { root: HTMLElement; repo: Repository; user: UserRow; data: Snapshot; reviewerName?: string | null; refresh(): Promise<void> }
