import { supabase } from "./supabase-client";

export async function listAssignments() {
  return supabase.from("assignments").select("*").order("created_at");
}
