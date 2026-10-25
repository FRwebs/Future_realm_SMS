import { prisma } from "../../../../src/lib/db/prisma";

/**
 * What the school has decided about its students' portal, read from the same rows School Configuration → Policies writes — one record,
 * shown there and obeyed here. A setting nobody has chosen is the product's own default.
 */

export const STUDENT_PAGES = ["Results", "Attendance", "Timetable", "Announcements"] as const;
export type StudentVisible = (typeof STUDENT_PAGES)[number];

export type StudentPolicy = {
  /** Which kinds of thing a student may see. */
  sees: Set<StudentVisible>;
  homework: boolean;
  questions: boolean;
  /** Whether a form master reads, read only, the questions their arm puts to other teachers. */
  formMasterReads: boolean;
  quietHours: string;
  calendarLink: boolean;
};

const CODES = ["student_portal_visibility", "student_homework", "student_questions", "student_question_readers", "student_quiet_hours", "student_calendar_link"];

export async function loadStudentPolicy(schoolId: string): Promise<StudentPolicy> {
  const rows = await prisma.configurationItem.findMany({ where: { schoolId, resource: "school-policies", code: { in: CODES }, deletedAt: null }, select: { code: true, data: true } });
  const values = new Map(rows.map((row) => [row.code!, ((row.data as { values?: Record<string, unknown> } | null)?.values ?? {})]));
  const mode = (code: string) => { const found = values.get(code)?.mode; return typeof found === "string" ? found : null; };
  const seesRaw = values.get("student_portal_visibility")?.sees;
  const sees = Array.isArray(seesRaw) ? seesRaw.filter((item): item is StudentVisible => (STUDENT_PAGES as readonly string[]).includes(String(item))) : [...STUDENT_PAGES];
  return {
    sees: new Set(sees),
    homework: !(mode("student_homework") ?? "").startsWith("On paper"),
    questions: !(mode("student_questions") ?? "").startsWith("Students may not"),
    formMasterReads: !(mode("student_question_readers") ?? "").startsWith("Only the teacher"),
    quietHours: mode("student_quiet_hours") ?? "21:00 – 07:00",
    calendarLink: !(mode("student_calendar_link") ?? "").startsWith("Students may not"),
  };
}

/** The student pages a school's visibility choice hides, by page name. */
export const hiddenPages = (policy: StudentPolicy): string[] => [
  ...(policy.sees.has("Results") ? [] : ["results"]),
  ...(policy.sees.has("Attendance") ? [] : ["attendance"]),
  ...(policy.sees.has("Timetable") ? [] : ["timetable"]),
];
