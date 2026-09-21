import type { Repository, UserRow } from "../types/models";
import { requireAdmin } from "../guards/admin.guard";
import { mountShell } from "../ui/shell";
import type { RouteName } from "../utils/routes";
export function mountAdminLayout(user: UserRow, active: RouteName, repo: Repository): HTMLElement {
  if (!requireAdmin(user)) throw new Error("คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแล");
  return mountShell(user, active, repo);
}
