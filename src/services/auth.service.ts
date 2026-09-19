import { supabase } from "./supabase-client";

export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({ provider: "google" });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
