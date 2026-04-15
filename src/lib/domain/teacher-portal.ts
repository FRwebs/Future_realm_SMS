import { Role } from "@/lib/domain/types";

const privilegedAcademicRoles: Role[] = ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"];

export function canUseTeacherPortal(role: Role) {
  return role === "TEACHER";
}

export function canTeacherManageAssignedSubject(params: {
  role: Role;
  teacherId: string;
  assignedTeacherId?: string | null;
}) {
  return params.role === "TEACHER" && Boolean(params.assignedTeacherId) && params.teacherId === params.assignedTeacherId;
}

export function canViewTeacherOversight(role: Role) {
  return privilegedAcademicRoles.includes(role);
}
