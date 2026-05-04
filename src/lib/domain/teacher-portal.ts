import { Role } from "@/lib/domain/types";

const privilegedAcademicRoles: Role[] = ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"];
const teacherPortalRoles: Role[] = ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"];

export function canUseTeacherPortal(role: Role) {
  return teacherPortalRoles.includes(role);
}

export function canTeacherManageAssignedSubject(params: {
  role: Role;
  teacherId: string;
  assignedTeacherId?: string | null;
}) {
  return canUseTeacherPortal(params.role) && Boolean(params.assignedTeacherId) && params.teacherId === params.assignedTeacherId;
}

export function canViewTeacherOversight(role: Role) {
  return privilegedAcademicRoles.includes(role);
}
