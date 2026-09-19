import type { Post } from "../types/post";

export function postCard(post: Post): HTMLElement {
  const element = document.createElement("article");
  element.className = "post-card";
  element.textContent = post.title;
  return element;
}
