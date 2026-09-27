export const COHORT_EMAIL_PATTERN = /^6802[0-9]{4}@up\.ac\.th$/i;

export function isEligibleCohortEmail(email: string | null | undefined): boolean {
  return COHORT_EMAIL_PATTERN.test(email?.trim() ?? "");
}
