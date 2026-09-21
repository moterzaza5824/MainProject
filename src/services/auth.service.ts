import { getRepository } from "./repository";
export async function signInWithPassword(username: string, password: string): Promise<void> { await (await getRepository()).signInWithPassword(username, password); }
export async function signInWithGoogle(): Promise<void> { await (await getRepository()).signInWithGoogle(); }
export async function signOut(): Promise<void> { await (await getRepository()).signOut(); }
