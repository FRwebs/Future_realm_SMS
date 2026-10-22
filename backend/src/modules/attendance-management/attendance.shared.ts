import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { activeCovers } from "../../common/teaching-scope";
import { prisma } from "../../../../src/lib/db/prisma";
import { RolesManagementService } from "../roles-management/roles-management.service";
import { ConfigStore } from "../staff-access/staff-access.shared";

/**
 * What every Attendance tab reads the same way: the school's own rules, which days the school
 * sat, how a rate is worked out, and who may mark which register.
 */

export type Mark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export const MARKS: Mark[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
export const MARK_LABEL: Record<Mark, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", EXCUSED: "Excused" };
export const markOf = (label: string): Mark | null => MARKS.find((mark) => MARK_LABEL[mark].toLowerCase() === label.trim().toLowerCase() || mark === label.trim().toUpperCase()) ?? null;

export const REASONS = ["Illness", "Medical appointment", "Family bereavement", "Travel", "Transport failure", "Suspended", "Religious observance", "No reason given", "Other — described below"];
export const CORRECTION_REASONS = ["Marked in error", "Child arrived after the register was taken", "Guardian explanation accepted", "Register taken by the wrong teacher", "School closed that day", "Other — described below"];
export const CASE_OUTCOMES = ["Guardian met and a plan agreed", "Medical — excused", "Transferred or withdrawn", "Improved — back above the threshold", "Referred to welfare", "Referred to the Principal", "Other — described"];

/** Teachers mark their own arms; everyone else with the permission may mark any. */
export const TEACHING_ROLES = new Set(["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT", "TEACHING_ASSISTANT", "COVER_TEACHER"]);
export const LEADER_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "HEAD_TEACHER", "ADMINISTRATOR"]);

export const DAY_MS = 86_400_000;
export const round1 = (value: number) => Math.round(value * 10) / 10;
export const fullName = (user: { firstName: string; lastName: string } | null | undefined) => (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "");

/* ───────────────────────────── the school's own rules ───────────────────────────── */

export type Policy = {
  /** A register taken after this is late. */
  markCutoff: string;
  /** The bell: a child arriving after this is marked late. From School Configuration. */
  bell: string;
  lateCounts: boolean;
  target: number;
  chronic: number;
  watch: number;
  /** Days on record before a low rate opens a case — one absence on day two is not chronic. */
  minDays: number;
  alertDays: number;
  alertChannel: string;
  guardianNotifyAt: string;
};

export const POLICY_DEFAULTS = { markCutoff: "09:30", target: 92, chronic: 75, watch: 85, minDays: 5, guardianNotifyAt: "10:00" };

export async function loadPolicy(schoolId: string): Promise<Policy> {
  const config = new ConfigStore(schoolId, "attendance");
  const [late, alert, own] = await Promise.all([
    config.get<{ cutoff?: string; countsAsPresent?: boolean }>("LATE_THRESHOLD"),
    config.get<{ channel?: string; consecutiveDays?: number }>("ABSENCE_ALERT"),
    new ConfigStore(schoolId, "attendance-policy").get<Partial<typeof POLICY_DEFAULTS>>("POLICY")
  ]);
  return {
    ...POLICY_DEFAULTS,
    ...(own?.data ?? {}),
    bell: late?.data.cutoff ?? "08:00",
    lateCounts: late?.data.countsAsPresent ?? true,
    alertDays: alert?.data.consecutiveDays ?? 3,
    alertChannel: alert?.data.channel ?? "SMS"
  };
}

/* ───────────────────────────── dates ───────────────────────────── */

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** The calendar date in Lagos, as UTC midnight — the form every attendance date is stored in. */
export function today(now = new Date()): Date {
  const local = new Date(now.getTime() + 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function dayOf(value: string | Date | null | undefined): Date {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("That is not a date.");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

/** "Thu 4 Sep 2026" */
export function longDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function shortDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** The wall-clock time in Lagos, "07:58". */
export function lagosClock(instant: Date | null | undefined): string | null {
  if (!instant) return null;
  return instant.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
}

export type TermLike = { id: string; name: string; startDate: Date; endDate: Date; breakStart: Date | null; breakEnd: Date | null; schoolDays: string[] };

export function isSchoolDay(term: TermLike, day: Date): boolean {
  if (day < dayOf(term.startDate) || day > dayOf(term.endDate)) return false;
  if (!term.schoolDays.includes(DOW[day.getUTCDay()])) return false;
  if (term.breakStart && term.breakEnd && day >= dayOf(term.breakStart) && day <= dayOf(term.breakEnd)) return false;
  return true;
}

export function schoolDaysBetween(term: TermLike, from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) if (isSchoolDay(term, day)) days.push(day);
  return days;
}

/** Monday of the week a date falls in. */
export function weekStart(day: Date): Date {
  const back = (day.getUTCDay() + 6) % 7;
  return addDays(day, -back);
}

export async function currentTerm(schoolId: string) {
  return prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: { select: { name: true } } } });
}

/**
 * The days the school is held to account for. Registers are counted from the first one this term
 * actually has, and only on days somebody kept one: a school day on which no arm took a register
 * at all is a day nothing was recorded for (a closure nobody entered, a system not yet in use),
 * and holding every form master to it would call the whole school non-compliant for a hole in
 * the records. The one exception is today, once the cutoff has passed — then the missing
 * registers are real. Everything else is simply not on record, and the pages say so.
 */
export async function termCalendar(schoolId: string, term: TermLike, now = today(), cutoff?: string) {
  const kept = await prisma.attendanceRegister.groupBy({ by: ["date"], where: { schoolId, termId: term.id, status: "SUBMITTED" }, _count: { _all: true } });
  const keptDays = new Set(kept.map((row) => iso(dayOf(row.date))));
  const first = kept.length ? kept.map((row) => dayOf(row.date)).sort((a, b) => a.getTime() - b.getTime())[0] : null;
  const from = first ?? dayOf(term.startDate);
  const to = now < dayOf(term.endDate) ? now : dayOf(term.endDate);
  const clock = lagosClock(new Date()) ?? "00:00";
  const todayCounts = cutoff !== undefined && clock > cutoff;
  const days = from <= to
    ? schoolDaysBetween(term, from, to).filter((day) => keptDays.has(iso(day)) || (todayCounts && day.getTime() === now.getTime()))
    : [];
  return { from, to, days, since: first, kept: keptDays };
}

/** Which day to show when no one has asked for one: today if the school sits, else the latest day with registers. */
export async function focusDay(schoolId: string, term: TermLike, now = today()) {
  if (isSchoolDay(term, now)) return { date: now, today: true, note: null as string | null };
  const latest = await prisma.attendanceRegister.findFirst({ where: { schoolId, termId: term.id, status: "SUBMITTED", date: { lte: now } }, orderBy: { date: "desc" }, select: { date: true } });
  const date = latest ? dayOf(latest.date) : (schoolDaysBetween(term, dayOf(term.startDate), now < dayOf(term.endDate) ? now : dayOf(term.endDate)).pop() ?? now);
  const reason = now > dayOf(term.endDate) ? `${term.name} ended on ${longDay(dayOf(term.endDate))}` : now < dayOf(term.startDate) ? `${term.name} has not started` : "the school does not sit today";
  return { date, today: false, note: `Today, ${longDay(now)}, is not a school day (${reason}). Showing the latest day on record.` };
}

/* ───────────────────────────── rates ───────────────────────────── */

export type Tally = { present: number; late: number; absent: number; excused: number };
export const emptyTally = (): Tally => ({ present: 0, late: 0, absent: 0, excused: 0 });
export function add(tally: Tally, mark: string, by = 1) {
  if (mark === "PRESENT") tally.present += by;
  else if (mark === "LATE") tally.late += by;
  else if (mark === "ABSENT") tally.absent += by;
  else if (mark === "EXCUSED") tally.excused += by;
}
export const days = (tally: Tally) => tally.present + tally.late + tally.absent + tally.excused;

/** Excused days are taken out of the count; a late day is not. Null when there is nothing to divide. */
export function rate(tally: Tally, lateCounts = true): number | null {
  const denominator = tally.present + tally.late + tally.absent;
  if (!denominator) return null;
  return round1(((tally.present + (lateCounts ? tally.late : 0)) / denominator) * 100);
}

export const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

/* ───────────────────────────── arms ───────────────────────────── */

export function armName(room: { name: string; arm: string | null }): string {
  const letter = (room.arm ?? "").trim();
  if (!letter || room.name.toLowerCase().endsWith(letter.toLowerCase())) return room.name;
  return `${room.name} ${letter}`;
}

export type ArmRow = {
  id: string;
  name: string;
  roll: number;
  masterId: string | null;
  master: string | null;
  assistantId: string | null;
  dept: string | null;
};

/** Every arm that has children on its roll, with the form master who answers for it. */
export async function loadArms(schoolId: string): Promise<ArmRow[]> {
  const rooms = await prisma.classRoom.findMany({
    where: { schoolId, deletedAt: null, isActive: true, students: { some: { status: "ACTIVE" } } },
    select: {
      id: true, name: true, arm: true, classTeacherId: true, assistantClassTeacherId: true,
      classTeacher: { select: { firstName: true, lastName: true, staffProfile: { select: { department: { select: { name: true } } } } } },
      _count: { select: { students: { where: { status: "ACTIVE" } } } },
      classLevel: { select: { order: true } }
    },
    orderBy: [{ classLevel: { order: "asc" } }, { name: "asc" }, { arm: "asc" }]
  });
  return rooms.map((room) => ({
    id: room.id,
    name: armName(room),
    roll: room._count.students,
    masterId: room.classTeacherId,
    master: room.classTeacher ? fullName(room.classTeacher) : null,
    assistantId: room.assistantClassTeacherId,
    dept: room.classTeacher?.staffProfile?.department?.name ?? null
  }));
}

/* ───────────────────────────── access ───────────────────────────── */

@Injectable()
export class Access {
  constructor(private readonly roles: RolesManagementService) {}

  async keys(session: SessionPayload): Promise<Set<string>> {
    return new Set(await this.roles.resolveUserPermissions(session.userId, session.schoolId, session));
  }

  async can(session: SessionPayload, key: string): Promise<boolean> {
    return (await this.keys(session)).has(key);
  }

  /** A teacher marks only the arms they are named on. */
  async assertMarker(session: SessionPayload, arm: { id?: string; name: string; classTeacherId: string | null; assistantClassTeacherId: string | null }) {
    if (!TEACHING_ROLES.has(session.role)) return;
    if (arm.classTeacherId === session.userId || arm.assistantClassTeacherId === session.userId) return;
    // Cover holds the register for the days it is stated, and not a day more.
    if (arm.id && (await activeCovers(session.schoolId, session.userId)).some((cover) => cover.classId === arm.id)) return;
    throw new ForbiddenException(`${arm.name}'s register is taken by its own form master. Ask a school administrator to mark it.`);
  }
}

/* ───────────────────────────── telling staff ───────────────────────────── */

export type StaffNotice = { title: string; body: string; channels: string[]; urgency?: string; link?: string; copy?: string[] };

/**
 * A notification to staff changes nothing on any record. It queues one row per channel that can
 * reach the person, and says which did — nothing is sent from here.
 */
export async function notifyStaff(schoolId: string, actorId: string, userIds: string[], notice: StaffNotice) {
  const users = await prisma.user.findMany({ where: { schoolId, id: { in: userIds }, isActive: true, deletedAt: null }, select: { id: true, phone: true, email: true, firstName: true, lastName: true } });
  const rows: Prisma.NotificationLogCreateManyInput[] = [];
  const reached = new Set<string>();
  const unreachable: string[] = [];
  for (const user of users) {
    const before = rows.length;
    const metadata = { by: actorId, urgency: notice.urgency ?? "Reminder", link: notice.link ?? null, copy: notice.copy ?? [] } as Prisma.InputJsonValue;
    if (notice.channels.some((channel) => /in-app/i.test(channel))) rows.push({ schoolId, userId: user.id, channel: "IN_APP", title: notice.title, body: notice.body, status: "QUEUED", metadata, sentAt: new Date() });
    if (notice.channels.some((channel) => /sms|whatsapp/i.test(channel)) && user.phone) rows.push({ schoolId, userId: user.id, channel: "SMS", title: notice.title, body: notice.body, status: "QUEUED", metadata: { ...(metadata as object), phone: user.phone } as Prisma.InputJsonValue, sentAt: new Date() });
    if (notice.channels.some((channel) => /email/i.test(channel)) && user.email) rows.push({ schoolId, userId: user.id, channel: "EMAIL", title: notice.title, body: notice.body, status: "QUEUED", metadata: { ...(metadata as object), email: user.email } as Prisma.InputJsonValue, sentAt: new Date() });
    if (rows.length > before) reached.add(user.id);
    else unreachable.push(fullName(user));
  }
  if (rows.length) await prisma.notificationLog.createMany({ data: rows });
  return { notified: reached.size, queued: rows.length, unreachable };
}
