import type { Role } from "@/lib/domain/types";
import {
  schoolModuleActionsFor,
  schoolModuleActions,
  schoolModules,
  schoolPermissionKey,
  schoolRoleModuleLevels,
  type SchoolAccessLevel,
  type SchoolModuleAction,
} from "@/lib/modules/school-modules";

/**
 * Kept local rather than imported from the navigation registry: the registry
 * derives its school navigation from this module, and importing back would
 * make that circular.
 */
const platformOnlyRoles = new Set<Role>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN",
]);

/**
 * The app carries far more roles than the mockup templates.
 * Each school role resolves to one of the mockup's eleven templates; the ones it
 * does not name fall back to the baseline below.
 */
const roleTemplateByRole: Partial<Record<Role, string>> = {
  SCHOOL_OWNER: "Proprietor",
  PROPRIETOR: "Proprietor",
  PRINCIPAL: "Principal",
  HEAD_TEACHER: "Principal",
  ADMINISTRATOR: "Principal",
  VICE_PRINCIPAL_ACADEMICS: "Head of Department",
  VICE_PRINCIPAL_ADMINISTRATION: "Registrar",
  VICE_PRINCIPAL_SPECIAL_DUTIES: "Head of Department",
  HEAD_OF_DEPARTMENT: "Head of Department",
  EXAM_OFFICER: "Exam Officer",
  EXAMINATION_OFFICER: "Exam Officer",
  BURSAR: "Bursar",
  ACCOUNTANT: "Bursar",
  ACCOUNT_OFFICER: "Bursar",
  ADMIN_OFFICER: "Registrar",
  ADMISSIONS_OFFICER: "Registrar",
  ATTENDANCE_OFFICER: "Form Master",
  CLASS_TEACHER: "Form Master",
  TEACHER: "Subject Teacher",
  SUBJECT_TEACHER: "Subject Teacher",
  SCHOOL_NURSE: "School Nurse",
  NURSE: "School Nurse",
  GUIDANCE_COUNSELOR: "Counsellor",
  GUIDANCE_COUNSELLOR: "Counsellor",
  ICT_CBT_ADMIN: "ICT Officer",
  IT_ADMINISTRATOR: "ICT Officer",
};

/**
 * Staff the mockup lists as job titles without templating — librarian, security,
 * store and maintenance officers and the like.
 *
 * Every one of the eleven templates grants at least view on Command Center and on
 * Sync & Support, so that pair is the floor for any signed-in member of staff.
 * Anything beyond it is granted deliberately, per person, in Staff & Access.
 */
const untemplatedStaffLevels: Partial<Record<string, SchoolAccessLevel>> = {
  m1: 1,
  m16: 1,
};

/** Roles that are not school staff at all and never see this shell. */
const nonStaffRoles = new Set<Role>(["STUDENT", "PARENT"]);

export function isSchoolStaffRole(role: Role): boolean {
  return !platformOnlyRoles.has(role) && !nonStaffRoles.has(role);
}

export function roleTemplateFor(role: Role): string | null {
  return roleTemplateByRole[role] ?? null;
}

/** The access level a role holds in a module, template or baseline. */
export function moduleLevelForRole(role: Role, moduleCode: string): SchoolAccessLevel {
  if (!isSchoolStaffRole(role)) return 0;

  const template = roleTemplateFor(role);
  if (template) {
    // An unlisted module means full access, which is how Proprietor is expressed.
    return schoolRoleModuleLevels[template]?.[moduleCode] ?? 3;
  }

  return untemplatedStaffLevels[moduleCode] ?? 0;
}

/** Which of the six actions a role may take in a module. */
export function moduleActionsForRole(
  role: Role,
  moduleCode: string,
): Record<SchoolModuleAction, boolean> {
  const template = roleTemplateFor(role);
  const level = moduleLevelForRole(role, moduleCode);

  if (!template) {
    const view = level >= 1;
    return {
      View: view,
      Create: false,
      Edit: false,
      Approve: false,
      Export: false,
      Delete: false,
    };
  }

  return schoolModuleActionsFor(template, moduleCode, level);
}

/** Every permission key a role holds across the sixteen modules. */
export function schoolPermissionsForRole(role: Role): string[] {
  if (!isSchoolStaffRole(role)) return [];

  return schoolModules.flatMap((module) => {
    const actions = moduleActionsForRole(role, module.code);
    return module.tabs.flatMap((tab) =>
      schoolModuleActions
        .filter((action) => actions[action])
        .map((action) => schoolPermissionKey(module.slug, tab.slug, action)),
    );
  });
}

/** The modules a role can open at all, in sidebar order. */
export function visibleModulesForRole(role: Role) {
  return schoolModules.filter((module) => moduleLevelForRole(role, module.code) > 0);
}

/** Where a role lands when it signs in — its first reachable module. */
export function defaultModuleForRole(role: Role) {
  return visibleModulesForRole(role)[0] ?? null;
}
