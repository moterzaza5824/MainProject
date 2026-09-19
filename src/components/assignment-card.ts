import type { Assignment } from "../types/assignment";

export function assignmentCard(assignment: Assignment): HTMLElement {
  const element = document.createElement("article");
  element.className = "assignment-card";
  element.textContent = assignment.title;
  return element;
}
