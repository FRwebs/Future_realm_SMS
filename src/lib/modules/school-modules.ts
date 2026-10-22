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
  /**
   * Set on the modules that belong to the teaching workspace (Lesson Notes, My Employment, Training).
   * They are in the permission grid like any other, so an administrator can grant or take them away,
   * but they start at no access for every template that is not a teaching one.
   */
  workspace?: "teaching";
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
      { slug: "learning", label: "Learning" },
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
      { slug: "integrations", label: "Integrations" },
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
  {
    code: "m17",
    slug: "lesson-notes",
    name: "Lesson Notes",
    description: "Your scheme of work and your notes. Plan the term once, then teach from it every week.",
    section: "Academic Operations",
    icon: "BookOpen",
    badge: 0,
    dot: false,
    workspace: "teaching",
    tabs: [
      { slug: "curriculum", label: "Curriculum" },
      { slug: "notes", label: "Notes" },
      { slug: "review", label: "Review" },
      { slug: "coverage", label: "Coverage" },
    ],
  },
  {
    code: "m18",
    slug: "my-employment",
    name: "My Employment",
    description: "Leave, your assignments, appraisal and payslips.",
    section: "People",
    icon: "UserCircle",
    badge: 0,
    dot: false,
    workspace: "teaching",
    tabs: [
      { slug: "leave", label: "Leave" },
      { slug: "my-assignments", label: "My assignments" },
      { slug: "appraisal", label: "Appraisal" },
      { slug: "payslips", label: "Payslips" },
    ],
  },
  {
    code: "m19",
    slug: "training",
    name: "Training",
    description: "Courses that fit your work, and certificates your school recognises.",
    section: "People",
    icon: "GraduationCap",
    badge: 0,
    dot: false,
    workspace: "teaching",
    tabs: [
      { slug: "for-you", label: "For you" },
      { slug: "catalogue", label: "Catalogue" },
      { slug: "certificates", label: "Certificates" },
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
    name: "Teaching Assistant",
    dataScope: "The class they support: register and class list",
    canApprove: "Nothing",
  },
  {
    name: "Cover / Substitute",
    dataScope: "The classes they cover, until the cover ends",
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
  // Leave, pay and training for a proprietor or principal are handled in Staff & Access; the teaching workspace is not theirs unless granted.
  "Proprietor": {
    m18: 0,
    m19: 0,
  },
  "Principal": {
    m15: 2,
    m18: 0,
    m19: 0,
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
    m17: 0,
    m18: 0,
    m19: 0,
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
    m17: 0,
    m18: 0,
    m19: 0,
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
    m17: 0,
    m18: 0,
    m19: 0,
  },
  "Head of Department": {
    m1: 2,
    m2: 1,
    m3: 2,
    m4: 2,
    m5: 3,
    m6: 2,
    m7: 0,
    m8: 1,
    m9: 2,
    m10: 0,
    m11: 0,
    m12: 2,
    m13: 2,
    m14: 0,
    m15: 0,
    m16: 2,
    m17: 3,
    m18: 2,
    m19: 2,
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
    m10: 0,
    m11: 0,
    m12: 2,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 2,
    m17: 2,
    m18: 2,
    m19: 2,
  },
  "Subject Teacher": {
    m1: 2,
    m2: 1,
    m3: 1,
    m4: 2,
    m5: 2,
    m6: 0,
    m7: 0,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 0,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 2,
    m17: 2,
    m18: 2,
    m19: 2,
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
    m17: 0,
    m18: 0,
    m19: 0,
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
    m17: 0,
    m18: 0,
    m19: 0,
  },
  "Teaching Assistant": {
    m1: 1,
    m2: 1,
    m3: 1,
    m4: 2,
    m5: 0,
    m6: 0,
    m7: 0,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 0,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 2,
    m17: 0,
    m18: 2,
    m19: 2,
  },
  "Cover / Substitute": {
    m1: 1,
    m2: 1,
    m3: 1,
    m4: 2,
    m5: 2,
    m6: 0,
    m7: 0,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 0,
    m13: 0,
    m14: 0,
    m15: 0,
    m16: 2,
    m17: 1,
    m18: 0,
    m19: 2,
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
    m17: 0,
    m18: 0,
    m19: 0,
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


/**
 * The tabs each teaching template opens a module on. A teacher sees a subset of the administrator's tabs — never a tab that does
 * not exist there — so the template grants only these; anything beyond is an administrator's decision, per person, in Staff &
 * Access. A template or module absent here grants every tab, as before.
 */
const teachingModuleTabs = {
  m2: ["calendar"],
  m16: ["sync", "help-support"],
  m18: ["leave", "my-assignments", "appraisal", "payslips"],
  m19: ["for-you", "catalogue", "certificates"],
};
export const teachingTemplateTabs: Record<string, Partial<Record<string, string[]>>> = {
  // The school's leadership signs a head of department's notes and reads coverage across the school — never the teacher's own curriculum.
  "Proprietor": { m17: ["review", "coverage"] },
  "Principal": { m17: ["review", "coverage"] },
  "Form Master": { ...teachingModuleTabs, m1: ["today"], m3: ["timetable", "teaching"], m4: ["mark", "register"], m5: ["enter", "results"], m6: ["remarks", "completion", "archive"], m8: ["registry"], m9: ["guardians", "submissions"], m12: ["compose", "sent"], m17: ["curriculum", "notes"] },
  "Subject Teacher": { ...teachingModuleTabs, m1: ["today"], m3: ["timetable", "teaching"], m4: ["mark", "register"], m5: ["enter", "results"], m17: ["curriculum", "notes"] },
  "Head of Department": { ...teachingModuleTabs, m1: ["today", "oversight"], m3: ["timetable", "teaching"], m4: ["mark", "register", "compliance"], m5: ["enter", "review", "results"], m6: ["remarks", "completion", "archive"], m8: ["registry"], m9: ["guardians", "submissions"], m12: ["compose", "sent"], m13: ["queue"], m17: ["curriculum", "notes", "review", "coverage"] },
  "Teaching Assistant": { ...teachingModuleTabs, m1: ["today"], m3: ["timetable", "teaching"], m4: ["mark", "register"] },
  "Cover / Substitute": { ...teachingModuleTabs, m1: ["today"], m3: ["timetable", "teaching"], m4: ["mark", "register"], m5: ["enter", "results"], m17: ["curriculum", "notes"] },
};

/**
 * Of the tabs a teaching template opens, the ones a teacher works in; the rest they only read. A form master writes remarks and
 * reads the report cards of the class (Completion, Archive); a teacher enters scores and reads their results. A module absent here
 * gives the template its level on every tab it opens, as before.
 */
export const teachingTemplateWork: Record<string, Partial<Record<string, string[]>>> = {
  "Proprietor": { m17: ["review"] },
  "Principal": { m17: ["review"] },
  "Form Master": { m1: [], m3: [], m4: ["mark"], m5: ["enter"], m6: ["remarks"], m8: [], m9: ["submissions"], m12: ["compose"], m2: [], m16: ["sync", "help-support"] },
  "Subject Teacher": { m1: [], m3: [], m4: ["mark"], m5: ["enter"], m2: [], m16: ["sync", "help-support"] },
  "Head of Department": { m1: [], m3: [], m4: ["mark"], m5: ["enter", "review"], m6: ["remarks"], m8: [], m9: ["submissions"], m12: ["compose"], m2: [], m16: ["sync", "help-support"] },
  "Teaching Assistant": { m1: [], m3: [], m4: ["mark"], m2: [], m16: ["sync", "help-support"] },
  "Cover / Substitute": { m1: [], m3: [], m4: ["mark"], m5: ["enter"], m17: [], m2: [], m16: ["sync", "help-support"] },
};

/** What a template may do on one tab: its module's actions where it works, and View alone where it only reads. */
export function templateTabActions(roleTemplate: string, moduleCode: string, tabSlug: string, actions: Record<SchoolModuleAction, boolean>): Record<SchoolModuleAction, boolean> {
  const work = teachingTemplateWork[roleTemplate]?.[moduleCode];
  if (!work || work.includes(tabSlug)) return actions;
  return { View: actions.View, Create: false, Edit: false, Approve: false, Export: false, Delete: false };
}

/** The tabs of a module a template grants, or null when it grants all of them. */
export function templateTabSlugs(roleTemplate: string, moduleCode: string): string[] | null {
  return teachingTemplateTabs[roleTemplate]?.[moduleCode] ?? null;
}

/** The permission keys a role template holds across every module and tab. */
export function schoolPermissionKeysForRoleTemplate(roleTemplate: string): string[] {
  return schoolModules.flatMap((module) => {
    const actions = schoolModuleActionsFor(roleTemplate, module.code);
    const only = templateTabSlugs(roleTemplate, module.code);
    return module.tabs.filter((tab) => !only || only.includes(tab.slug)).flatMap((tab) => {
      const here = templateTabActions(roleTemplate, module.code, tab.slug, actions);
      return schoolModuleActions.filter((action) => here[action]).map((action) => schoolPermissionKey(module.slug, tab.slug, action));
    });
  });
}

/** How many of the sixteen modules a template can open at all. */
export function schoolTemplateReach(roleTemplate: string): number {
  return schoolModules.filter((module) => schoolModuleLevel(roleTemplate, module.code) > 0).length;
}
