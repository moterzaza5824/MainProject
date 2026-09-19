import { supabase } from "./supabase-client";

export async function listPublishedPosts() {
  return supabase.from("posts").select("*").eq("status", "published").limit(15);
}
