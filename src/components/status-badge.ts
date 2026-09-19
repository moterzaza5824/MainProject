import type { TaskStatus } from "../types/task-progress";

export function statusBadge(status: TaskStatus): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${status.toLowerCase()}`;
  badge.textContent = status;
  return badge;
}
