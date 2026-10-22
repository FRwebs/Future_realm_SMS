import { prisma } from "../../../../src/lib/db/prisma";
import { schoolModules } from "../../../../src/lib/modules/school-modules";

/**
 * Which of a school's sixteen modules the platform has switched off.
 *
 * The Back Office has two switches — Settings → module availability (every school) and a school's own feature flags — and both
 * are written against the platform's module keys. The School Admin is built from its sixteen modules, so this maps one onto the
 * other. A module with no row here is core (the command centre, configuration, staff, billing, approvals, audit, sync/support):
 * switching those off would lock a school out of the very pages it needs to get back in, so they cannot be switched off.
 */

export const PLATFORM_KEYS_BY_MODULE: Record<string, string[]> = {
  "class-timetable": ["classes", "subjects", "timetable"],
  attendance: ["attendance"],
  "score-entry-results": ["results"],
  "report-cards": ["report_cards"],
  "student-records": ["students"],
  "parents-guardians": ["parents"],
  "fee-management": ["fees"],
  "communication-center": ["messaging", "announcements"],
  "analytics-reports": ["analytics"]
};

/** The API areas that belong to each switchable module, so a switched-off module is closed at the door and not only hidden. */
export const API_PREFIXES_BY_MODULE: Array<[string, string]> = [
  ["/api/v1/attendance-management", "attendance"],
  ["/api/v1/attendance", "attendance"],
  ["/api/v1/score-results", "score-entry-results"],
  ["/api/v1/report-cards", "report-cards"],
  ["/api/v1/student-records", "student-records"],
  ["/api/v1/parents-guardians", "parents-guardians"],
  ["/api/v1/fee-management", "fee-management"],
  ["/api/v1/communication-center", "communication-center"],
  ["/api/v1/analytics-reports", "analytics-reports"],
  ["/api/v1/class-structure", "class-timetable"],
  ["/api/v1/timetable", "class-timetable"],
  // A teacher reaches the same modules through their own endpoints. Those close with the module they belong to, or switching a module off
  // would hide it from the sidebar and leave the teacher's door open.
  ["/api/v1/teacher-workspace/registers", "attendance"],
  ["/api/v1/teacher-workspace/register-history", "attendance"],
  ["/api/v1/teacher-workspace/period-registers", "attendance"],
  ["/api/v1/teacher-workspace/sheets", "score-entry-results"],
  ["/api/v1/teacher-workspace/results", "score-entry-results"],
  ["/api/v1/teacher-workspace/oversight", "score-entry-results"],
  ["/api/v1/teacher-workspace/observations", "score-entry-results"],
  ["/api/v1/teacher-workspace/remarks", "report-cards"],
  ["/api/v1/teacher-workspace/students", "student-records"],
  ["/api/v1/teacher-workspace/incidents", "student-records"],
  ["/api/v1/teacher-workspace/concerns", "student-records"],
  ["/api/v1/teacher-workspace/record-changes", "student-records"],
  ["/api/v1/teacher-workspace/guardians", "parents-guardians"],
  ["/api/v1/teacher-workspace/submissions", "parents-guardians"],
  ["/api/v1/teacher-workspace/messages", "communication-center"],
  ["/api/v1/teacher-workspace/timetable", "class-timetable"],
  ["/api/v1/teacher-workspace/teaching", "class-timetable"]
];

export type SwitchedOff = { slug: string; name: string; scope: "platform" | "school"; reason: string };

const TTL_MS = 20_000;
const cache = new Map<string, { at: number; off: SwitchedOff[] }>();

const asRecord = (value: unknown): Record<string, boolean> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"))
    : {};

/** Called when either switch is changed, so a module is not held on or off for the length of the cache. */
export const forgetAvailability = (schoolId?: string) => (schoolId ? cache.delete(schoolId) : cache.clear());

export async function switchedOffModules(schoolId: string): Promise<SwitchedOff[]> {
  const hit = cache.get(schoolId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.off;
  const [settings, school] = await Promise.all([
    prisma.platformSetting.findFirst({ select: { globalModuleAvailability: true }, orderBy: { createdAt: "asc" } }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { featureFlags: true } })
  ]);
  const global = asRecord(settings?.globalModuleAvailability);
  const own = asRecord(school?.featureFlags);
  const off: SwitchedOff[] = [];
  for (const [slug, keys] of Object.entries(PLATFORM_KEYS_BY_MODULE)) {
    const name = schoolModules.find((module) => module.slug === slug)?.name ?? slug;
    if (keys.every((key) => global[key] === false)) off.push({ slug, name, scope: "platform", reason: `${name} is switched off for every school on FutureRealm for now.` });
    else if (keys.every((key) => own[key] === false)) off.push({ slug, name, scope: "school", reason: `${name} is switched off for this school by FutureRealm.` });
  }
  cache.set(schoolId, { at: Date.now(), off });
  return off;
}

/** Strips the permissions of switched-off modules, so the sidebar, the pages and every permission-guarded route agree. */
export async function withoutSwitchedOff(schoolId: string, permissions: string[]): Promise<string[]> {
  const off = await switchedOffModules(schoolId);
  if (!off.length) return permissions;
  const prefixes = off.map((module) => `${module.slug}.`);
  return permissions.filter((key) => !prefixes.some((prefix) => key.startsWith(prefix)));
}
