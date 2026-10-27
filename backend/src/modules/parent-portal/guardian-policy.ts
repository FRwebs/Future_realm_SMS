import { ForbiddenException } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";

/**
 * What the school has decided a guardian may see, read from the same row School Configuration → Policies writes — one record, shown there
 * and obeyed here. A school that has never chosen gets the product's own default: everything a guardian has always seen.
 */

export const GUARDIAN_PAGES = ["Results", "Attendance", "Fees", "Announcements", "Timetable", "Report cards"] as const;
export type GuardianVisible = (typeof GUARDIAN_PAGES)[number];

export type GuardianPolicy = { sees: Set<GuardianVisible> };

export async function loadGuardianPolicy(schoolId: string): Promise<GuardianPolicy> {
  const row = await prisma.configurationItem.findFirst({ where: { schoolId, resource: "school-policies", code: "guardian_portal_visibility", deletedAt: null }, select: { data: true } });
  const raw = (row?.data as { values?: { sees?: unknown } } | null)?.values?.sees;
  const sees = Array.isArray(raw) ? raw.filter((item): item is GuardianVisible => (GUARDIAN_PAGES as readonly string[]).includes(String(item))) : [...GUARDIAN_PAGES];
  return { sees: new Set(sees) };
}

/** The guardian pages a school's visibility choice hides, by page name. */
export const hiddenGuardianPages = (policy: GuardianPolicy): string[] => [
  ...(policy.sees.has("Results") ? [] : ["results"]),
  ...(policy.sees.has("Attendance") ? [] : ["attendance"]),
  ...(policy.sees.has("Fees") ? [] : ["fees"]),
  ...(policy.sees.has("Timetable") ? [] : ["timetable"]),
  ...(policy.sees.has("Announcements") ? [] : ["announcements"]),
];

const WORDS: Record<GuardianVisible, string> = { Results: "results", Attendance: "attendance", Fees: "fee details", Announcements: "announcements", Timetable: "the timetable", "Report cards": "report cards" };

/** Refuses with the school's own wording when a guardian reaches for something the school keeps back. */
export async function assertGuardianMaySee(schoolId: string, what: GuardianVisible) {
  if (!(await loadGuardianPolicy(schoolId)).sees.has(what)) throw new ForbiddenException(`Your school has not made ${WORDS[what]} visible to parents.`);
}
