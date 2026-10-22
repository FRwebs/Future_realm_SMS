import type { Role } from "@/lib/domain/types";
import { schoolModules, schoolPermissionKey, templateTabSlugs } from "@/lib/modules/school-modules";

/**
 * The teaching workspace.
 *
 * A teacher opens the same modules an administrator does, rendered for the person who does the work rather than the person who
 * reviews it: a flat rail ordered by how often it is used, the teacher's own words for each module, and a subset of the
 * administrator's tabs — never a tab that does not exist there. A module a person cannot open is absent from the rail, never
 * greyed. Which modules those are is decided by the permission grid, exactly as for everyone else, so an administrator who gives a
 * teacher more simply sees it appear.
 *
 * Which persona a person is comes from their real assignments (see the teacher-workspace API), not from a switch: a form master of
 * an arm, a subject teacher of subject-arms, a head of department, an early-years class teacher, a teaching assistant, or cover.
 */

export type TeachingPersona =
  | "form-master"
  | "head-of-department"
  | "subject-teacher"
  | "early-years"
  | "teaching-assistant"
  | "cover";

/** The roles that open the teaching workspace instead of the administrator's. */
const teachingRoles = new Set<string>(["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT", "TEACHING_ASSISTANT", "COVER_TEACHER"]);

export const isTeachingRole = (role: Role | string) => teachingRoles.has(role);

export const personaLabels: Record<TeachingPersona, string> = {
  "form-master": "Form Master",
  "head-of-department": "Head of Department",
  "subject-teacher": "Subject Teacher",
  "early-years": "Early Years Teacher",
  "teaching-assistant": "Teaching Assistant",
  cover: "Cover / Substitute",
};

/** The permission template a persona starts from. An early-years teacher is a form master of an early-years arm. */
export const personaTemplate: Record<TeachingPersona, string> = {
  "form-master": "Form Master",
  "head-of-department": "Head of Department",
  "subject-teacher": "Subject Teacher",
  "early-years": "Form Master",
  "teaching-assistant": "Teaching Assistant",
  cover: "Cover / Substitute",
};

type TeacherModule = {
  code: string;
  /** The label in the teacher's rail. */
  label: string;
  /** Replaces `label` for an early-years teacher. */
  earlyYearsLabel?: string;
  /** What the module is for, in the teacher's words. */
  description: string;
  hodDescription?: string;
  earlyYearsDescription?: string;
  /** SVG path for the rail icon, drawn on a 24px grid. */
  icon: string;
  /** The order the teacher meets the tabs in. Tabs not named here follow, in the administrator's order. */
  tabOrder: string[];
};

/** In order of how often a teacher reaches for them — not module number. */
export const teacherModules: TeacherModule[] = [
  { code: "m1", label: "My Day", description: "What you owe, and by when.", icon: "M3 12h4l2.5-6 4 12 2.5-6h5", tabOrder: ["today", "oversight"] },
  { code: "m3", label: "Timetable", description: "Your periods, your rooms, your arms.", icon: "M4 5h16v15H4zM4 9.5h16M9 9.5V20M14.5 9.5V20", tabOrder: ["timetable", "teaching"] },
  { code: "m17", label: "Lesson Notes", description: "Your scheme of work and your notes. Plan the term once, then teach from it every week.", icon: "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5", tabOrder: ["curriculum", "notes", "review", "coverage"] },
  { code: "m8", label: "My Students", description: "The children you are answerable for.", icon: "M12 4 3.5 8 12 12l8.5-4zM6 10.5v4.8c0 1.7 2.7 3.2 6 3.2s6-1.5 6-3.2v-4.8", tabOrder: ["registry"] },
  { code: "m4", label: "Attendance", description: "Your registers — marked in under a minute, online or not.", icon: "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5", tabOrder: ["mark", "register", "compliance"] },
  {
    code: "m5", label: "Scores", earlyYearsLabel: "Observations", description: "Enter, submit, and see every number explained.", hodDescription: "Your sheets, and your department’s.", earlyYearsDescription: "What you saw, in words — never a score.",
    icon: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3", tabOrder: ["enter", "review", "results"],
  },
  { code: "m6", label: "Report Cards", description: "The sentence a family reads most carefully.", icon: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4M9 12.5h6M9 16h4", tabOrder: ["remarks", "completion", "archive"] },
  { code: "m9", label: "Guardians", description: "A number to call, and what families send in.", icon: "M12 20.5s-7.5-4.3-7.5-9.3a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5-7.5 9.3-7.5 9.3z", tabOrder: ["guardians", "submissions"] },
  { code: "m12", label: "Messages", description: "Reach your class’s families, with the cost shown first.", icon: "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5", tabOrder: ["compose", "sent"] },
  { code: "m13", label: "Approvals", description: "Decisions routed to you, and what you have raised.", icon: "m4.5 12.5 4.5 4.5 9-10M4.5 19.5h15", tabOrder: ["queue"] },
  { code: "m19", label: "Training", description: "Courses that fit your work, and certificates your school recognises.", icon: "M12 4 2.5 8.5 12 13l9.5-4.5zM6 10.8v4.4c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.4M21.5 8.5v5", tabOrder: ["for-you", "catalogue", "certificates"] },
  { code: "m18", label: "My Employment", description: "Leave, your assignments, appraisal and payslips.", icon: "M3.5 8.5h17V19h-17zM9 8.5V6.2a1.7 1.7 0 0 1 1.7-1.7h2.6A1.7 1.7 0 0 1 15 6.2v2.3M3.5 13h17", tabOrder: ["leave", "my-assignments", "appraisal", "payslips"] },
  { code: "m2", label: "School Calendar", description: "Term dates, windows and the days the school is closed.", icon: "M4 5.5h16V20H4zM8 3v4M16 3v4M4 10h16", tabOrder: ["calendar"] },
  { code: "m16", label: "Sync & Support", description: "Is my work saved, and how do I get help.", icon: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3M19.7 19.5v-4.3h-4.3", tabOrder: ["sync", "help-support"] },
];

export const teacherModuleByCode = Object.fromEntries(teacherModules.map((module) => [module.code, module])) as Record<string, TeacherModule>;

const adminModuleByCode = (code: string) => schoolModules.find((module) => module.code === code);

export function teacherModuleLabel(code: string, persona: TeachingPersona) {
  const module = teacherModuleByCode[code];
  if (!module) return undefined;
  return persona === "early-years" && module.earlyYearsLabel ? module.earlyYearsLabel : module.label;
}

export function teacherModuleDescription(code: string, persona: TeachingPersona) {
  const module = teacherModuleByCode[code];
  if (!module) return undefined;
  if (persona === "early-years" && module.earlyYearsDescription) return module.earlyYearsDescription;
  if (persona === "head-of-department" && module.hodDescription) return module.hodDescription;
  return module.description;
}

/** The tab slugs of a module in the teacher's order: the teacher's own tabs first, then whatever more the administrator added. */
export function orderTeacherTabs(code: string, slugs: string[]): string[] {
  const order = teacherModuleByCode[code]?.tabOrder ?? [];
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : 99);
  return [...slugs].sort((a, b) => rank(a) - rank(b));
}

/** The tabs a teaching persona starts with in a module — the template's own grant, in the teacher's order. */
export function defaultTeacherTabs(code: string, persona: TeachingPersona): string[] {
  const own = templateTabSlugs(personaTemplate[persona], code);
  const all = adminModuleByCode(code)?.tabs.map((tab) => tab.slug) ?? [];
  return orderTeacherTabs(code, own ?? all);
}

export type TeacherRailView = {
  items: Array<{ id: string; href: string; label: string; iconPath: string; code: string }>;
  extra: Array<{ id: string; href: string; label: string; code: string }>;
};

/**
 * The rail for a teaching person: the teacher modules their permissions reach, in the teacher's order, then — after a divider — any
 * module an administrator has granted them beyond that, under its own name. A module with none of its tabs viewable is absent.
 */
export function teacherNavigation(persona: TeachingPersona, permissions: string[]): TeacherRailView {
  const held = new Set(permissions);
  const canView = (slug: string, tab: string) => held.has(schoolPermissionKey(slug, tab, "View"));
  const items: TeacherRailView["items"] = [];
  for (const module of teacherModules) {
    const admin = adminModuleByCode(module.code);
    if (!admin) continue;
    const tabs = orderTeacherTabs(module.code, admin.tabs.filter((tab) => canView(admin.slug, tab.slug)).map((tab) => tab.slug));
    if (!tabs.length) continue;
    items.push({ id: `t_${module.code}`, href: `/${admin.slug}/${tabs[0]}`, label: teacherModuleLabel(module.code, persona) ?? module.label, iconPath: module.icon, code: module.code });
  }
  const extra: TeacherRailView["extra"] = [];
  for (const admin of schoolModules) {
    if (teacherModuleByCode[admin.code]) continue;
    const tab = admin.tabs.find((candidate) => canView(admin.slug, candidate.slug));
    if (tab) extra.push({ id: `x_${admin.code}`, href: `/${admin.slug}/${tab.slug}`, label: admin.name, code: admin.code });
  }
  return { items, extra };
}
