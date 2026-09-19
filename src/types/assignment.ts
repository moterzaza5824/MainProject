export type ScheduleMode = "UNIFIED" | "SPLIT";
export interface Assignment { id: string; subject: string; title: string; description: string; scheduleMode: ScheduleMode; sec1DueAt: string | null; sec2DueAt: string | null; submissionUrl: string; }
