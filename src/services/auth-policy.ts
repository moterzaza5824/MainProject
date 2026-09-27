export const COHORT_EMAIL_PATTERN = /^6802[0-9]{4}@up\.ac\.th$/i;
const STUDENT_ID_PATTERN = /^6802[0-9]{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SessionAuthMethod = "password" | "oauth" | "other";

export function isEligibleCohortEmail(email: string | null | undefined): boolean {
  return COHORT_EMAIL_PATTERN.test(email?.trim() ?? "");
}

export function normalizeAdminLoginEmail(identifier: string): string | null {
  const value = identifier.trim().toLowerCase();
  if (STUDENT_ID_PATTERN.test(value)) return `${value}@up.ac.th`;
  return EMAIL_PATTERN.test(value) ? value : null;
}

export function sessionAuthMethod(accessToken: string): SessionAuthMethod {
  try {
    const encoded = accessToken.split(".")[1];
    if (!encoded) return "other";
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), character => character.charCodeAt(0)));
    const claims = JSON.parse(json) as { amr?: { method?: string }[] };
    if (claims.amr?.some(entry => entry.method === "password")) return "password";
    if (claims.amr?.some(entry => entry.method === "oauth")) return "oauth";
  } catch {
    // A missing or malformed claim must fail closed for administrator access.
  }
  return "other";
}
