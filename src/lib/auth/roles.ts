import type { Role } from "@/lib/domain/types";

export function hasRole(userRole: Role, allowedRoles: Role[]) {
  return allowedRoles.includes(userRole);
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
  "ACCOUNTANT",
  "ADMISSIONS_OFFICER",
  "EXAM_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "TEACHER",
  "GUIDANCE_COUNSELLOR",
  "LIBRARIAN",
  "LABORATORY_STAFF",
  "ICT_CBT_ADMIN",
  "ATTENDANCE_OFFICER",
  "NURSE",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MISTRESS",
  "STORE_OFFICER"
];

const accessRules: AccessRule[] = [
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
  const rule = findAccessRule(path);
  if (!rule) {
    return false;
  }

  return hasRole(role, rule.view);
}

export function canManagePath(role: Role, path: string) {
  const rule = findAccessRule(path);
  if (!rule?.manage) {
    return false;
  }

  return hasRole(role, rule.manage);
}

export function getDefaultPathForRole(role: Role) {
  if (role === "PARENT") return "/portals/parent";
  if (role === "TEACHER" || role === "CLASS_TEACHER" || role === "SUBJECT_TEACHER") return "/portals/teacher";
  if (role === "STUDENT") return "/portals/student";
  return "/dashboard";
}

export const roleLabels: Record<Role, string> = {
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
  HEAD_OF_DEPARTMENT: "Head of Department",
  CLASS_TEACHER: "Class Teacher / Form Teacher",
  SUBJECT_TEACHER: "Subject Teacher",
  ACCOUNTANT: "Accountant / Bursar",
  PARENT: "Parent / Guardian",
  STUDENT: "Student",
  ADMISSIONS_OFFICER: "Admissions Officer",
  GUIDANCE_COUNSELLOR: "Guidance Counsellor",
  LIBRARIAN: "Librarian",
  LABORATORY_STAFF: "Laboratory Staff",
  ICT_CBT_ADMIN: "ICT / CBT Admin",
  ATTENDANCE_OFFICER: "Attendance Officer",
  NURSE: "Nurse / Sick Bay Officer",
  TRANSPORT_MANAGER: "Transport Manager",
  HOSTEL_MANAGER: "Hostel Manager",
  HOSTEL_MASTER: "Hostel Master",
  HOSTEL_MISTRESS: "Hostel Mistress",
  STORE_OFFICER: "Store Officer"
};
