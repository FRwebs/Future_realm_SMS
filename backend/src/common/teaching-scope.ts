import { ForbiddenException } from "@nestjs/common";

import type { SessionPayload } from "../../../src/lib/auth/session-core";
import { prisma } from "../../../src/lib/db/prisma";

/**
 * What a teaching person may read, enforced where the data is read — not hidden by the screen that asks for it.
 *
 * A teacher's pages are the same modules an administrator opens, read through what the teacher is assigned to. So wherever one of
 * those modules answers a question about the whole school (every arm's remarks, every guardian, every sheet), a teaching role is
 * held to its own scope: the arms it is form master or assistant of, the subject-arms it teaches, and — for a head of department —
 * the sheets of its department's subjects. Anyone who is not a teaching role is unrestricted here (their own permissions decide).
 */

export const TEACHING_ROLES = new Set(["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT", "TEACHING_ASSISTANT", "COVER_TEACHER"]);

export type TeachingScope = {
  /** Arms they are form master (or class teacher) of. */
  form: Set<string>;
  /** Arms they assist: readable, never theirs to write on. */
  assistant: Set<string>;
  /** Subject-arms they teach, as "classId:subjectId". */
  subjects: Set<string>;
  /** Every arm one of those subject-arms belongs to. */
  subjectArms: Set<string>;
  /** For a head of department: the subject-arms of its subjects, as "classId:subjectId". */
  department: Set<string>;
  departmentId: string | null;
};

/** The cover a person holds today: stated, time-boxed, and gone the day it ends. */
export async function activeCovers(schoolId: string, userId: string, on = new Date()) {
  const local = new Date(on.getTime() + 3_600_000);
  const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  return prisma.coverAssignment.findMany({ where: { schoolId, coverUserId: userId, endedAt: null, startsOn: { lte: day }, endsOn: { gte: day } } });
}

const TTL_MS = 10_000;
const cache = new Map<string, { at: number; scope: TeachingScope }>();

/** Null for anyone who is not a teaching role — they are not held to this scope. */
export async function teachingScope(session: Pick<SessionPayload, "userId" | "schoolId" | "role">): Promise<TeachingScope | null> {
  if (!TEACHING_ROLES.has(session.role)) return null;
  const key = `${session.schoolId}:${session.userId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.scope;
  const [forms, assists, taught, profile, covers] = await Promise.all([
    prisma.classRoom.findMany({ where: { schoolId: session.schoolId, classTeacherId: session.userId, deletedAt: null }, select: { id: true } }),
    prisma.classRoom.findMany({ where: { schoolId: session.schoolId, assistantClassTeacherId: session.userId, deletedAt: null }, select: { id: true } }),
    prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ teacherId: session.userId }, { assistantTeacherId: session.userId }] }, select: { classId: true, subjectId: true } }),
    session.role === "HEAD_OF_DEPARTMENT" ? prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } }) : Promise.resolve(null),
    activeCovers(session.schoolId, session.userId)
  ]);
  const departmentId = profile?.departmentId ?? null;
  const dept = departmentId ? await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, subject: { departmentId } }, select: { classId: true, subjectId: true } }) : [];
  const scope: TeachingScope = {
    form: new Set(forms.map((row) => row.id)),
    // Cover of a form class's daily register reads like an assistant's: the register, never the remarks.
    assistant: new Set([...assists.map((row) => row.id), ...covers.filter((row) => !row.subjectId).map((row) => row.classId)]),
    subjects: new Set([...taught.map((row) => `${row.classId}:${row.subjectId}`), ...covers.filter((row) => row.subjectId && row.scope !== "REGISTER").map((row) => `${row.classId}:${row.subjectId}`)]),
    subjectArms: new Set([...taught.map((row) => row.classId), ...covers.map((row) => row.classId)]),
    department: new Set(dept.map((row) => `${row.classId}:${row.subjectId}`)), departmentId
  };
  cache.set(key, { at: Date.now(), scope });
  return scope;
}

export const forgetTeachingScope = () => cache.clear();

/** The arms a teaching person may read as a class — form and assistant — or null when they are unrestricted. */
export async function classScope(session: Pick<SessionPayload, "userId" | "schoolId" | "role">): Promise<string[] | null> {
  const scope = await teachingScope(session);
  return scope ? [...scope.form, ...scope.assistant] : null;
}

/** The arms whose children a teacher answers for or teaches: their classes, and every arm they teach a subject in. */
export async function studentScope(session: Pick<SessionPayload, "userId" | "schoolId" | "role">): Promise<string[] | null> {
  const scope = await teachingScope(session);
  return scope ? [...new Set([...scope.form, ...scope.assistant, ...scope.subjectArms])] : null;
}

export async function assertClassReadable(session: Pick<SessionPayload, "userId" | "schoolId" | "role">, classId: string, what = "that arm") {
  const scope = await teachingScope(session);
  if (scope && !scope.form.has(classId) && !scope.assistant.has(classId)) throw new ForbiddenException(`You are not the form master or assistant of ${what}, so it is not yours to read.`);
}

export async function assertStudentArmReadable(session: Pick<SessionPayload, "userId" | "schoolId" | "role">, classId: string | null | undefined) {
  const scope = await teachingScope(session);
  if (!scope) return;
  if (!classId || (!scope.form.has(classId) && !scope.assistant.has(classId) && !scope.subjectArms.has(classId))) throw new ForbiddenException("That child is not in a class you answer for or teach.");
}

/** A sheet is readable by the teacher of that subject-arm, the form master of the arm, and a head of department for their own subjects. */
export async function assertSheetReadable(session: Pick<SessionPayload, "userId" | "schoolId" | "role">, classId: string, subjectId: string) {
  const scope = await teachingScope(session);
  if (!scope) return;
  const ok = scope.subjects.has(`${classId}:${subjectId}`) || scope.form.has(classId) || scope.assistant.has(classId) || scope.department.has(`${classId}:${subjectId}`);
  if (!ok) throw new ForbiddenException("That sheet is not one you teach, so its scores are not yours to read.");
}

/** The whole-school answer that has no teacher-shaped version: a teaching role is turned away, and told where its own lives. */
export async function refuseTeaching(session: Pick<SessionPayload, "role">, ownPage: string) {
  if (TEACHING_ROLES.has(session.role)) throw new ForbiddenException(`That is the whole school's view. Yours is ${ownPage}.`);
}
