/**
 * Canonical School Admin module spec.
 *
 * Generated from the "School Admin" mockup (design mock up html/School Admin.html):
 * sixteen modules in seven sidebar sections, tabs inside each module, and the
 * permission grid every staff role is filtered through. This file is the single
 * source of truth — navigation, routing and permissions all derive from it.
 */

export type SchoolModuleAction = (typeof schoolModuleActions)[number];

/** The six things a person can do inside any tab — the same six everywhere. */
export const schoolModuleActions = ["View", "Create", "Edit", "Approve", "Export", "Delete"] as const;

/** 0 absent · 1 view · 2 work · 3 full */
export const schoolAccessLevels = ["No access", "View only", "Can work", "Full"] as const;

export type SchoolAccessLevel = 0 | 1 | 2 | 3;

export type SchoolModuleSection =
  | "Overview"
  | "Academic Operations"
  | "People"
  | "Finance"
  | "Engagement & Control"
  | "Intelligence"
  | "System";

export type SchoolModuleTab = {
  slug: string;
  label: string;
};

export type SchoolModule = {
  /** Stable mockup code (m1–m16). */
  code: string;
  slug: string;
  name: string;
  description: string;
  section: SchoolModuleSection;
  icon: string;
  /** Sample badge count carried over from the mockup. */
  badge: number;
  /** Mockup's "needs attention" dot. */
  dot: boolean;
  tabs: SchoolModuleTab[];
};

export const schoolModuleSections: SchoolModuleSection[] = [
  "Overview",
  "Academic Operations",
  "People",
  "Finance",
  "Engagement & Control",
  "Intelligence",
  "System",
];

export const schoolModules: SchoolModule[] = [
  {
    code: "m1",
    slug: "command-center",
    name: "Command Center",
    description: "What needs you today, and what the school owes.",
    section: "Overview",
    icon: "Activity",
    badge: 3,
    dot: false,
    tabs: [
      { slug: "today", label: "Today" },
      { slug: "oversight", label: "Oversight" },
    ],
  },
  {
    code: "m2",
    slug: "school-configuration",
    name: "School Configuration",
    description: "How this school works, set once.",
    section: "Academic Operations",
    icon: "Settings2",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "profile", label: "Profile" },
      { slug: "calendar", label: "Calendar" },
      { slug: "curriculum", label: "Curriculum" },
      { slug: "allocations", label: "Allocations" },
      { slug: "policies", label: "Policies" },
    ],
  },
  {
    code: "m3",
    slug: "class-timetable",
    name: "Class & Timetable",
    description: "Classes, subjects, teachers, periods — and what is uncovered.",
    section: "Academic Operations",
    icon: "LayoutGrid",
    badge: 0,
    dot: true,
    tabs: [
      { slug: "classes", label: "Classes" },
      { slug: "subjects", label: "Subjects" },
      { slug: "teaching", label: "Teaching" },
      { slug: "timetable", label: "Timetable" },
      { slug: "coverage", label: "Coverage" },
    ],
  },
  {
    code: "m4",
    slug: "attendance",
    name: "Attendance",
    description: "The school’s day, arm by arm.",
    section: "Academic Operations",
    icon: "ClipboardCheck",
    badge: 2,
    dot: false,
    tabs: [
      { slug: "register", label: "Register" },
      { slug: "mark", label: "Mark" },
      { slug: "compliance", label: "Compliance" },
      { slug: "log", label: "Log" },
    ],
  },
  {
    code: "m5",
    slug: "score-entry-results",
    name: "Score Entry & Results",
    description: "Every arm’s submission, and every number explained.",
    section: "Academic Operations",
    icon: "FileText",
    badge: 7,
    dot: false,
    tabs: [
      { slug: "review", label: "Review" },
      { slug: "enter", label: "Enter" },
      { slug: "results", label: "Results" },
    ],
  },
  {
    code: "m6",
    slug: "report-cards",
    name: "Report Cards",
    description: "The document a school is judged on, and which are done.",
    section: "Academic Operations",
    icon: "Award",
    badge: 4,
    dot: false,
    tabs: [
      { slug: "remarks", label: "Remarks" },
      { slug: "completion", label: "Completion" },
      { slug: "archive", label: "Archive" },
    ],
  },
  {
    code: "m7",
    slug: "staff-access",
    name: "Staff & Access",
    description: "Give each person exactly the access they need — and see what each has done.",
    section: "People",
    icon: "Users",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "directory", label: "Directory" },
      { slug: "permissions", label: "Permissions" },
      { slug: "payroll", label: "Payroll" },
      { slug: "leave", label: "Leave" },
      { slug: "appraisal", label: "Appraisal" },
      { slug: "activity", label: "Activity" },
    ],
  },
  {
    code: "m8",
    slug: "student-records",
    name: "Student Records",
    description: "The authoritative record of every student.",
    section: "People",
    icon: "GraduationCap",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "registry", label: "Registry" },
      { slug: "admissions", label: "Admissions" },
      { slug: "changes", label: "Changes" },
    ],
  },
  {
    code: "m9",
    slug: "parents-guardians",
    name: "Parents & Guardians",
    description: "The families, and everything they send in.",
    section: "People",
    icon: "Handshake",
    badge: 5,
    dot: false,
    tabs: [
      { slug: "guardians", label: "Guardians" },
      { slug: "submissions", label: "Submissions" },
      { slug: "consent", label: "Consent" },
    ],
  },
  {
    code: "m10",
    slug: "fee-management",
    name: "Fee Management",
    description: "What is owed, what came in, who still owes.",
    section: "Finance",
    icon: "CreditCard",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "collections", label: "Collections" },
      { slug: "structures", label: "Structures" },
      { slug: "review", label: "Review" },
      { slug: "history", label: "History" },
    ],
  },
  {
    code: "m11",
    slug: "subscription-billing",
    name: "Subscription & Billing",
    description: "What this costs, and where the account stands.",
    section: "Finance",
    icon: "Package",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "plan", label: "Plan" },
      { slug: "credits", label: "Credits" },
      { slug: "account", label: "Account" },
    ],
  },
  {
    code: "m12",
    slug: "communication-center",
    name: "Communication Center",
    description: "Reach families, with the cost shown first.",
    section: "Engagement & Control",
    icon: "MessageSquareText",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "compose", label: "Compose" },
      { slug: "sent", label: "Sent" },
      { slug: "automation", label: "Automation" },
    ],
  },
  {
    code: "m13",
    slug: "approvals-workflow",
    name: "Approvals & Workflow",
    description: "Every decision waiting on anyone, in one place.",
    section: "Engagement & Control",
    icon: "ListChecks",
    badge: 9,
    dot: false,
    tabs: [
      { slug: "queue", label: "Queue" },
      { slug: "workflow", label: "Workflow" },
      { slug: "performance", label: "Performance" },
    ],
  },
  {
    code: "m14",
    slug: "analytics-reports",
    name: "Analytics & Reports",
    description: "The school’s data, as decisions and as evidence.",
    section: "Intelligence",
    icon: "BarChart3",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "insights", label: "Insights" },
      { slug: "reports", label: "Reports" },
      { slug: "compliance", label: "Compliance" },
    ],
  },
  {
    code: "m15",
    slug: "audit-security",
    name: "Audit & Security",
    description: "Show what happened, who did it, and prove both.",
    section: "Intelligence",
    icon: "ShieldCheck",
    badge: 0,
    dot: true,
    tabs: [
      { slug: "audit-log", label: "Audit Log" },
      { slug: "monitoring", label: "Monitoring" },
      { slug: "data-protection", label: "Data Protection" },
    ],
  },
  {
    code: "m16",
    slug: "sync-support",
    name: "Sync & Support",
    description: "Is my work saved, and how do I get help.",
    section: "System",
    icon: "LifeBuoy",
    badge: 0,
    dot: false,
    tabs: [
      { slug: "sync", label: "Sync" },
      { slug: "help-support", label: "Help & Support" },
    ],
  },
];

export type SchoolRoleTemplate = {
  name: string;
  dataScope: string;
  canApprove: string;
};

/**
 * The starting point for a new account.
 *
 * Headcount and module reach are deliberately absent: the mockup carries stale
 * literals for both (it claims Exam Officer reaches 9 modules where its own grid
 * grants 11) and never renders them — it derives people from staff records and
 * reach from the permission grid. Use `schoolTemplateReach` for the latter.
 */
export const schoolRoleTemplates: SchoolRoleTemplate[] = [
  {
    name: "Proprietor",
    dataScope: "The whole school, every campus",
    canApprove: "Everything",
  },
  {
    name: "Principal",
    dataScope: "The whole school",
    canApprove: "Everything",
  },
  {
    name: "Exam Officer",
    dataScope: "Every arm, results only",
    canApprove: "Score sheets and cards",
  },
  {
    name: "Bursar",
    dataScope: "The whole school, money only",
    canApprove: "Payments and waivers",
  },
  {
    name: "Registrar",
    dataScope: "Every student record",
    canApprove: "Record changes",
  },
  {
    name: "Head of Department",
    dataScope: "Their department",
    canApprove: "Score sheets",
  },
  {
    name: "Form Master",
    dataScope: "Their form class and subject-arms",
    canApprove: "Nothing",
  },
  {
    name: "Subject Teacher",
    dataScope: "Their own subject-arms only",
    canApprove: "Nothing",
  },
  {
    name: "School Nurse",
    dataScope: "Health records only",
    canApprove: "Nothing",
  },
  {
    name: "Counsellor",
    dataScope: "Guidance records only",
    canApprove: "Nothing",
  },
  {
    name: "ICT Officer",
    dataScope: "No student data",
    canApprove: "Nothing",
  },
];

/**
 * What each role template grants, module by module.
 * A module absent from a template's record falls through to full access —
 * which is how Proprietor and Principal are expressed.
 */
export const schoolRoleModuleLevels: Record<string, Partial<Record<string, SchoolAccessLevel>>> = {
  "Proprietor": {},
  "Principal": {
    m15: 2,
  },
  "Exam Officer": {
    m1: 2,
    m2: 1,
    m3: 1,
    m4: 1,
    m5: 3,
    m6: 3,
    m7: 0,
    m8: 1,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 2,
    m13: 2,
    m14: 1,
    m15: 0,
    m16: 1,
  },
  "Bursar": {
    m1: 2,
    m2: 1,
    m3: 0,
    m4: 0,
    m5: 0,
    m6: 0,
    m7: 0,
    m8: 1,
    m9: 1,
    m10: 3,
    m11: 2,
    m12: 2,
    m13: 2,
    m14: 1,
    m15: 0,
    m16: 1,
  },
  "Registrar": {
    m1: 2,
    m2: 1,
    m3: 1,
    m4: 1,
    m5: 0,
    m6: 1,
    m7: 0,
    m8: 3,
    m9: 3,
    m10: 1,
    m11: 0,
    m12: 2,
    m13: 1,
    m14: 1,
    m15: 0,
    m16: 1,
  },
  "Head of Department": {
    m1: 2,
    m2: 1,
    m3: 2,
    m4: 1,
    m5: 3,
    m6: 1,
    m7: 0,
    m8: 1,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 2,
    m13: 2,
    m14: 1,
    m15: 0,
    m16: 1,
  },
  "Form Master": {
    m1: 2,
    m2: 1,
    m3: 1,
    m4: 3,
    m5: 2,
    m6: 2,
    m7: 0,
    m8: 1,
    m9: 2,
    m10: 1,
    m11: 0,
    m12: 2,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 1,
  },
  "Subject Teacher": {
    m1: 2,
    m2: 1,
    m3: 1,
    m4: 2,
    m5: 2,
    m6: 1,
    m7: 0,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 1,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 1,
  },
  "School Nurse": {
    m1: 2,
    m2: 0,
    m3: 0,
    m4: 1,
    m5: 0,
    m6: 0,
    m7: 0,
    m8: 1,
    m9: 1,
    m10: 0,
    m11: 0,
    m12: 1,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 1,
  },
  "Counsellor": {
    m1: 2,
    m2: 0,
    m3: 0,
    m4: 1,
    m5: 1,
    m6: 0,
    m7: 0,
    m8: 1,
    m9: 1,
    m10: 0,
    m11: 0,
    m12: 1,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 1,
  },
  "ICT Officer": {
    m1: 1,
    m2: 1,
    m3: 0,
    m4: 0,
    m5: 0,
    m6: 0,
    m7: 1,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 0,
    m13: 0,
    m14: 0,
    m15: 1,
    m16: 3,
  },
};

const leaderRoles = /^(Proprietor|Principal)$/;
const exportingRoles = /^(Bursar|Registrar|Exam Officer)$/;

/** Modules whose Approve action a template's "can approve" sentence can unlock. */
const approvalMatchers: Array<[string, RegExp]> = [
  ["m5", /Score|Everything/i],
  ["m6", /card|Everything/i],
  ["m8", /Record|Everything/i],
  ["m10", /Payment|Waiver|Everything/i],
];

export const schoolModulesByCode: Record<string, SchoolModule> = Object.fromEntries(
  schoolModules.map((module) => [module.code, module]),
);

export const schoolModulesBySlug: Record<string, SchoolModule> = Object.fromEntries(
  schoolModules.map((module) => [module.slug, module]),
);

export function getSchoolModule(slug: string): SchoolModule | undefined {
  return schoolModulesBySlug[slug];
}

export function getSchoolModuleTab(
  module: SchoolModule,
  tabSlug?: string,
): SchoolModuleTab | undefined {
  if (!tabSlug) return module.tabs[0];
  return module.tabs.find((tab) => tab.slug === tabSlug);
}

/** `/attendance/register` — the canonical path for a module tab. */
export function schoolModulePath(module: SchoolModule, tab?: SchoolModuleTab): string {
  return `/${module.slug}/${(tab ?? module.tabs[0]).slug}`;
}

/**
 * The permission key for one action inside one tab, e.g. `attendance.register.view`.
 * Every school permission in the catalog is one of these.
 */
export function schoolPermissionKey(
  moduleSlug: string,
  tabSlug: string,
  action: SchoolModuleAction,
): string {
  return `${moduleSlug}.${tabSlug}.${action.toLowerCase()}`;
}

/** Every permission key the sixteen modules define. */
export function allSchoolPermissionKeys(): string[] {
  return schoolModules.flatMap((module) =>
    module.tabs.flatMap((tab) =>
      schoolModuleActions.map((action) => schoolPermissionKey(module.slug, tab.slug, action)),
    ),
  );
}

/**
 * The access level a role template holds in a module.
 * An unlisted module means full access, which is how Proprietor is expressed.
 */
export function schoolModuleLevel(roleTemplate: string, moduleCode: string): SchoolAccessLevel {
  const template = schoolRoleModuleLevels[roleTemplate];
  if (!template) return 3;
  return template[moduleCode] ?? 3;
}

/**
 * Which of the six actions a level allows.
 * Approval and deletion are never implied by "full" — they are decided per person,
 * so both are gated on the holder rather than on the level alone.
 */
export function schoolModuleActionsFor(
  roleTemplate: string,
  moduleCode: string,
  level: SchoolAccessLevel = schoolModuleLevel(roleTemplate, moduleCode),
): Record<SchoolModuleAction, boolean> {
  const canApprove = schoolRoleTemplates.find((template) => template.name === roleTemplate)?.canApprove ?? "Nothing";
  const leader = leaderRoles.test(roleTemplate);
  const view = level >= 1;
  const work = level >= 2;
  const full = level >= 3;

  const approves =
    canApprove !== "Nothing" &&
    (canApprove === "Everything" ||
      moduleCode === "m13" ||
      approvalMatchers.some(([code, matcher]) => code === moduleCode && matcher.test(canApprove)));

  return {
    View: view,
    Create: work,
    Edit: work,
    Approve: approves && view,
    Export: view && (leader || exportingRoles.test(roleTemplate)),
    Delete: full && leader,
  };
}

/** The permission keys a role template holds across every module and tab. */
export function schoolPermissionKeysForRoleTemplate(roleTemplate: string): string[] {
  return schoolModules.flatMap((module) => {
    const actions = schoolModuleActionsFor(roleTemplate, module.code);
    return module.tabs.flatMap((tab) =>
      schoolModuleActions
        .filter((action) => actions[action])
        .map((action) => schoolPermissionKey(module.slug, tab.slug, action)),
    );
  });
}

/** How many of the sixteen modules a template can open at all. */
export function schoolTemplateReach(roleTemplate: string): number {
  return schoolModules.filter((module) => schoolModuleLevel(roleTemplate, module.code) > 0).length;
}
