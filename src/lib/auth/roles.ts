import type { Role } from "@/lib/domain/types";
import {
  areRolesEquivalent,
  canAssignRole,
  canManageRole,
  getRoleCategory,
  getRoleHierarchy,
  getRoleScope,
  isAcademicRole,
  isExternalRole,
  isNonAcademicRole,
  isPlatformRole,
  isSchoolRole,
  isSchoolStaffRole,
  roleCompatibilityAliases
} from "@/lib/auth/role-architecture";
import { canAccessPathWithPermissions, getDefaultPermissionsForRole, platformRoles } from "@/lib/navigation/registry";

export {
  canAssignRole,
  canManageRole,
  getRoleCategory,
  getRoleHierarchy,
  getRoleScope,
  isAcademicRole,
  isExternalRole,
  isNonAcademicRole,
  isPlatformRole,
  isSchoolRole,
  isSchoolStaffRole
};

export const allRoles: Role[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "VICE_PRINCIPAL_SPECIAL_DUTIES",
  "ADMIN_OFFICER",
  "TEACHER",
  "EXAM_OFFICER",
  "EXAMINATION_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "BURSAR",
  "ACCOUNTANT",
  "ACCOUNT_OFFICER",
  "HR_OFFICER",
  "SECURITY_OFFICER",
  "MAINTENANCE_OFFICER",
  "PARENT",
  "STUDENT",
  "ADMISSIONS_OFFICER",
  "GUIDANCE_COUNSELOR",
  "GUIDANCE_COUNSELLOR",
  "LIBRARIAN",
  "LABORATORY_STAFF",
  "LABORATORY_ASSISTANT",
  "ICT_CBT_ADMIN",
  "IT_ADMINISTRATOR",
  "ATTENDANCE_OFFICER",
  "SCHOOL_NURSE",
  "NURSE",
  "RECEPTIONIST",
  "TRANSPORT_COORDINATOR",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MATRON",
  "HOSTEL_MISTRESS",
  "STORE_OFFICER"
];

export const adminDashboardRoles: Role[] = [
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "VICE_PRINCIPAL_SPECIAL_DUTIES",
  "ADMIN_OFFICER",
  "TEACHER",
  "EXAM_OFFICER",
  "EXAMINATION_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "BURSAR",
  "ACCOUNTANT",
  "ACCOUNT_OFFICER",
  "HR_OFFICER",
  "SECURITY_OFFICER",
  "MAINTENANCE_OFFICER",
  "ADMISSIONS_OFFICER",
  "GUIDANCE_COUNSELOR",
  "GUIDANCE_COUNSELLOR",
  "LIBRARIAN",
  "LABORATORY_STAFF",
  "LABORATORY_ASSISTANT",
  "ICT_CBT_ADMIN",
  "IT_ADMINISTRATOR",
  "ATTENDANCE_OFFICER",
  "SCHOOL_NURSE",
  "NURSE",
  "RECEPTIONIST",
  "TRANSPORT_COORDINATOR",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MATRON",
  "HOSTEL_MISTRESS",
  "STORE_OFFICER"
];

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_") as Role;
  if (allRoles.includes(normalized)) return normalized;
  const aliased = roleCompatibilityAliases[normalized] ?? normalized;
  return allRoles.includes(aliased) ? aliased : null;
}

export function hasRole(userRole: Role, allowedRoles: Role[]) {
  return allowedRoles.some((allowedRole) => areRolesEquivalent(userRole, allowedRole));
}

type AccessRule = {
  prefix: string;
  view: Role[];
  manage?: Role[];
};

export const academicOversightRoles: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "ADMIN_OFFICER",
  "EXAM_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "TEACHER"
];

export const resultApprovalRoles: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "ADMIN_OFFICER",
  "EXAM_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER"
];

export const finalResultApprovalRoles: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "PRINCIPAL",
  "HEAD_TEACHER"
];

const adminViewRoles: Role[] = [
  ...adminDashboardRoles
];

const operationsViewRoles: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "VICE_PRINCIPAL_SPECIAL_DUTIES",
  "ADMIN_OFFICER",
  "EXAM_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "TEACHER",
  "GUIDANCE_COUNSELLOR",
  "LIBRARIAN",
  "ICT_CBT_ADMIN",
  "ATTENDANCE_OFFICER",
  "NURSE",
  "RECEPTIONIST",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MISTRESS",
  "STORE_OFFICER"
];

const accessRules: AccessRule[] = [
  {
    prefix: "/super-admin",
    view: ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"],
    manage: ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]
  },
  {
    prefix: "/dashboard",
    view: adminViewRoles
  },
  {
    prefix: "/admissions",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "ADMISSIONS_OFFICER"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "ADMISSIONS_OFFICER"]
  },
  {
    prefix: "/students",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "ACCOUNTANT", "GUIDANCE_COUNSELLOR", "NURSE"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER"]
  },
  {
    prefix: "/teachers",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT"]
  },
  {
    prefix: "/school/staff",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "ADMIN_OFFICER", "HEAD_OF_DEPARTMENT", "ICT_CBT_ADMIN", "LIBRARIAN"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "ICT_CBT_ADMIN"]
  },
  {
    prefix: "/school/profile",
    view: allRoles,
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "ICT_CBT_ADMIN"]
  },
  {
    prefix: "/attendance",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "ATTENDANCE_OFFICER"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "ATTENDANCE_OFFICER"]
  },
  {
    prefix: "/academics",
    view: academicOversightRoles,
    manage: academicOversightRoles
  },
  {
    prefix: "/operations",
    view: operationsViewRoles,
    manage: operationsViewRoles
  },
  {
    prefix: "/finance",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "ACCOUNTANT"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "ADMIN_OFFICER", "ACCOUNTANT"]
  },
  {
    prefix: "/communications",
    view: [...adminViewRoles, "PARENT", "STUDENT"],
    manage: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"]
  },
  {
    prefix: "/analytics",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "ACCOUNTANT", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT"]
  },
  {
    prefix: "/settings",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER"]
  },
  {
    prefix: "/school/settings/roles",
    view: allRoles.filter((role) => role !== "PARENT" && role !== "STUDENT")
  },
  {
    prefix: "/school/configuration",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "ICT_CBT_ADMIN"]
  },
  {
    prefix: "/school/my-permissions",
    view: ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "CLASS_TEACHER", "SUBJECT_TEACHER", "ACCOUNTANT", "ADMISSIONS_OFFICER", "GUIDANCE_COUNSELLOR", "LIBRARIAN", "LABORATORY_STAFF", "ICT_CBT_ADMIN", "ATTENDANCE_OFFICER", "NURSE", "RECEPTIONIST", "TRANSPORT_MANAGER", "HOSTEL_MANAGER", "HOSTEL_MASTER", "HOSTEL_MISTRESS", "STORE_OFFICER"]
  },
  {
    prefix: "/portals/parent",
    view: ["PARENT"]
  },
  {
    prefix: "/portals/teacher",
    view: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"]
  },
  {
    prefix: "/portals/student",
    view: ["STUDENT"]
  }
];

function findAccessRule(path: string) {
  return accessRules
    .filter((rule) => path === rule.prefix || path.startsWith(`${rule.prefix}/`))
    .sort((left, right) => right.prefix.length - left.prefix.length)[0];
}

export function canAccessPath(role: Role, path: string) {
  if (path === "/dashboard" && isSchoolStaffRole(role)) return true;
  return canAccessPathWithPermissions(role, path, getDefaultPermissionsForRole(role));
}

export function canManagePath(role: Role, path: string) {
  const rule = findAccessRule(path);
  if (!rule?.manage) {
    return false;
  }

  return hasRole(role, rule.manage);
}

export function getDefaultPathForRole(role: Role) {
  if (platformRoles.includes(role)) return "/super-admin";
  if (role === "PARENT") return "/portals/parent";
  if (role === "TEACHER" || role === "CLASS_TEACHER" || role === "SUBJECT_TEACHER") return "/portals/teacher";
  if (role === "STUDENT") return "/portals/student";
  return "/dashboard";
}

export const roleLabels: Record<Role, string> = {
  PLATFORM_OWNER: "Platform Owner / CEO",
  PLATFORM_ADMIN: "Platform Administrator",
  SUPPORT_AGENT: "Customer Support Agent",
  SALES_MANAGER: "Sales / Account Manager",
  FINANCE_MANAGER: "Platform Finance Manager",
  DEVELOPER: "Developer / Technical Admin",
  SUPER_ADMIN: "Super Admin",
  SCHOOL_OWNER: "School Owner",
  PROPRIETOR: "Proprietor / Proprietress",
  ADMINISTRATOR: "Administrator",
  PRINCIPAL: "Principal",
  HEAD_TEACHER: "Head Teacher",
  VICE_PRINCIPAL_ACADEMICS: "Vice Principal Academics",
  VICE_PRINCIPAL_ADMINISTRATION: "Vice Principal Administration",
  VICE_PRINCIPAL_SPECIAL_DUTIES: "Vice Principal Special Duties",
  ADMIN_OFFICER: "Admin Officer",
  TEACHER: "Teacher",
  EXAM_OFFICER: "Exam Officer",
  EXAMINATION_OFFICER: "Examination Officer",
  HEAD_OF_DEPARTMENT: "Head of Department",
  CLASS_TEACHER: "Class Teacher / Form Teacher",
  SUBJECT_TEACHER: "Subject Teacher",
  BURSAR: "Bursar",
  ACCOUNTANT: "Accountant / Bursar",
  ACCOUNT_OFFICER: "Account Officer",
  HR_OFFICER: "HR Officer",
  SECURITY_OFFICER: "Security Officer",
  MAINTENANCE_OFFICER: "Maintenance Officer",
  PARENT: "Parent / Guardian",
  STUDENT: "Student",
  ADMISSIONS_OFFICER: "Admissions Officer",
  GUIDANCE_COUNSELOR: "Guidance Counselor",
  GUIDANCE_COUNSELLOR: "Guidance Counsellor",
  LIBRARIAN: "Librarian",
  LABORATORY_STAFF: "Laboratory Staff",
  LABORATORY_ASSISTANT: "Laboratory Assistant",
  ICT_CBT_ADMIN: "ICT / CBT Admin",
  IT_ADMINISTRATOR: "IT Administrator",
  ATTENDANCE_OFFICER: "Attendance Officer",
  SCHOOL_NURSE: "School Nurse",
  NURSE: "Nurse / Sick Bay Officer",
  RECEPTIONIST: "Receptionist / Front Desk",
  TRANSPORT_COORDINATOR: "Transport Coordinator",
  TRANSPORT_MANAGER: "Transport Manager",
  HOSTEL_MANAGER: "Hostel Manager",
  HOSTEL_MASTER: "Hostel Master",
  HOSTEL_MATRON: "Hostel Matron",
  HOSTEL_MISTRESS: "Hostel Mistress",
  STORE_OFFICER: "Store Officer"
};
