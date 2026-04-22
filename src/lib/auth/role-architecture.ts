import type { Role } from "@/lib/domain/types";

export type RoleScope = "platform" | "school" | "external";
export type RoleCategory = "platform" | "leadership" | "academic" | "non_academic" | "external";

const platformRoleSet = new Set<Role>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

const externalRoleSet = new Set<Role>(["PARENT", "STUDENT"]);

const leadershipRoleSet = new Set<Role>([
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "VICE_PRINCIPAL_SPECIAL_DUTIES"
]);

const academicRoleSet = new Set<Role>([
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "TEACHER",
  "EXAMINATION_OFFICER",
  "EXAM_OFFICER",
  "GUIDANCE_COUNSELOR",
  "GUIDANCE_COUNSELLOR",
  "LIBRARIAN",
  "LABORATORY_ASSISTANT",
  "LABORATORY_STAFF"
]);

const nonAcademicRoleSet = new Set<Role>([
  "BURSAR",
  "ACCOUNTANT",
  "ACCOUNT_OFFICER",
  "HR_OFFICER",
  "SECURITY_OFFICER",
  "MAINTENANCE_OFFICER",
  "ADMIN_OFFICER",
  "ADMISSIONS_OFFICER",
  "TRANSPORT_COORDINATOR",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MATRON",
  "HOSTEL_MISTRESS",
  "IT_ADMINISTRATOR",
  "ICT_CBT_ADMIN",
  "SCHOOL_NURSE",
  "NURSE",
  "RECEPTIONIST",
  "ATTENDANCE_OFFICER",
  "STORE_OFFICER"
]);

export const roleCompatibilityAliases: Partial<Record<string, Role>> = {
  EXAM_OFFICER: "EXAMINATION_OFFICER",
  GUIDANCE_COUNSELLOR: "GUIDANCE_COUNSELOR",
  ACCOUNTANT: "BURSAR",
  ICT_CBT_ADMIN: "IT_ADMINISTRATOR",
  NURSE: "SCHOOL_NURSE",
  TRANSPORT_MANAGER: "TRANSPORT_COORDINATOR",
  HOSTEL_MISTRESS: "HOSTEL_MATRON",
  LABORATORY_STAFF: "LABORATORY_ASSISTANT",
  SUPER_ADMIN: "PLATFORM_ADMIN"
};

export function getCanonicalRole(role: Role | string | null | undefined): Role | null {
  if (!role) return null;
  const normalized = role.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  return roleCompatibilityAliases[normalized] ?? (normalized as Role);
}

export function areRolesEquivalent(left: Role | string, right: Role | string) {
  return getCanonicalRole(left) === getCanonicalRole(right);
}

export function getRoleScope(role: Role | string): RoleScope {
  const canonical = getCanonicalRole(role);
  if (canonical && platformRoleSet.has(canonical)) return "platform";
  if (canonical && externalRoleSet.has(canonical)) return "external";
  return "school";
}

export function getRoleCategory(role: Role | string): RoleCategory {
  const canonical = getCanonicalRole(role);
  if (!canonical) return "non_academic";
  if (platformRoleSet.has(canonical)) return "platform";
  if (externalRoleSet.has(canonical)) return "external";
  if (leadershipRoleSet.has(canonical)) return "leadership";
  if (academicRoleSet.has(canonical)) return "academic";
  return "non_academic";
}

export function isPlatformRole(role: Role | string) {
  return getRoleScope(role) === "platform";
}

export function isSchoolRole(role: Role | string) {
  return getRoleScope(role) === "school";
}

export function isExternalRole(role: Role | string) {
  return getRoleScope(role) === "external";
}

export function isAcademicRole(role: Role | string) {
  return getRoleCategory(role) === "academic";
}

export function isNonAcademicRole(role: Role | string) {
  const canonical = getCanonicalRole(role);
  return canonical ? nonAcademicRoleSet.has(canonical) : false;
}

export function isSchoolStaffRole(role: Role | string) {
  const scope = getRoleScope(role);
  return scope === "school" && !externalRoleSet.has(getCanonicalRole(role) as Role);
}

export function getStaffTypeForRole(role: Role | string): "ACADEMIC" | "NON_ACADEMIC" {
  const category = getRoleCategory(role);
  return category === "academic" || category === "leadership" ? "ACADEMIC" : "NON_ACADEMIC";
}

export const roleHierarchy: Partial<Record<Role, number>> = {
  PLATFORM_OWNER: 1000,
  PLATFORM_ADMIN: 950,
  SUPER_ADMIN: 950,
  DEVELOPER: 900,
  FINANCE_MANAGER: 850,
  SALES_MANAGER: 850,
  SUPPORT_AGENT: 800,
  SCHOOL_OWNER: 100,
  PROPRIETOR: 100,
  ADMINISTRATOR: 95,
  PRINCIPAL: 90,
  HEAD_TEACHER: 90,
  VICE_PRINCIPAL_ACADEMICS: 80,
  VICE_PRINCIPAL_ADMINISTRATION: 80,
  VICE_PRINCIPAL_SPECIAL_DUTIES: 75,
  HEAD_OF_DEPARTMENT: 70,
  BURSAR: 65,
  ACCOUNTANT: 65,
  ACCOUNT_OFFICER: 55,
  ADMISSIONS_OFFICER: 60,
  EXAMINATION_OFFICER: 60,
  EXAM_OFFICER: 60,
  IT_ADMINISTRATOR: 55,
  ICT_CBT_ADMIN: 55,
  ADMIN_OFFICER: 55,
  HR_OFFICER: 55,
  ATTENDANCE_OFFICER: 50,
  CLASS_TEACHER: 45,
  SUBJECT_TEACHER: 40,
  TEACHER: 40,
  GUIDANCE_COUNSELOR: 35,
  GUIDANCE_COUNSELLOR: 35,
  LIBRARIAN: 30,
  TRANSPORT_COORDINATOR: 30,
  TRANSPORT_MANAGER: 30,
  HOSTEL_MANAGER: 30,
  HOSTEL_MASTER: 30,
  HOSTEL_MATRON: 30,
  HOSTEL_MISTRESS: 30,
  SCHOOL_NURSE: 30,
  NURSE: 30,
  LABORATORY_ASSISTANT: 25,
  LABORATORY_STAFF: 25,
  STORE_OFFICER: 25,
  SECURITY_OFFICER: 25,
  MAINTENANCE_OFFICER: 25,
  RECEPTIONIST: 20,
  PARENT: 10,
  STUDENT: 5
};

export function getRoleHierarchy(role: Role | string | null | undefined) {
  const canonical = getCanonicalRole(role);
  return canonical ? roleHierarchy[canonical] ?? 0 : 0;
}

export function isOwnerRole(role: Role | string | null | undefined) {
  const canonical = getCanonicalRole(role);
  return canonical === "SCHOOL_OWNER" || canonical === "PROPRIETOR";
}

export function canManageRole(actorRole: Role | string, targetRole: Role | string) {
  if (isPlatformRole(actorRole)) return true;
  if (isPlatformRole(targetRole) || isExternalRole(actorRole)) return false;
  if (isOwnerRole(targetRole)) return false;
  return getRoleHierarchy(actorRole) > getRoleHierarchy(targetRole);
}

export function canAssignRole(actorRole: Role | string, assignRole: Role | string) {
  if (isPlatformRole(actorRole)) return true;
  if (!isSchoolRole(assignRole) || isExternalRole(actorRole)) return false;
  if (isOwnerRole(assignRole)) return false;
  return getRoleHierarchy(actorRole) > getRoleHierarchy(assignRole);
}
