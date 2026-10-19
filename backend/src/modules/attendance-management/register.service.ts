import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import {
  Access, type ArmRow, type Mark, MARK_LABEL, REASONS, type Tally, add, addDays, armName, currentTerm, dayOf, emptyTally, focusDay, fullName,
  isSchoolDay, iso, lagosClock, loadArms, loadPolicy, longDay, rate, schoolDaysBetween, shortDay, termCalendar, today, weekStart, round1
} from "./attendance.shared";
import { buildLedger, entryFor, isBreach, namesOf, teacherRecord } from "./ledger";
import { CasesService } from "./cases.service";

/**
 * The register itself: the school's day arm by arm, one arm's day, its week and its term, and the
 * act of taking one. A register is a statement about a day — it is written whole, once, and a
 * later change is a correction that keeps both values.
 */

const entrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().trim().optional(),
  reasonCode: z.string().trim().optional()
});

const submitSchema = z.object({
  date: z.string().min(8, "Choose the day this register is for."),
  entries: z.array(entrySchema).min(1, "Mark at least one child before saving."),
  backdateReason: z.string().trim().optional(),
  note: z.string().trim().optional(),
  /** When the marker opened the page — how long a register takes is measured from here. */
  openedAt: z.string().optional()
});

const draftSchema = z.object({ date: z.string().min(8), entries: z.array(entrySchema) });

/** The page-open time the browser reported, if it is believable: past, and within the last six hours. */
function openedFrom(text: string | undefined, now: Date): Date {
  const parsed = text ? new Date(text) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed > now || now.getTime() - parsed.getTime() > 6 * 3_600_000) return now;
  return parsed;
}

export type DayRow = {
  id: string;
  roll: number;
  name: string;
  adm: string;
  /** NONE for a child with no mark on that day — on the roll now, but not on that register. */
  mark: Mark | "NONE";
  markLabel: string;
  markedAt: string | null;
  reason: string | null;
  reasonCode: string | null;
  explained: boolean;
  termRate: number | null;
  guardian: { name: string; phone: string | null } | null;
  case: boolean;
};

@Injectable()
export class RegisterService {
  constructor(private readonly access: Access, private readonly cases: CasesService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "AttendanceRegister", entityId, metadata } });
  }

  private async termOrThrow(schoolId: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there is no register to read or take. Set one in School Configuration.");
    return term;
  }

  private async arm(schoolId: string, classId: string) {
    const room = await prisma.classRoom.findFirst({
      where: { id: classId, schoolId, deletedAt: null },
      select: { id: true, name: true, arm: true, classTeacherId: true, assistantClassTeacherId: true, classTeacher: { select: { firstName: true, lastName: true, phone: true, staffProfile: { select: { employeeNo: true, department: { select: { name: true } } } } } } }
    });
    if (!room) throw new NotFoundException("That arm is not in this school.");
    return { ...room, display: armName(room) };
  }

  /** The children on an arm's roll, in the order a register is read: surname first. */
  private async roster(schoolId: string, classId: string) {
    return prisma.student.findMany({
      where: { schoolId, currentClassId: classId, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        guardians: { select: { isPrimary: true, guardianId: true, guardian: { select: { firstName: true, lastName: true, phone: true } } } }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
  }

  private async termTallies(schoolId: string, termId: string, studentIds: string[]) {
    const rows = studentIds.length
      ? await prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId, subjectId: null, studentId: { in: studentIds } }, _count: { _all: true } })
      : [];
    const map = new Map<string, Tally>();
    for (const row of rows) {
      const tally = map.get(row.studentId) ?? emptyTally();
      add(tally, row.status, row._count._all);
      map.set(row.studentId, tally);
    }
    return map;
  }

  private guardianOf(links: Array<{ isPrimary: boolean; guardian: { firstName: string; lastName: string; phone: string | null } }>) {
    const link = links.find((entry) => entry.isPrimary) ?? links[0];
    return link ? { name: fullName(link.guardian), phone: link.guardian.phone } : null;
  }

  /* ───────────────────────── the whole school's day ───────────────────────── */

  async overview(session: SessionPayload, dateText?: string) {
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const now = today();
    const focus = dateText ? { date: dayOf(dateText), today: dayOf(dateText).getTime() === now.getTime(), note: null as string | null } : await focusDay(schoolId, term, now);
    const date = focus.date;
    const [arms, calendar, ledger] = await Promise.all([loadArms(schoolId), termCalendar(schoolId, term, now, policy.markCutoff), buildLedger(schoolId, term, policy)]);
    const marks = await prisma.studentAttendance.groupBy({ by: ["classId", "status"], where: { schoolId, date, subjectId: null }, _count: { _all: true } });
    const byArm = new Map<string, Tally>();
    for (const row of marks) {
      const tally = byArm.get(row.classId) ?? emptyTally();
      add(tally, row.status, row._count._all);
      byArm.set(row.classId, tally);
    }
    const termRows = await prisma.studentAttendance.groupBy({ by: ["classId", "status"], where: { schoolId, termId: term.id, subjectId: null }, _count: { _all: true } });
    const termByArm = new Map<string, Tally>();
    for (const row of termRows) {
      const tally = termByArm.get(row.classId) ?? emptyTally();
      add(tally, row.status, row._count._all);
      termByArm.set(row.classId, tally);
    }

    const cutoffPassed = !focus.today || (lagosClock(new Date()) ?? "00:00") > policy.markCutoff;
    const rows = arms.map((arm) => {
      const entry = entryFor(ledger, arm.id, date);
      const tally = byArm.get(arm.id) ?? emptyTally();
      const state = entry.state === "MISSING" ? "Unmarked" : entry.state === "DRAFT" ? "In progress" : "Marked";
      return {
        id: arm.id, name: arm.name, master: arm.master, masterId: arm.masterId, dept: arm.dept,
        /* a register states the roll of its own day; an arm not yet marked has today's */
        roll: state === "Marked" ? Math.max(entry.roll, tally.present + tally.late + tally.absent + tally.excused) || arm.roll : arm.roll, state,
        pastCutoff: state !== "Marked" && cutoffPassed,
        present: tally.present, late: tally.late, absent: tally.absent, excused: tally.excused,
        rate: state === "Marked" ? rate(tally, policy.lateCounts) : null,
        markedAt: entry.markedAt,
        breach: entry.state === "LATE" || entry.state === "BACKDATED",
        termRate: rate(termByArm.get(arm.id) ?? emptyTally(), policy.lateCounts)
      };
    });

    const marked = rows.filter((row) => row.state === "Marked");
    const sum = (key: "present" | "late" | "absent" | "excused") => marked.reduce((total, row) => total + row[key], 0);
    const accounted = marked.reduce((total, row) => total + row.present + row.late + row.absent + row.excused, 0);
    const countable = marked.reduce((total, row) => total + row.present + row.late + row.absent, 0);
    const day = {
      arms: rows.length, roll: rows.reduce((total, row) => total + row.roll, 0), marked: marked.length,
      partial: rows.filter((row) => row.state === "In progress").length,
      unmarked: rows.filter((row) => row.state === "Unmarked").length,
      pastCutoff: rows.filter((row) => row.pastCutoff).length,
      accounted, present: sum("present"), late: sum("late"), absent: sum("absent"), excused: sum("excused"),
      rate: countable ? round1(((sum("present") + (policy.lateCounts ? sum("late") : 0)) / countable) * 100) : null
    };

    /* by teacher: every form master and the arms they answer for */
    const masters = new Map<string, { id: string; name: string; dept: string | null; arms: ArmRow[] }>();
    for (const arm of arms) {
      if (!arm.masterId || !arm.master) continue;
      const entry = masters.get(arm.masterId) ?? { id: arm.masterId, name: arm.master, dept: arm.dept, arms: [] };
      entry.arms.push(arm);
      masters.set(arm.masterId, entry);
    }
    const teachers = Array.from(masters.values()).map((master) => {
      const record = teacherRecord(master.arms, ledger, calendar.days);
      return {
        id: master.id, name: master.name, dept: master.dept, arms: master.arms.map((arm) => arm.name), roll: master.arms.reduce((total, arm) => total + arm.roll, 0),
        marked: master.arms.filter((arm) => entryFor(ledger, arm.id, date).state !== "MISSING" && entryFor(ledger, arm.id, date).state !== "DRAFT").length,
        total: master.arms.length, punctuality: record.punctuality
      };
    });

    const explanations = await this.cases.explanations(session);
    const chronic = await this.cases.syncCases(schoolId, term, policy);

    return {
      date: iso(date), label: longDay(date), today: focus.today, note: focus.note,
      term: { id: term.id, name: term.name, start: iso(dayOf(term.startDate)), end: iso(dayOf(term.endDate)) },
      since: calendar.since ? iso(calendar.since) : null,
      policy, day, arms: rows, teachers,
      unassigned: arms.filter((arm) => !arm.masterId).map((arm) => arm.name),
      explanations, chronic: chronic.open,
      days: calendar.days.map((entry) => iso(entry)).reverse()
    };
  }

  /* ───────────────────────── one arm, one day ───────────────────────── */

  async day(session: SessionPayload, classId: string, dateText?: string) {
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const arm = await this.arm(schoolId, classId);
    const now = today();
    const date = dateText ? dayOf(dateText) : (await focusDay(schoolId, term, now)).date;
    const [roster, rows, calendar, ledger, openCases, corrections] = await Promise.all([
      this.roster(schoolId, classId),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId: null }, select: { studentId: true, status: true, reason: true, reasonCode: true, markedAt: true } }),
      termCalendar(schoolId, term, now, policy.markCutoff),
      buildLedger(schoolId, term, policy),
      prisma.attendanceCase.findMany({ where: { schoolId, termId: term.id, classId, status: "OPEN" }, select: { studentId: true } }),
      prisma.attendanceCorrection.count({ where: { schoolId, classId, date: { gte: term.startDate } } })
    ]);
    const tallies = await this.termTallies(schoolId, term.id, roster.map((student) => student.id));
    const marks = new Map(rows.map((row) => [row.studentId, row]));
    const cased = new Set(openCases.map((entry) => entry.studentId));
    const entry = entryFor(ledger, classId, date);

    const students: DayRow[] = roster.map((student, index) => {
      const row = marks.get(student.id);
      const mark = (row?.status ?? "NONE") as Mark | "NONE";
      const reason = row?.reason ?? null;
      return {
        id: student.id, roll: index + 1, name: fullName(student), adm: student.admissionNumber, mark, markLabel: mark === "NONE" ? "Not marked" : MARK_LABEL[mark],
        markedAt: lagosClock(row?.markedAt ?? null), reason, reasonCode: row?.reasonCode ?? null,
        explained: mark === "PRESENT" || mark === "LATE" || mark === "NONE" ? true : Boolean(reason || row?.reasonCode),
        termRate: rate(tallies.get(student.id) ?? emptyTally(), policy.lateCounts),
        guardian: this.guardianOf(student.guardians),
        case: cased.has(student.id)
      };
    });
    const taken = rows.length > 0;
    const count = (mark: Mark) => (taken ? students.filter((student) => student.mark === mark).length : 0);

    /* the last ten school days, so one bad day can be read in context */
    const recentDays = calendar.days.filter((entryDay) => entryDay <= now).slice(-10).reverse();
    const recentRows = recentDays.length
      ? await prisma.studentAttendance.groupBy({ by: ["date", "status"], where: { schoolId, classId, subjectId: null, date: { in: recentDays } }, _count: { _all: true } })
      : [];
    const recent = recentDays.map((entryDay) => {
      const tally = emptyTally();
      for (const row of recentRows) if (iso(row.date) === iso(entryDay)) add(tally, row.status, row._count._all);
      const state = entryFor(ledger, classId, entryDay);
      return { date: iso(entryDay), label: longDay(entryDay), ...tally, rate: state.state === "MISSING" ? null : rate(tally, policy.lateCounts), markedAt: state.markedAt, state: state.state };
    });

    const armRecord = teacherRecord([{ id: classId, name: arm.display, roll: roster.length, masterId: arm.classTeacherId, master: null, assistantId: null, dept: null }], ledger, calendar.days);
    const termRows = await prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, classId, termId: term.id, subjectId: null }, _count: { _all: true } });
    const termTally = emptyTally();
    for (const row of termRows) add(termTally, row.status, row._count._all);
    const owned = arm.classTeacherId ? await prisma.classRoom.findMany({ where: { schoolId, classTeacherId: arm.classTeacherId, id: { not: classId }, deletedAt: null }, select: { name: true, arm: true } }) : [];
    const registersTaken = calendar.days.filter((entryDay) => {
      const state = entryFor(ledger, classId, entryDay).state;
      return state !== "MISSING" && state !== "DRAFT";
    }).length;

    return {
      arm: { id: arm.id, name: arm.display, master: arm.classTeacher ? fullName(arm.classTeacher) : null, masterId: arm.classTeacherId, phone: arm.classTeacher?.phone ?? null, staffNo: arm.classTeacher?.staffProfile?.employeeNo ?? null, dept: arm.classTeacher?.staffProfile?.department?.name ?? null, others: owned.map(armName) },
      date: iso(date), label: longDay(date), isToday: date.getTime() === now.getTime(), isSchoolDay: isSchoolDay(term, date), taken,
      register: { state: entry.state, markedAt: entry.markedAt, by: entry.byId ? (await namesOf(schoolId, [entry.byId])).get(entry.byId) ?? null : null },
      students,
      counts: { roll: taken ? rows.length : students.length, present: count("PRESENT"), absent: count("ABSENT"), late: count("LATE"), excused: count("EXCUSED"), unexplained: taken ? students.filter((student) => (student.mark === "ABSENT") && !student.explained).length : 0 },
      rate: taken ? rate({ present: count("PRESENT"), late: count("LATE"), absent: count("ABSENT"), excused: count("EXCUSED") }, policy.lateCounts) : null,
      recent, termRate: rate(termTally, policy.lateCounts),
      record: { registers: `${registersTaken} of ${calendar.days.length}`, punctuality: armRecord.punctuality, corrections },
      days: calendar.days.map((entryDay) => ({ date: iso(entryDay), label: longDay(entryDay), state: entryFor(ledger, classId, entryDay).state })).reverse(),
      policy, term: { id: term.id, name: term.name }
    };
  }

  /* ───────────────────────── one arm, one week ───────────────────────── */

  async week(session: SessionPayload, classId: string, startText?: string) {
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const arm = await this.arm(schoolId, classId);
    const now = today();
    const calendar = await termCalendar(schoolId, term, now, policy.markCutoff);
    const anchor = startText ? dayOf(startText) : weekStart(calendar.days[calendar.days.length - 1] ?? now);
    const start = weekStart(anchor);
    const dates = [0, 1, 2, 3, 4].map((offset) => addDays(start, offset));
    const [roster, rows, ledger] = await Promise.all([
      this.roster(schoolId, classId),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, subjectId: null, date: { gte: start, lte: addDays(start, 4) } }, select: { studentId: true, status: true, reason: true, date: true } }),
      buildLedger(schoolId, term, policy)
    ]);
    const calendarSet = new Set(calendar.days.map((entry) => iso(entry)));
    const days = dates.map((date) => {
      const entry = entryFor(ledger, classId, date);
      const sits = calendarSet.has(iso(date));
      const unrecorded = !sits && isSchoolDay(term, date) && date <= now && date >= calendar.from;
      const tally = emptyTally();
      for (const row of rows) if (iso(row.date) === iso(date)) add(tally, row.status);
      const taken = entry.state !== "MISSING" && entry.state !== "DRAFT";
      return {
        date: iso(date), name: date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }), label: shortDay(date),
        sits, unrecorded, taken, missed: sits && !taken, roll: taken ? entry.roll || roster.length : roster.length,
        ...tally, rate: taken ? rate(tally, policy.lateCounts) : null, markedAt: entry.markedAt, state: entry.state
      };
    });
    const sat = days.filter((day) => day.sits);
    const taken = days.filter((day) => day.taken);
    const weekTally = emptyTally();
    for (const row of rows) add(weekTally, row.status);
    const tallies = await this.termTallies(schoolId, term.id, roster.map((student) => student.id));
    const names = new Map(roster.map((student) => [student.id, student]));
    const perChild = new Map<string, { id: string; absent: number; late: number; reasons: string[] }>();
    for (const row of rows) {
      if (row.status === "PRESENT") continue;
      const entry = perChild.get(row.studentId) ?? { id: row.studentId, absent: 0, late: 0, reasons: [] };
      if (row.status === "LATE") entry.late += 1;
      else entry.absent += 1;
      if (row.reason) entry.reasons.push(`${row.date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}: ${row.reason}`);
      perChild.set(row.studentId, entry);
    }
    const who = Array.from(perChild.values()).map((entry) => {
      const student = names.get(entry.id);
      return { id: entry.id, name: student ? fullName(student) : "—", adm: student?.admissionNumber ?? "", absent: entry.absent, late: entry.late, reasons: entry.reasons, termRate: rate(tallies.get(entry.id) ?? emptyTally(), policy.lateCounts) };
    });
    const before = addDays(start, -7);
    const after = addDays(start, 7);
    return {
      arm: { id: arm.id, name: arm.display, master: arm.classTeacher ? fullName(arm.classTeacher) : null, masterId: arm.classTeacherId },
      start: iso(start), label: `${shortDay(start)} – ${shortDay(addDays(start, 4))} ${start.getUTCFullYear()}`,
      previous: calendar.from <= before ? iso(before) : null, next: after <= now && after <= calendar.to ? iso(after) : null,
      days, sat: sat.length, taken: taken.length,
      week: { rate: rate(weekTally, policy.lateCounts), absent: weekTally.absent, late: weekTally.late, excused: weekTally.excused },
      who, policy, since: calendar.since ? iso(calendar.since) : null, term: { id: term.id, name: term.name }
    };
  }

  /* ───────────────────────── one arm, the whole term ───────────────────────── */

  async trend(session: SessionPayload, classId: string) {
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const arm = await this.arm(schoolId, classId);
    const now = today();
    const calendar = await termCalendar(schoolId, term, now, policy.markCutoff);
    const [roster, rows, ledger, cases] = await Promise.all([
      this.roster(schoolId, classId),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, termId: term.id, subjectId: null }, select: { studentId: true, status: true, date: true, markedById: true } }),
      buildLedger(schoolId, term, policy),
      prisma.attendanceCase.findMany({ where: { schoolId, classId, termId: term.id }, select: { studentId: true, status: true, outcome: true } })
    ]);
    const markerNames = await namesOf(schoolId, Array.from(new Set(rows.map((row) => row.markedById))));
    const weeks = new Map<string, { start: Date; days: Date[]; tally: Tally; missed: number; markers: Set<string> }>();
    for (const day of calendar.days) {
      const key = iso(weekStart(day));
      const week = weeks.get(key) ?? { start: weekStart(day), days: [], tally: emptyTally(), missed: 0, markers: new Set<string>() };
      week.days.push(day);
      const state = entryFor(ledger, classId, day);
      if (state.state === "MISSING" || state.state === "DRAFT") week.missed += 1;
      if (state.byId && markerNames.get(state.byId)) week.markers.add(markerNames.get(state.byId) as string);
      weeks.set(key, week);
    }
    for (const row of rows) {
      const week = weeks.get(iso(weekStart(dayOf(row.date))));
      if (week) add(week.tally, row.status);
    }
    const list = Array.from(weeks.values()).sort((a, b) => a.start.getTime() - b.start.getTime()).map((week, index) => ({
      n: index + 1, key: iso(week.start), label: `Week ${index + 1}`, dates: `${shortDay(week.start)} – ${shortDay(week.days[week.days.length - 1])}`,
      days: week.days.length, rate: rate(week.tally, policy.lateCounts), absent: week.tally.absent, late: week.tally.late, excused: week.tally.excused,
      missed: week.missed, markers: Array.from(week.markers)
    }));
    const termTally = emptyTally();
    for (const row of rows) add(termTally, row.status);
    const termRate = rate(termTally, policy.lateCounts);
    const perStudent = new Map<string, Tally>();
    for (const row of rows) {
      const tally = perStudent.get(row.studentId) ?? emptyTally();
      add(tally, row.status);
      perStudent.set(row.studentId, tally);
    }
    const caseOf = new Map(cases.map((entry) => [entry.studentId, entry]));
    const students = roster.map((student) => {
      const tally = perStudent.get(student.id) ?? emptyTally();
      const studentRate = rate(tally, policy.lateCounts);
      const flag = studentRate === null ? "No record" : studentRate < policy.chronic ? "Chronic" : studentRate < policy.watch ? "Falling" : studentRate < policy.target ? "Watch" : "No concern";
      return { id: student.id, name: fullName(student), adm: student.admissionNumber, days: tally.present + tally.late + tally.absent + tally.excused, absent: tally.absent, late: tally.late, excused: tally.excused, rate: studentRate, flag, case: caseOf.get(student.id)?.status ?? null };
    }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
    const rated = list.filter((week) => week.rate !== null);
    const best = rated.slice().sort((a, b) => (b.rate as number) - (a.rate as number))[0] ?? null;
    const worst = rated.slice().sort((a, b) => (a.rate as number) - (b.rate as number))[0] ?? null;
    return {
      arm: { id: arm.id, name: arm.display, master: arm.classTeacher ? fullName(arm.classTeacher) : null, masterId: arm.classTeacherId },
      term: { id: term.id, name: term.name }, since: calendar.since ? iso(calendar.since) : null,
      weeks: list, rate: termRate, schoolDays: calendar.days.length,
      best: best && { label: best.label, dates: best.dates, rate: best.rate }, worst: worst && { label: worst.label, dates: worst.dates, rate: worst.rate },
      below: rated.filter((week) => (week.rate as number) < policy.target).length,
      missed: list.reduce((total, week) => total + week.missed, 0),
      students, roll: roster.length,
      counts: { chronic: students.filter((student) => student.flag === "Chronic").length, falling: students.filter((student) => student.flag === "Falling").length, strong: students.filter((student) => (student.rate ?? 0) > 95).length },
      policy
    };
  }

  /* ───────────────────────── taking a register ───────────────────────── */

  async markState(session: SessionPayload, classId: string, dateText?: string) {
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const arm = await this.arm(schoolId, classId);
    const now = today();
    const date = dateText ? dayOf(dateText) : (await focusDay(schoolId, term, now)).date;
    const [roster, existing, register, calendar] = await Promise.all([
      this.roster(schoolId, classId),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId: null }, select: { studentId: true, status: true, reason: true, reasonCode: true } }),
      prisma.attendanceRegister.findUnique({ where: { classId_date: { classId, date } } }),
      termCalendar(schoolId, term, now, policy.markCutoff)
    ]);
    const tallies = await this.termTallies(schoolId, term.id, roster.map((student) => student.id));
    const saved = new Map(existing.map((row) => [row.studentId, row]));
    const draft = (register?.status === "DRAFT" ? (register.draft ?? {}) : {}) as Record<string, { status?: string; reason?: string; reasonCode?: string }>;
    const submitted = register?.status === "SUBMITTED" || existing.length > 0;
    const prior = date < now;
    let whyNot: string | null = null;
    try {
      this.access.assertMarker(session, arm);
    } catch (error) {
      whyNot = error instanceof Error ? error.message : "You cannot mark this register.";
    }
    if (!whyNot && date > now) whyNot = "A register cannot be taken for a day that has not happened.";
    if (!whyNot && !isSchoolDay(term, date)) whyNot = `${longDay(date)} is not a school day in ${term.name}.`;
    if (!whyNot && submitted && prior) whyNot = "This register closed to free edits at midnight. A correction needs a reason and an approval.";
    const canBackdate = await this.access.can(session, "attendance.mark.approve");
    if (!whyNot && !submitted && prior && !canBackdate) whyNot = "This day's register was never taken. Backdating one needs a school administrator's approval rights.";
    return {
      arm: { id: arm.id, name: arm.display, master: arm.classTeacher ? fullName(arm.classTeacher) : null },
      date: iso(date), label: longDay(date), term: { id: term.id, name: term.name },
      mode: submitted ? "submitted" : register?.status === "DRAFT" ? "draft" : "new",
      startedAt: lagosClock(register?.startedAt ?? null), markedAt: lagosClock(register?.submittedAt ?? null),
      backdated: prior && !submitted, canBackdate, whyNot,
      editable: !whyNot,
      students: roster.map((student, index) => {
        const mine = saved.get(student.id);
        const staged = draft[student.id];
        return {
          id: student.id, roll: index + 1, name: fullName(student), adm: student.admissionNumber,
          status: (mine?.status ?? (staged?.status as Mark | undefined) ?? null) as Mark | null,
          reason: mine?.reason ?? staged?.reason ?? "", reasonCode: mine?.reasonCode ?? staged?.reasonCode ?? "",
          termRate: rate(tallies.get(student.id) ?? emptyTally(), policy.lateCounts)
        };
      }),
      reasons: REASONS, policy, since: calendar.since ? iso(calendar.since) : null,
      days: schoolDaysBetween(term, dayOf(term.startDate), now < dayOf(term.endDate) ? now : dayOf(term.endDate)).map((entry) => iso(entry)).reverse().slice(0, 40)
    };
  }

  async saveDraft(session: SessionPayload, classId: string, body: unknown) {
    const input = draftSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const arm = await this.arm(schoolId, classId);
    this.access.assertMarker(session, arm);
    const date = dayOf(input.date);
    if (date > today()) throw new BadRequestException("A register cannot be taken for a day that has not happened.");
    if (!isSchoolDay(term, date)) throw new BadRequestException(`${longDay(date)} is not a school day in ${term.name}.`);
    const existing = await prisma.attendanceRegister.findUnique({ where: { classId_date: { classId, date } } });
    if (existing?.status === "SUBMITTED") throw new BadRequestException("This register has already been submitted — correct it instead of saving a draft.");
    const roll = await prisma.student.count({ where: { schoolId, currentClassId: classId, status: "ACTIVE" } });
    const draft = Object.fromEntries(input.entries.map((entry) => [entry.studentId, { status: entry.status, reason: entry.reason ?? "", reasonCode: entry.reasonCode ?? "" }])) as Prisma.InputJsonValue;
    const saved = await prisma.attendanceRegister.upsert({
      where: { classId_date: { classId, date } },
      update: { draft, markedById: session.userId, roll },
      create: { schoolId, classId, termId: term.id, date, status: "DRAFT", draft, markedById: session.userId, roll }
    });
    return { id: saved.id, saved: input.entries.length, roll };
  }

  /**
   * `capturedAt` is for a register taken on a device with no connection: it is judged as of the moment it was taken, so one
   * marked on Tuesday and synced on Wednesday is a Tuesday register — not a backdated one — and is not "late" for arriving late.
   */
  async submit(session: SessionPayload, classId: string, body: unknown, opts: { capturedAt?: Date } = {}) {
    const input = submitSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const arm = await this.arm(schoolId, classId);
    this.access.assertMarker(session, arm);
    const date = dayOf(input.date);
    const now = opts.capturedAt ? today(opts.capturedAt) : today();
    if (date > now) throw new BadRequestException("A register cannot be taken for a day that has not happened.");
    if (!isSchoolDay(term, date)) throw new BadRequestException(`${longDay(date)} is not a school day in ${term.name}.`);

    const roster = await this.roster(schoolId, classId);
    const onRoll = new Map(roster.map((student) => [student.id, student]));
    const strays = input.entries.filter((entry) => !onRoll.has(entry.studentId));
    if (strays.length) throw new BadRequestException(`${strays.length} of those children are not on ${arm.display}'s roll.`);
    const given = new Map(input.entries.map((entry) => [entry.studentId, entry]));
    const missing = roster.filter((student) => !given.has(student.id));
    if (missing.length) throw new BadRequestException(`${missing.length} ${missing.length === 1 ? "child has" : "children have"} no mark. An unmarked child is not a present one — set every row.`);

    const existingRows = await prisma.studentAttendance.findMany({ where: { schoolId, classId, date, subjectId: null }, select: { id: true, studentId: true, status: true, reason: true } });
    const register = await prisma.attendanceRegister.findUnique({ where: { classId_date: { classId, date } } });
    const taken = register?.status === "SUBMITTED" || existingRows.length > 0;
    const prior = date < now;

    if (taken && prior) throw new BadRequestException("This register closed to free edits at midnight. Request a correction, with a reason, and an approver will decide it.");
    let backdateReason: string | null = null;
    if (!taken && prior) {
      if (!(await this.access.can(session, "attendance.mark.approve"))) throw new BadRequestException("Backdating a register that was never taken needs a school administrator's approval rights.");
      if ((input.backdateReason ?? "").length < 8) throw new BadRequestException("Say why this register is being taken late — a backdated register always carries its reason.");
      backdateReason = input.backdateReason as string;
    }

    const stamp = opts.capturedAt ?? new Date();
    const byStudent = new Map(existingRows.map((row) => [row.studentId, row]));
    const changes: Array<{ studentId: string; from: string; to: string }> = [];
    const creates: Prisma.StudentAttendanceCreateManyInput[] = [];
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    for (const entry of input.entries) {
      const mine = byStudent.get(entry.studentId);
      const reason = entry.status === "ABSENT" || entry.status === "EXCUSED" || entry.status === "LATE" ? entry.reason || entry.reasonCode || null : null;
      if (mine) {
        if (mine.status !== entry.status) changes.push({ studentId: entry.studentId, from: mine.status, to: entry.status });
        if (mine.status !== entry.status || (mine.reason ?? null) !== reason) {
          operations.push(prisma.studentAttendance.update({ where: { id: mine.id }, data: { status: entry.status, reason, reasonCode: entry.reasonCode || null, markedById: session.userId, markedAt: stamp } }));
        }
      } else {
        creates.push({ schoolId, studentId: entry.studentId, classId, termId: term.id, markedById: session.userId, date, status: entry.status, reason, reasonCode: entry.reasonCode || null, markedAt: stamp });
      }
    }
    const clock = lagosClock(stamp) ?? "00:00";
    const late = !prior && clock > policy.markCutoff;
    await prisma.$transaction([
      ...operations,
      ...(creates.length ? [prisma.studentAttendance.createMany({ data: creates })] : []),
      ...changes.map((change) => prisma.attendanceCorrection.create({
        data: { schoolId, classId, studentId: change.studentId, date, fromStatus: change.from, toStatus: change.to, kind: "SAME_DAY", reasonCode: "Same-day edit", explanation: input.note || "Corrected on the day it was taken.", status: "APPLIED", requestedById: session.userId, decidedById: session.userId, decidedAt: stamp }
      })),
      prisma.attendanceRegister.upsert({
        where: { classId_date: { classId, date } },
        update: taken ? { roll: roster.length } : { status: "SUBMITTED", draft: Prisma.DbNull, markedById: session.userId, submittedAt: stamp, roll: roster.length, late, backdated: prior, backdateReason },
        create: { schoolId, classId, termId: term.id, date, status: "SUBMITTED", markedById: session.userId, startedAt: register?.startedAt ?? openedFrom(input.openedAt, stamp), submittedAt: stamp, roll: roster.length, late, backdated: prior, backdateReason }
      })
    ]);

    /* the families of absent children are told, as the school's own alert rule says */
    let told = 0;
    if (!taken) {
      const absent = input.entries.filter((entry) => entry.status === "ABSENT");
      for (const entry of absent) {
        const student = onRoll.get(entry.studentId);
        const primary = student?.guardians.find((link) => link.isPrimary) ?? student?.guardians[0];
        if (!student || !primary) continue;
        const result = await notifyGuardian(schoolId, primary.guardianId, "Attendance alert", `${fullName(student)} was marked absent in ${arm.display} on ${longDay(date)}. The school will confirm by ${policy.guardianNotifyAt}.`, [policy.alertChannel, "In-app"]);
        if (result.sent.length) told += 1;
      }
    }
    await this.cases.syncCases(schoolId, term, policy);
    await this.audit(session, taken ? AuditAction.UPDATE : AuditAction.CREATE, register?.id ?? `${classId}:${iso(date)}`, {
      summary: `${taken ? "Register corrected" : "Register submitted"} · ${arm.display} · ${iso(date)}`,
      present: input.entries.filter((entry) => entry.status === "PRESENT").length, absent: input.entries.filter((entry) => entry.status === "ABSENT").length,
      late: input.entries.filter((entry) => entry.status === "LATE").length, excused: input.entries.filter((entry) => entry.status === "EXCUSED").length,
      changed: changes.length, backdated: prior && !taken, backdateReason, markedLate: late
    });
    return {
      classId, date: iso(date), arm: arm.display, marked: input.entries.length, corrected: changes.length, backdated: prior && !taken, late, markedAt: clock, guardiansTold: told,
      fields: [["Taken at", clock], ["Children", String(input.entries.length)], ...(taken ? [["Marks changed", String(changes.length)]] : [["Families told of an absence", String(told)]]), ...(late ? [["Cutoff", `Taken after ${policy.markCutoff} — recorded as late`]] : [])]
    };
  }

  /** Days a school sat that an arm has no register for — the unit compliance is measured in. */
  async unmarkedDays(schoolId: string, classId: string) {
    const term = await this.termOrThrow(schoolId);
    const policy = await loadPolicy(schoolId);
    const calendar = await termCalendar(schoolId, term);
    const ledger = await buildLedger(schoolId, term, policy);
    return calendar.days.filter((day) => isBreach(entryFor(ledger, classId, day).state)).length;
  }

}
