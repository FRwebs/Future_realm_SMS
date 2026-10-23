import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { ttlCached } from "@/lib/cache/ttl";
import { getServerSession } from "@/lib/auth/session";
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
  if (!isTeachingRole(role)) return null;
  try {
    const session = await getServerSession();
    const read = () => apiGet<TeacherWorkspaceView>("/api/v1/teacher-workspace/me");
    // Who a teacher is changes when the office reassigns a class (the API's context stamp moves when it does), not between two clicks.
    return session ? await ttlCached(`tw:${schoolId}:${session.userId}`, 600_000, read, { stamped: true }) : await read();
  } catch {
    return null;
  }
});

/**
 * What the teacher's rail counts beside a module — today, the families waiting on their form teacher. It is a number someone is waiting
 * to see move, so it is remembered for seconds only, and for nobody who is not teaching staff.
 */
export const getTeacherBadges = cache(async (role: string, schoolId: string): Promise<Record<string, number>> => {
  if (!isTeachingRole(role)) return {};
  try {
    const session = await getServerSession();
    if (!session) return {};
    const counts = await ttlCached(`badge:${schoolId}:${session.userId}`, 20_000, () => apiGet<{ families: number }>("/api/v1/teacher-workspace/badges"));
    return counts.families > 0 ? { t_m9: counts.families } : {};
  } catch {
    return {};
  }
});
