import type { Role } from "@/lib/domain/types";

/**
 * The School Admin portal on a phone.
 *
 * The mockup does not redraw the modules for a phone — it is the same sixteen, read through a narrow window. What it does draw is a
 * way around them with a thumb: four tabs chosen for who is holding the phone, and More for the rest. This file is that choice, and
 * the glyphs the bar draws, taken from the mockup's own `NAV`, `M_SHORT` and `M_TABS`.
 */

/** The module each path belongs to, so the bar can tell which tab is being read. */
export const SCHOOL_MODULE_SLUG: Record<string, string> = {
  m1: "command-center", m2: "school-configuration", m3: "class-timetable", m4: "attendance",
  m5: "score-entry-results", m6: "report-cards", m7: "staff-access", m8: "student-records",
  m9: "parents-guardians", m10: "fee-management", m11: "subscription-billing", m12: "communication-center",
  m13: "approvals-workflow", m14: "analytics-reports", m15: "audit-security", m16: "sync-support",
};

/** The name a module goes by in the bar, where a label has a fifth of a phone to fit in. */
export const SCHOOL_PHONE_LABEL: Record<string, string> = {
  m1: "Today", m2: "Setup", m3: "Classes", m4: "Attendance", m5: "Scores", m6: "Reports",
  m7: "Staff", m8: "Students", m9: "Families", m10: "Fees", m11: "Billing", m12: "Messages",
  m13: "Approvals", m14: "Insights", m15: "Audit", m16: "Sync",
};

/** The glyph each module is drawn with, on a 24px grid, exactly as the mockup's rail draws it. */
export const SCHOOL_PHONE_ICON: Record<string, string> = {
  m1: "M3 12h4l2.5-6 4 12 2.5-6h5",
  m2: "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4M12 3.6v2M12 19v2M5.4 7.4l1.7 1M16.9 15.6l1.7 1M5.4 16.6l1.7-1M16.9 8.4l1.7-1",
  m3: "M4 5h16v15H4zM4 9.5h16M9 9.5V20M14.5 9.5V20",
  m4: "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5",
  m5: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3",
  m6: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4M9 12.5h6M9 16h4",
  m7: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20M17.2 11.2a3.2 3.2 0 0 0 0-6.3M21 20v-1.4a3.7 3.7 0 0 0-2.8-3.5",
  m8: "M12 4 3.5 8 12 12l8.5-4zM6 10.5v4.8c0 1.7 2.7 3.2 6 3.2s6-1.5 6-3.2v-4.8",
  m9: "M12 20.5s-7.5-4.3-7.5-9.3a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5-7.5 9.3-7.5 9.3z",
  m10: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.5 9.6h5M9.5 14.4h5M12 6.8v10.4",
  m11: "M2.5 5.5h19v13h-19zM2.5 10h19M6.5 14.5h4",
  m12: "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5",
  m13: "m4.5 12.5 4.5 4.5 9-10M4.5 19.5h15",
  m14: "M3.5 20.5h17M7 20.5v-6M11.6 20.5V8.5M16.2 20.5v-9M20.5 20.5V5.5",
  m15: "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6zm-2.8 8.8 2 2 3.6-3.8",
  m16: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3M19.7 19.5v-4.3h-4.3",
};

/**
 * Which four the bar opens on, by who is holding the phone — the mockup's own `M_TABS`.
 *
 * A bursar and an exam officer do not reach for the same four things in a corridor, and a bar that
 * guessed the same four for both would send one of them through More every time.
 */
const BY_ROLE: Array<{ roles: Role[]; tabs: string[] }> = [
  { roles: ["SCHOOL_OWNER", "PROPRIETOR"], tabs: ["m1", "m10", "m13", "m14"] },
  { roles: ["PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "ADMINISTRATOR", "ADMIN_OFFICER"], tabs: ["m1", "m4", "m13", "m10"] },
  { roles: ["EXAM_OFFICER", "EXAMINATION_OFFICER"], tabs: ["m1", "m5", "m6", "m4"] },
  { roles: ["BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER", "FINANCE_MANAGER"], tabs: ["m1", "m10", "m13", "m12"] },
  { roles: ["CLASS_TEACHER", "SUBJECT_TEACHER", "TEACHER", "HEAD_OF_DEPARTMENT"], tabs: ["m1", "m4", "m5", "m6"] },
];

/** Sync and Billing are never one of the four: Sync is a tap away on the status ribbon, and nobody opens Billing in a corridor. */
const NEVER_A_TAB = new Set(["m16", "m11"]);

/**
 * The four the bar opens on, for this role and what this person can actually reach.
 *
 * The role's own four come first, minus anything their permissions or the school's switched-off modules have taken away; the gap is
 * then filled from what they can reach, in the rail's own order, so the bar is always four and always four things that work.
 */
export function schoolPhoneTabs(role: Role, reachable: string[]): string[] {
  const can = new Set(reachable);
  const preferred = (BY_ROLE.find((entry) => entry.roles.includes(role))?.tabs ?? ["m1", "m4", "m13", "m10"]).filter((code) => can.has(code));
  const tabs = [...preferred];
  for (const code of reachable) {
    if (tabs.length >= 4) break;
    if (!tabs.includes(code) && !NEVER_A_TAB.has(code)) tabs.push(code);
  }
  return tabs.slice(0, 4);
}

/** The module a path belongs to, for working out which tab is lit. */
export const moduleOfPath = (pathname: string): string | null => {
  const first = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const found = Object.entries(SCHOOL_MODULE_SLUG).find(([, slug]) => `/${slug}` === first);
  return found?.[0] ?? null;
};
