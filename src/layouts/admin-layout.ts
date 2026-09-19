import { requireAdmin } from "../guards/admin.guard";
import { mountAppLayout } from "./app-layout";

export async function mountAdminLayout(): Promise<void> {
  await requireAdmin();
  mountAppLayout();
}
