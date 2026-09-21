import type { Repository, UserRow } from "../types/models";
export async function requireSession(repo: Repository): Promise<UserRow | null> { return repo.currentUser(); }
