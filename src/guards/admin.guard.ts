import type { UserRow } from "../types/models";
export function requireAdmin(user: UserRow): boolean { return user.role === "admin"; }
