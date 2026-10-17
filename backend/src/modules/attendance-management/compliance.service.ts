import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  type ArmRow, type Tally, add, addDays, armName, currentTerm, dayOf, emptyTally, focusDay, fullName, iso, lagosClock,
  loadArms, loadPolicy, longDay, rate, shortDay, termCalendar, today, weekStart
} from "./attendance.shared";
import { buildLedger, entryFor, isBreach, teacherRecord } from "./ledger";
import { CasesService } from "./cases.service";
import { CorrectionsService } from "./corrections.service";

/**
 * Compliance is about the adults, not the children: who marked, when, and who broke the school's
 * own rule. The Log is the children over time — a trend per arm, who needs attention, and what the
 * school has done about it.
 */

const reassignSchema = z.object({
  arms: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  /** Everything these teachers currently take, moved together. */
  teachers: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  teacher: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  tell: z.coerce.boolean().default(true)
});

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

@Injectable()
export class ComplianceService {
  constructor(private readonly cases: CasesService, private readonly corrections: CorrectionsService) {}

  /* ───────────────────────── compliance ───────────────────────── */

  async compliance(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there is nothing to hold anyone to.");
    const policy = await loadPolicy(schoolId);
    const now = today();
    const [arms, calendar, ledger, focus, registers] = await Promise.all([
      loadArms(schoolId), termCalendar(schoolId, term, now, policy.markCutoff), buildLedger(schoolId, term, policy), focusDay(schoolId, term, now),
      prisma.attendanceRegister.findMany({ where: { schoolId, termId: term.id, status: "SUBMITTED", submittedAt: { not: null } }, select: { startedAt: true, submittedAt: true } })
    ]);
    const clock = lagosClock(new Date()) ?? "00:00";
    const lastFive = calendar.days.slice(-5);
    const date = focus.date;
    const cutoffPassed = !focus.today || clock > policy.markCutoff;

    const byMaster = new Map<string, { id: string; name: string; dept: string | null; arms: ArmRow[] }>();
    for (const arm of arms) {
      if (!arm.masterId || !arm.master) continue;
      const entry = byMaster.get(arm.masterId) ?? { id: arm.masterId, name: arm.master, dept: arm.dept, arms: [] };
      entry.arms.push(arm);
      byMaster.set(arm.masterId, entry);
    }

    /* five calendar weeks back: a "repeat breacher" broke the rule in three of them */
    const weeks = Array.from(new Set(calendar.days.map((day) => iso(weekStart(day))))).slice(-5);
    const teachers = Array.from(byMaster.values()).map((master) => {
      const record = teacherRecord(master.arms, ledger, calendar.days);
      const week = teacherRecord(master.arms, ledger, lastFive);
      const breachedWeeks = weeks.filter((key) => teacherRecord(master.arms, ledger, calendar.days.filter((day) => iso(weekStart(day)) === key)).breached > 0).length;
      const today = master.arms.map((arm) => entryFor(ledger, arm.id, date).state);
      const done = today.filter((state) => state !== "MISSING" && state !== "DRAFT").length;
      const pattern = breachedWeeks >= 3 ? "Repeat" : record.breached > 0 ? "Occasional" : record.timed ? "Clean" : "No record";
      return {
        id: master.id, name: master.name, dept: master.dept, arms: master.arms.map((arm) => arm.name), roll: master.arms.reduce((total, arm) => total + arm.roll, 0),
        state: done === master.arms.length ? "Marked" : done || today.includes("DRAFT") ? "In progress" : "Unmarked",
        todayMissing: master.arms.length - done,
        week: week.breached, term: record.breached, owed: record.owed, punctuality: record.punctuality, pattern, breachedWeeks
      };
    }).sort((a, b) => (a.punctuality ?? 101) - (b.punctuality ?? 101));

    /* an arm with nobody named still owes a register every day; the school-wide figures count it */
    const everyone = teacherRecord(arms, ledger, calendar.days);
    const everyoneWeek = teacherRecord(arms, ledger, lastFive);
    const termOwed = everyone.owed;
    const termBreached = everyone.breached;

    /* the unit of work is an arm-day: who has not marked the day being looked at */
    const tracker = arms.map((arm) => {
      const entry = entryFor(ledger, arm.id, date);
      const state = entry.state === "MISSING" ? "Not started" : entry.state === "DRAFT" ? "In progress" : "Marked";
      return {
        id: arm.id, name: arm.name, roll: arm.roll, owner: arm.master ?? "Nobody named", ownerId: arm.masterId, role: arm.master ? "Form master" : "No form master",
        state, overdue: state !== "Marked" && cutoffPassed, started: entry.startedAt && state === "In progress" ? lagosClock(entry.startedAt) : null, markedAt: entry.markedAt,
        late: entry.state === "LATE" || entry.state === "BACKDATED"
      };
    }).sort((a, b) => Number(a.state === "Marked") - Number(b.state === "Marked"));

    const missing = arms.map((arm) => ({ name: arm.name, days: calendar.days.filter((day) => isBreach(entryFor(ledger, arm.id, day).state) && entryFor(ledger, arm.id, day).state === "MISSING").length })).filter((entry) => entry.days > 0).sort((a, b) => b.days - a.days);
    const backdated = (await this.corrections.list(session)).backdated;
    const spans = registers.map((entry) => ((entry.submittedAt as Date).getTime() - entry.startedAt.getTime()) / 1000).filter((seconds) => seconds > 5 && seconds < 3 * 3600);
    const middle = median(spans);

    return {
      date: iso(date), label: longDay(date), today: focus.today, note: focus.note, cutoff: policy.markCutoff, term: { id: term.id, name: term.name },
      since: calendar.since ? iso(calendar.since) : null, schoolDays: calendar.days.length,
      kpis: {
        unmarked: tracker.filter((row) => row.overdue).length, notYet: tracker.filter((row) => row.state !== "Marked" && !row.overdue).length,
        week: everyoneWeek.breached, weekTeachers: teachers.filter((teacher) => teacher.week > 0).length,
        term: termBreached, owed: termOwed, compliance: termOwed ? 100 - Math.round((termBreached / termOwed) * 100) : null,
        repeat: teachers.filter((teacher) => teacher.pattern === "Repeat").length, median: middle === null ? null : Math.round(middle), medianOf: spans.length
      },
      teachers, tracker, missing, backdated, unassigned: arms.filter((arm) => !arm.masterId).map((arm) => arm.name)
    };
  }

  async teacher(session: SessionPayload, userId: string) {
    const schoolId = session.schoolId;
    const overview = await this.compliance(session);
    const row = overview.teachers.find((teacher) => teacher.id === userId);
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true, staffProfile: { select: { employeeNo: true, department: { select: { name: true } } } } } });
    if (!user) throw new NotFoundException("That person is not on the staff.");
    const corrections = await prisma.attendanceCorrection.count({ where: { schoolId, requestedById: userId } });
    const lastNote = await prisma.notificationLog.findFirst({ where: { schoolId, userId, title: { startsWith: "Attendance" } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
    return { id: user.id, name: fullName(user), role: user.role, phone: user.phone, email: user.email, staffNo: user.staffProfile?.employeeNo ?? null, dept: user.staffProfile?.department?.name ?? row?.dept ?? null, row: row ?? null, corrections, lastNotified: lastNote?.sentAt ? iso(lastNote.sentAt) : null, medianSchool: overview.kpis.median, cutoff: overview.cutoff, target: null };
  }

  async options(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [staff, students, arms, school] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId, isActive: true, deletedAt: null, role: { notIn: ["STUDENT", "PARENT", "PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as never[] } },
        select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ firstName: "asc" }]
      }),
      prisma.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 800 }),
      loadArms(schoolId),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    ]);
    return {
      school: school?.name ?? "",
      staff: staff.map((user) => ({ id: user.id, name: fullName(user), role: user.role })),
      students: students.map((student) => ({ id: student.id, name: fullName(student), adm: student.admissionNumber, arm: student.currentClass ? armName(student.currentClass) : "No arm yet" })),
      arms: arms.map((arm) => ({ id: arm.id, name: arm.name, master: arm.master }))
    };
  }

  async reassign(session: SessionPayload, body: unknown) {
    const input = reassignSchema.parse(body);
    const schoolId = session.schoolId;
    const teacher = await prisma.user.findFirst({ where: { id: input.teacher, schoolId, isActive: true, deletedAt: null }, select: { id: true, firstName: true, lastName: true, role: true } });
    if (!teacher) throw new BadRequestException("That person is not on this school's staff.");
    if (["STUDENT", "PARENT"].includes(teacher.role)) throw new BadRequestException("A form master has to be a member of staff.");
    const rooms = await prisma.classRoom.findMany({ where: { schoolId, deletedAt: null, OR: [{ id: { in: input.arms } }, { classTeacherId: { in: input.teachers } }] }, select: { id: true, name: true, arm: true, classTeacherId: true } });
    if (!rooms.length) throw new BadRequestException("Choose at least one arm.");
    await prisma.classRoom.updateMany({ where: { id: { in: rooms.map((room) => room.id) } }, data: { classTeacherId: teacher.id } });
    if (input.tell) {
      await prisma.notificationLog.create({ data: { schoolId, userId: teacher.id, channel: "IN_APP", title: "Attendance · you now take a register", body: `You are now the form master of ${rooms.map(armName).join(", ")}. Its register is yours to take every school day before the cutoff.`, status: "QUEUED", sentAt: new Date() } });
    }
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "ClassRoom", entityId: rooms[0].id, metadata: { summary: `Form master changed · ${rooms.map(armName).join(", ")} → ${fullName(teacher)}` } } });
    return { arms: rooms.length, teacher: fullName(teacher) };
  }

  /* ───────────────────────── the log ───────────────────────── */

  async log(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current.");
    const policy = await loadPolicy(schoolId);
    const now = today();
    const calendar = await termCalendar(schoolId, term, now, policy.markCutoff);
    const [arms, rows] = await Promise.all([
      loadArms(schoolId),
      prisma.studentAttendance.findMany({ where: { schoolId, termId: term.id, subjectId: null }, select: { classId: true, studentId: true, status: true, date: true } })
    ]);
    await this.cases.syncCases(schoolId, term, policy);

    const weekKeys = Array.from(new Set(calendar.days.map((day) => iso(weekStart(day))))).slice(-5);
    const byArmWeek = new Map<string, Map<string, Tally>>();
    const byArm = new Map<string, Tally>();
    const byStudent = new Map<string, Tally>();
    const school = emptyTally();
    for (const row of rows) {
      add(school, row.status);
      const armTally = byArm.get(row.classId) ?? emptyTally();
      add(armTally, row.status);
      byArm.set(row.classId, armTally);
      const studentTally = byStudent.get(row.studentId) ?? emptyTally();
      add(studentTally, row.status);
      byStudent.set(row.studentId, studentTally);
      const key = iso(weekStart(dayOf(row.date)));
      const weeks = byArmWeek.get(row.classId) ?? new Map<string, Tally>();
      const tally = weeks.get(key) ?? emptyTally();
      add(tally, row.status);
      weeks.set(key, tally);
      byArmWeek.set(row.classId, weeks);
    }

    const trend = arms.map((arm) => {
      const weeks = weekKeys.map((key) => rate(byArmWeek.get(arm.id)?.get(key) ?? emptyTally(), policy.lateCounts));
      const known = weeks.filter((value): value is number => value !== null);
      const recent = known.slice(-2);
      const earlier = known.slice(-4, -2);
      const delta = recent.length && earlier.length ? recent.reduce((a, b) => a + b, 0) / recent.length - earlier.reduce((a, b) => a + b, 0) / earlier.length : 0;
      return { id: arm.id, name: arm.name, master: arm.master, weeks, term: rate(byArm.get(arm.id) ?? emptyTally(), policy.lateCounts), direction: delta <= -1 ? "Falling" : delta >= 1 ? "Rising" : "Steady" };
    }).sort((a, b) => (a.term ?? 101) - (b.term ?? 101));
    const ranked = trend.filter((entry) => entry.term !== null);

    const cases = await prisma.attendanceCase.findMany({ where: { schoolId, termId: term.id } });
    const caseOf = new Map(cases.map((entry) => [entry.studentId, entry]));
    const students = await prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", id: { in: Array.from(byStudent.keys()) } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { id: true, name: true, arm: true } }, guardians: { select: { guardianId: true, guardian: { select: { phone: true } } } } }
    });
    const contacts = await prisma.guardianContact.groupBy({ by: ["guardianId"], where: { schoolId, kind: { startsWith: "Attendance" } }, _count: { _all: true } });
    const contactCount = new Map(contacts.map((entry) => [entry.guardianId, entry._count._all]));
    const flagged = students.map((student) => {
      const tally = byStudent.get(student.id) ?? emptyTally();
      const value = rate(tally, policy.lateCounts);
      const told = student.guardians.reduce((total, link) => total + (contactCount.get(link.guardianId) ?? 0), 0);
      const reachable = student.guardians.some((link) => Boolean(link.guardian.phone?.trim()));
      const flag = value === null ? "No record" : value < policy.chronic ? "Chronic" : value < policy.watch ? "Falling" : value < policy.target ? "Watch" : "No concern";
      return {
        id: student.id, name: fullName(student), adm: student.admissionNumber, arm: student.currentClass ? armName(student.currentClass) : "No arm yet", classId: student.currentClass?.id ?? null,
        days: tally.present + tally.late + tally.absent + tally.excused, absent: tally.absent, late: tally.late, excused: tally.excused, rate: value, flag,
        case: caseOf.get(student.id)?.status ?? null, told, reachable
      };
    }).filter((entry) => entry.flag === "Chronic" || entry.flag === "Falling" || entry.flag === "Watch").sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

    const corrections = await this.corrections.list(session);
    return {
      term: { id: term.id, name: term.name }, since: calendar.since ? iso(calendar.since) : null, schoolDays: calendar.days.length, plannedDays: schoolDaysPlanned(term),
      policy,
      kpis: {
        rate: rate(school, policy.lateCounts), best: ranked[ranked.length - 1] ?? null, worst: ranked[0] ?? null,
        chronic: cases.filter((entry) => entry.status === "OPEN").length, closed: cases.filter((entry) => entry.status === "CLOSED").length,
        formal: cases.filter((entry) => entry.status === "OPEN" && entry.automatic).length,
        corrections: corrections.totals
      },
      weeks: weekKeys.map((key) => shortDay(new Date(`${key}T00:00:00Z`))),
      trend, flagged, corrections: corrections.rows, backdated: corrections.backdated,
      roll: arms.reduce((total, arm) => total + arm.roll, 0)
    };
  }
}

function schoolDaysPlanned(term: { startDate: Date; endDate: Date; breakStart: Date | null; breakEnd: Date | null; schoolDays: string[]; id: string; name: string }) {
  let count = 0;
  const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  for (let day = dayOf(term.startDate); day <= dayOf(term.endDate); day = addDays(day, 1)) {
    if (!term.schoolDays.includes(names[day.getUTCDay()])) continue;
    if (term.breakStart && term.breakEnd && day >= dayOf(term.breakStart) && day <= dayOf(term.breakEnd)) continue;
    count += 1;
  }
  return count;
}
