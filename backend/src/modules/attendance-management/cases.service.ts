import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import { daysSince } from "../student-records/records.shared";
import {
  CASE_OUTCOMES, type Policy, type Tally, type TermLike, add, armName, currentTerm, dayOf, emptyTally, fullName, iso, longDay, loadPolicy, rate, shortDay, termCalendar, today
} from "./attendance.shared";

/**
 * Chronic absence as a case, not a number: it opens itself below the school's threshold, someone
 * contacts the family, and it cannot be closed without a recorded outcome. Also where a
 * guardian's explanation is decided — the guardian submits, the school decides.
 */

const closeSchema = z.object({
  outcome: z.string().trim().min(3, "Choose the outcome — a case cannot be closed without one."),
  note: z.string().trim().optional()
});

const decideSchema = z.object({
  decision: z.string().min(1),
  dates: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  note: z.string().trim().optional(),
  tell: z.coerce.boolean().default(true)
});

const flagOf = (value: number | null, policy: Policy) => (value === null ? "No record" : value < policy.chronic ? "Chronic" : value < policy.watch ? "Falling" : value < policy.target ? "Watch" : "No concern");

@Injectable()
export class CasesService {
  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /** Per-child term tallies, for everyone or one arm. */
  async studentTallies(schoolId: string, termId: string, classId?: string) {
    const rows = await prisma.studentAttendance.groupBy({
      by: ["studentId", "status"],
      where: { schoolId, termId, subjectId: null, ...(classId ? { classId } : {}) },
      _count: { _all: true }
    });
    const map = new Map<string, Tally>();
    for (const row of rows) {
      const tally = map.get(row.studentId) ?? emptyTally();
      add(tally, row.status, row._count._all);
      map.set(row.studentId, tally);
    }
    return map;
  }

  /**
   * Cases open themselves. A child below the threshold, with enough days on record to mean it,
   * gets a case the first time anyone looks — never a number someone has to remember to chase.
   */
  async syncCases(schoolId: string, term: TermLike, policy: Policy) {
    const [tallies, existing, students] = await Promise.all([
      this.studentTallies(schoolId, term.id),
      prisma.attendanceCase.findMany({ where: { schoolId, termId: term.id }, select: { studentId: true, status: true } }),
      prisma.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, currentClassId: true } })
    ]);
    const has = new Set(existing.map((entry) => entry.studentId));
    const classOf = new Map(students.map((student) => [student.id, student.currentClassId]));
    const fresh: Prisma.AttendanceCaseCreateManyInput[] = [];
    for (const [studentId, tally] of tallies) {
      if (!classOf.has(studentId) || has.has(studentId)) continue;
      const value = rate(tally, policy.lateCounts);
      const recorded = tally.present + tally.late + tally.absent;
      if (value !== null && recorded >= policy.minDays && value < policy.chronic) {
        fresh.push({ schoolId, studentId, termId: term.id, classId: classOf.get(studentId) ?? null, openedAtRate: value, automatic: true });
      }
    }
    if (fresh.length) await prisma.attendanceCase.createMany({ data: fresh, skipDuplicates: true });
    const open = await prisma.attendanceCase.count({ where: { schoolId, termId: term.id, status: "OPEN" } });
    return { open, created: fresh.length };
  }

  /* ───────────────────────── guardian explanations ───────────────────────── */

  async explanations(session: SessionPayload) {
    const schoolId = session.schoolId;
    const rows = await prisma.guardianSubmission.findMany({
      where: { schoolId, type: "Absence explanation" },
      include: { guardian: { select: { firstName: true, lastName: true, relationship: true } }, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 12
    });
    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      child: row.student ? fullName(row.student) : null,
      adm: row.student?.admissionNumber ?? null,
      arm: row.student?.currentClass ? armName(row.student.currentClass) : null,
      guardian: fullName(row.guardian),
      relation: row.guardian.relationship ?? "Guardian",
      detail: row.detail,
      state: row.state === "RESOLVED" ? "Resolved" : row.state === "DECLINED" ? "Declined" : "New",
      open: row.state !== "RESOLVED" && row.state !== "DECLINED",
      outcome: row.outcome,
      at: row.createdAt.toISOString(),
      decidedAt: row.resolvedAt?.toISOString() ?? null
    }));
  }

  /** The days a child was marked absent and not yet excused — what an explanation can be applied to. */
  async openAbsences(session: SessionPayload, studentId: string) {
    const term = await currentTerm(session.schoolId);
    if (!term) return [];
    const rows = await prisma.studentAttendance.findMany({
      where: { schoolId: session.schoolId, studentId, termId: term.id, subjectId: null, status: "ABSENT" },
      orderBy: { date: "desc" },
      take: 20,
      select: { date: true, reason: true }
    });
    return rows.map((row) => ({ date: iso(dayOf(row.date)), label: longDay(dayOf(row.date)), reason: row.reason }));
  }

  async explanation(session: SessionPayload, id: string) {
    const [row] = (await this.explanations(session)).filter((entry) => entry.id === id);
    if (!row) throw new NotFoundException("That explanation is not in this school.");
    return { ...row, absences: row.studentId ? await this.openAbsences(session, row.studentId) : [] };
  }

  async decideExplanation(session: SessionPayload, id: string, body: unknown) {
    const input = decideSchema.parse(body);
    const schoolId = session.schoolId;
    const submission = await prisma.guardianSubmission.findFirst({ where: { id, schoolId, type: "Absence explanation" } });
    if (!submission) throw new NotFoundException("That explanation is not in this school.");
    if (submission.state === "RESOLVED" || submission.state === "DECLINED") throw new BadRequestException("That explanation has already been decided.");
    const accepted = /accept/i.test(input.decision);
    if (!accepted && (input.note ?? "").length < 4) throw new BadRequestException("Say why it is declined — the family is told.");
    let excused = 0;
    if (accepted) {
      if (!submission.studentId) throw new BadRequestException("This explanation names no child, so there is nothing to excuse.");
      if (!input.dates.length) throw new BadRequestException("Choose the days this explanation covers.");
      const term = await currentTerm(schoolId);
      if (!term) throw new BadRequestException("No term is current.");
      const stamp = new Date();
      for (const text of input.dates) {
        const date = dayOf(text);
        const row = await prisma.studentAttendance.findFirst({ where: { schoolId, studentId: submission.studentId, date, subjectId: null } });
        if (!row || row.status !== "ABSENT") continue;
        await prisma.$transaction([
          prisma.studentAttendance.update({ where: { id: row.id }, data: { status: "EXCUSED", reason: submission.detail.slice(0, 200), reasonCode: "Guardian explanation accepted", evidence: false } }),
          prisma.attendanceCorrection.create({
            data: { schoolId, classId: row.classId, studentId: submission.studentId, date, fromStatus: "ABSENT", toStatus: "EXCUSED", kind: "GUARDIAN", reasonCode: "Guardian explanation accepted", explanation: submission.detail, status: "APPLIED", requestedById: session.userId, decidedById: session.userId, decidedAt: stamp, decisionNote: input.note ?? null }
          })
        ]);
        excused += 1;
      }
      if (!excused) throw new BadRequestException("None of those days is an unexcused absence, so there was nothing to change.");
    }
    const outcome = accepted ? `Accepted · ${excused} ${excused === 1 ? "day" : "days"} now excused${input.note ? ` · ${input.note}` : ""}` : `Declined · ${input.note}`;
    await prisma.guardianSubmission.update({ where: { id }, data: { state: accepted ? "RESOLVED" : "DECLINED", outcome, resolvedAt: new Date(), ownerUserId: submission.ownerUserId ?? session.userId } });
    if (input.tell) await notifyGuardian(schoolId, submission.guardianId, "About your absence explanation", `The school has ${accepted ? "accepted" : "declined"} your explanation. ${outcome}`, ["In-app", "SMS"]);
    await this.audit(session, AuditAction.UPDATE, "GuardianSubmission", id, { summary: `Absence explanation ${accepted ? "accepted" : "declined"}`, excused });
    return { id, excused, state: accepted ? "Resolved" : "Declined" };
  }

  /* ───────────────────────── cases ───────────────────────── */

  async guardianContacts(schoolId: string, studentId: string) {
    const links = await prisma.studentGuardian.findMany({ where: { studentId }, select: { guardianId: true } });
    if (!links.length) return { count: 0, last: null as Date | null, delivered: false, hasNumber: false };
    const guardians = await prisma.guardian.findMany({ where: { id: { in: links.map((link) => link.guardianId) } }, select: { phone: true } });
    const rows = await prisma.guardianContact.findMany({
      where: { schoolId, guardianId: { in: links.map((link) => link.guardianId) }, kind: { startsWith: "Attendance" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    return { count: rows.length, last: rows[0]?.createdAt ?? null, delivered: rows.length > 0, hasNumber: guardians.some((guardian) => Boolean(guardian.phone?.trim())) };
  }

  /** One child's term and what the school has done about it — the case drawer. */
  async studentCase(session: SessionPayload, studentId: string) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current.");
    const policy = await loadPolicy(schoolId);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { id: true, name: true, arm: true } } } });
    if (!student) throw new NotFoundException("That child is not in this school.");
    const [rows, caseRow, contacts, corrections, calendar] = await Promise.all([
      prisma.studentAttendance.findMany({ where: { schoolId, studentId, termId: term.id, subjectId: null }, orderBy: { date: "asc" }, select: { date: true, status: true, reason: true, reasonCode: true } }),
      prisma.attendanceCase.findFirst({ where: { schoolId, studentId, termId: term.id } }),
      this.guardianContacts(schoolId, studentId),
      prisma.attendanceCorrection.findMany({ where: { schoolId, studentId }, orderBy: { createdAt: "desc" }, take: 10 }),
      termCalendar(schoolId, term)
    ]);
    const tally = emptyTally();
    for (const row of rows) add(tally, row.status);
    const absentOn = new Set(rows.filter((row) => row.status === "ABSENT").map((row) => iso(dayOf(row.date))));
    let run = 0;
    let runStart: Date | null = null;
    let longest = 0;
    let longestStart: Date | null = null;
    let longestEnd: Date | null = null;
    for (const day of calendar.days) {
      if (absentOn.has(iso(day))) {
        if (!run) runStart = day;
        run += 1;
        if (run > longest) {
          longest = run;
          longestStart = runStart;
          longestEnd = day;
        }
      } else run = 0;
    }
    const unexplained = rows.filter((row) => row.status === "ABSENT" && !row.reason && !row.reasonCode).length;
    const value = rate(tally, policy.lateCounts);
    const closer = caseRow?.closedById ? await prisma.user.findUnique({ where: { id: caseRow.closedById }, select: { firstName: true, lastName: true } }) : null;
    return {
      student: { id: student.id, name: fullName(student), adm: student.admissionNumber, arm: student.currentClass ? armName(student.currentClass) : "No arm yet", classId: student.currentClass?.id ?? null },
      term: { id: term.id, name: term.name },
      tally, days: rows.length, rate: value, flag: flagOf(value, policy),
      unexplained, longest, longestEnd: longestEnd ? iso(longestEnd) : null, longestStart: longestStart ? iso(longestStart) : null,
      case: caseRow
        ? { id: caseRow.id, status: caseRow.status === "OPEN" ? "Open" : "Closed", openedAt: iso(caseRow.openedAt), openedAtRate: caseRow.openedAtRate, automatic: caseRow.automatic, outcome: caseRow.outcome, outcomeNote: caseRow.outcomeNote, closedAt: caseRow.closedAt ? iso(caseRow.closedAt) : null, closedBy: closer ? fullName(closer) : null }
        : null,
      contacts: { count: contacts.count, last: contacts.last ? iso(contacts.last) : null, hasNumber: contacts.hasNumber, daysSince: contacts.last ? daysSince(contacts.last) : null },
      absences: rows.filter((row) => row.status === "ABSENT" || row.status === "EXCUSED").slice(-8).reverse().map((row) => ({ date: iso(dayOf(row.date)), label: shortDay(dayOf(row.date)), status: row.status, reason: row.reason ?? row.reasonCode })),
      corrections: corrections.map((entry) => ({ id: entry.id, date: iso(dayOf(entry.date)), from: entry.fromStatus, to: entry.toStatus, kind: entry.kind, status: entry.status, reason: entry.reasonCode })),
      outcomes: CASE_OUTCOMES, policy
    };
  }

  async openCase(session: SessionPayload, body: unknown) {
    const input = z.object({ students: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])) }).parse(body);
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) throw new BadRequestException("No term is current.");
    const policy = await loadPolicy(schoolId);
    const tallies = await this.studentTallies(schoolId, term.id);
    let opened = 0;
    for (const studentId of input.students) {
      const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, currentClassId: true } });
      if (!student) continue;
      const existing = await prisma.attendanceCase.findFirst({ where: { schoolId, studentId, termId: term.id } });
      if (existing) {
        if (existing.status === "CLOSED") await prisma.attendanceCase.update({ where: { id: existing.id }, data: { status: "OPEN", closedAt: null, closedById: null, outcome: null, outcomeNote: null } });
        else continue;
      } else {
        await prisma.attendanceCase.create({ data: { schoolId, studentId, termId: term.id, classId: student.currentClassId, openedAtRate: rate(tallies.get(studentId) ?? emptyTally(), policy.lateCounts) ?? 0, automatic: false, openedById: session.userId } });
      }
      opened += 1;
    }
    await this.audit(session, AuditAction.CREATE, "AttendanceCase", input.students[0] ?? "-", { summary: `${opened} attendance ${opened === 1 ? "case" : "cases"} opened by hand` });
    return { opened };
  }

  async closeCase(session: SessionPayload, id: string, body: unknown) {
    const input = closeSchema.parse(body);
    const row = await prisma.attendanceCase.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That case is not in this school.");
    if (row.status === "CLOSED") throw new BadRequestException("That case is already closed.");
    if (/^other/i.test(input.outcome) && (input.note ?? "").length < 5) throw new BadRequestException("Describe the outcome — \"other\" alone says nothing.");
    await prisma.attendanceCase.update({ where: { id }, data: { status: "CLOSED", outcome: input.outcome, outcomeNote: input.note ?? null, closedAt: new Date(), closedById: session.userId } });
    await this.audit(session, AuditAction.UPDATE, "AttendanceCase", id, { summary: `Attendance case closed · ${input.outcome}` });
    return { id };
  }

  static today = today;
}
