// Supabase is initialized lazily by SupabaseRepository only in live mode.
// Never put a service_role key in a browser bundle.
export { SupabaseRepository } from "./supabase-repository";
