const STUDENT_EMAIL = /^68[0-9]{6}@up\.ac\.th$/i;

export function isAllowedStudentEmail(email: string): boolean {
  return STUDENT_EMAIL.test(email);
}
