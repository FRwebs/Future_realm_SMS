import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { isTeachingRole, type TeachingPersona } from "@/lib/modules/teacher-workspace";

export type TeacherWorkspaceView = {
  persona: TeachingPersona;
  personaLabel: string;
  person: { id: string; name: string; initials: string; role: string; title: string; employeeNo: string | null; email: string; phone: string | null; joined: string | null };
  department: { id: string; name: string } | null;
  reportsTo: { name: string; title: string } | null;
  term: { id: string; name: string; session: string; startsOn: string; endsOn: string; week: number; weeks: number } | null;
  formArms: Array<{ id: string; name: string; roll: number; earlyYears: boolean }>;
  assistantArms: Array<{ id: string; name: string; roll: number }>;
  teaching: Array<{ classId: string; subjectId: string; subject: string; arm: string; periods: number; assistant: boolean; basis: "Substantive" | "Cover"; until: string | null }>;
  hats: Array<{ role: string; scope: string; detail: string }>;
};

/**
 * Who the signed-in teaching person is, from their real assignments — read once per request, however many server components
 * ask. Null for anyone who is not teaching staff (they use the administrator's workspace) or when the API cannot say.
 */
export const getTeacherWorkspace = cache(async (role: string, schoolId: string): Promise<TeacherWorkspaceView | null> => {
  void schoolId;
  if (!isTeachingRole(role)) return null;
  try {
    return await apiGet<TeacherWorkspaceView>("/api/v1/teacher-workspace/me");
  } catch {
    return null;
  }
});
