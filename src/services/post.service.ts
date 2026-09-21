import { getRepository } from "./repository";
import type { PostQuery } from "../types/models";
export async function listPublishedPosts(query: Omit<PostQuery, "status"> = {}) {
  return (await getRepository()).listPosts({ ...query, status: "published" });
}
