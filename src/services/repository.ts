import type { Repository } from "../types/models";

let selected: Promise<Repository> | undefined;

export function getRepository(): Promise<Repository> {
  const mode = import.meta.env.VITE_DATA_MODE;
  if (mode !== "demo" && mode !== "supabase") {
    return Promise.reject(new Error("ยังไม่ได้ตั้งค่า VITE_DATA_MODE เป็น demo หรือ supabase"));
  }

  selected ??= mode === "supabase"
    ? import("./supabase-repository").then(({ SupabaseRepository }) => new SupabaseRepository())
    : import("./demo-repository").then(({ DemoRepository }) => new DemoRepository());
  return selected;
}
