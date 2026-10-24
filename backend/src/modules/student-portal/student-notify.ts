import type { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Telling a student something, the way they chose to be told. The in-app notice is their record and is always written. An email is queued
 * only when the student has it on for that kind of news (most are on until they say otherwise) and it is not inside their quiet hours — an
 * email held back for quiet hours is not sent later; the in-app notice is still there.
 */

export type StudentNewsKind = "work" | "results" | "timetable" | "school" | "messages";
const EMAIL_OFF_BY_DEFAULT: StudentNewsKind[] = ["timetable"];
export const STUDENT_PREFS_RESOURCE = "student-prefs";
/** What a student has until they choose otherwise — the settings page shows the same. */
export const DEFAULT_QUIET_HOURS = "21:00 – 07:00";

type Prefs = { matrix?: Record<string, boolean>; quiet?: string };

/** "21:00 – 07:00" → whether `clock` falls inside, across midnight. */
export function insideQuietHours(quiet: string | undefined, clock: string): boolean {
  const match = quiet?.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/);
  if (!match) return false;
  const [, from, to] = match as unknown as [string, string, string];
  return from > to ? clock >= from || clock < to : clock >= from && clock < to;
}

const lagosClock = (at: Date) => new Date(at.getTime() + 3_600_000).toISOString().slice(11, 16);

export type StudentNotice = { userId: string; kind: StudentNewsKind; title: string; body: string; meta: Record<string, unknown> };

export async function notifyStudents(schoolId: string, notices: StudentNotice[], at = new Date()) {
  if (!notices.length) return;
  const ids = [...new Set(notices.map((notice) => notice.userId))];
  const [users, prefRows] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } }),
    prisma.configurationItem.findMany({ where: { schoolId, resource: STUDENT_PREFS_RESOURCE, name: { in: ids }, deletedAt: null }, select: { name: true, data: true } }),
  ]);
  const email = new Map(users.map((user) => [user.id, user.email]));
  const prefs = new Map(prefRows.map((row) => [row.name, (row.data ?? {}) as Prefs]));
  const clock = lagosClock(at);
  const data: Prisma.NotificationLogCreateManyInput[] = [];
  for (const notice of notices) {
    data.push({ schoolId, userId: notice.userId, channel: "IN_APP", title: notice.title, body: notice.body, status: "SENT", sentAt: at, metadata: notice.meta as Prisma.InputJsonValue });
    const mine = prefs.get(notice.userId);
    const wants = mine?.matrix?.[`${notice.kind}:Email`] ?? !EMAIL_OFF_BY_DEFAULT.includes(notice.kind);
    const address = email.get(notice.userId);
    if (wants && address && !insideQuietHours(mine?.quiet ?? DEFAULT_QUIET_HOURS, clock)) {
      data.push({ schoolId, userId: notice.userId, channel: "EMAIL", title: notice.title, body: notice.body, status: "QUEUED", sentAt: at, metadata: { ...notice.meta, email: address } as Prisma.InputJsonValue });
    }
  }
  await prisma.notificationLog.createMany({ data });
}
