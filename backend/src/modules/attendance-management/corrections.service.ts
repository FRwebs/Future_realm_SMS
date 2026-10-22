import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  Access, CORRECTION_REASONS, LEADER_ROLES, MARK_LABEL, type Mark, REASONS, armName, currentTerm, dayOf, fullName, iso, loadPolicy, markOf, shortDay, today
} from "./attendance.shared";
import { CasesService } from "./cases.service";

/**
 * A saved register is never silently edited. A same-day change is free and logged; an earlier one
 * keeps the original mark, the new mark, the reason and the approval side by side, and the person
 * who asked for it cannot be the person who agrees.
 */

const requestSchema = z.object({
  classId: z.string().min(1, "Choose the register being corrected."),
  date: z.string().min(8),
  student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  to: z.string().min(1, "Choose what it should be corrected to."),
  reason: z.string().min(1, "Choose the reason for the correction."),
  explanation: z.string().trim().min(8, "Say what happened — it is kept beside both marks."),
  evidence: z.coerce.boolean().default(false)
});

const bulkSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(8),
  students: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])),
  to: z.string().min(1),
  reason: z.string().min(1),
  explanation: z.string().trim().min(8, "Say what happened — it is kept beside every mark you change.")
});

const decideSchema = z.object({ decision: z.string().min(1), note: z.string().trim().optional() });

const reasonSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(8),
  students: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])),
  reason: z.string().min(1, "Choose a reason."),
  explanation: z.string().trim().optional(),
  evidence: z.coerce.boolean().default(false),
  excuse: z.coerce.boolean().default(false)
});

@Injectable()
export class CorrectionsService {
  constructor(private readonly access: Access, private readonly cases: CasesService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "AttendanceCorrection", entityId, metadata } });
  }

  /** Is there anyone other than the requester who could agree? A school with one Principal cannot be locked out of its own records. */
  private async otherApprover(schoolId: string, requesterId: string) {
    const approvers = await prisma.user.count({ where: { schoolId, isActive: true, deletedAt: null, id: { not: requesterId }, role: { in: Array.from(LEADER_ROLES) as never[] } } });
    return approvers > 0;
  }

  async options(session: SessionPayload) {
    const approver = await prisma.user.findFirst({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: ["PRINCIPAL"] as never[] } }, select: { firstName: true, lastName: true } });
    return { reasons: CORRECTION_REASONS, absenceReasons: REASONS, approver: approver ? `${fullName(approver)} · Principal` : "A school administrator" };
  }

  async list(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) return { rows: [], backdated: [], totals: { all: 0, backdated: 0, sameDay: 0, awaiting: 0 } };
    const [corrections, registers] = await Promise.all([
      prisma.attendanceCorrection.findMany({ where: { schoolId, createdAt: { gte: term.startDate } }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.attendanceRegister.findMany({ where: { schoolId, termId: term.id, backdated: true }, orderBy: { date: "desc" }, take: 100 })
    ]);
    const studentIds = Array.from(new Set(corrections.map((entry) => entry.studentId)));
    const classIds = Array.from(new Set([...corrections.map((entry) => entry.classId), ...registers.map((entry) => entry.classId)]));
    const userIds = Array.from(new Set([...corrections.flatMap((entry) => [entry.requestedById, entry.decidedById ?? ""]), ...registers.map((entry) => entry.markedById)].filter(Boolean)));
    const [students, rooms, users] = await Promise.all([
      prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } }),
      prisma.classRoom.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, arm: true } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    ]);
    const studentName = new Map(students.map((student) => [student.id, fullName(student)]));
    const roomName = new Map(rooms.map((room) => [room.id, armName(room)]));
    const userName = new Map(users.map((user) => [user.id, fullName(user)]));
    const rows = corrections.map((entry) => ({
      id: entry.id, who: userName.get(entry.requestedById) ?? "—", arm: roomName.get(entry.classId) ?? "—",
      markedOn: shortDay(entry.createdAt), forDate: shortDay(dayOf(entry.date)), forIso: iso(dayOf(entry.date)),
      kind: entry.kind === "SAME_DAY" ? "Same day" : entry.kind === "GUARDIAN" ? "Guardian" : "Prior day",
      state: entry.status === "APPLIED" ? (entry.kind === "SAME_DAY" ? "Same day" : "Approved") : entry.status === "AWAITING" ? "Awaiting" : "Declined",
      awaiting: entry.status === "AWAITING",
      student: studentName.get(entry.studentId) ?? "—", from: MARK_LABEL[entry.fromStatus as Mark] ?? entry.fromStatus, to: MARK_LABEL[entry.toStatus as Mark] ?? entry.toStatus,
      reasonCode: entry.reasonCode, explanation: entry.explanation, evidence: entry.evidence,
      decidedBy: entry.decidedById ? userName.get(entry.decidedById) ?? null : null, decidedAt: entry.decidedAt ? iso(entry.decidedAt) : null, decisionNote: entry.decisionNote,
      requestedById: entry.requestedById
    }));
    const backdated = registers.map((entry) => ({ id: entry.id, who: userName.get(entry.markedById) ?? "—", arm: roomName.get(entry.classId) ?? "—", markedOn: entry.submittedAt ? shortDay(entry.submittedAt) : "—", forDate: shortDay(dayOf(entry.date)), reason: entry.backdateReason ?? "No reason recorded" }));
    return {
      rows, backdated,
      totals: { all: rows.length, backdated: backdated.length, sameDay: rows.filter((row) => row.kind === "Same day").length, awaiting: rows.filter((row) => row.awaiting).length }
    };
  }

  async request(session: SessionPayload, body: unknown) {
    const input = requestSchema.parse(body);
    const schoolId = session.schoolId;
    const date = dayOf(input.date);
    const to = markOf(input.to);
    if (!to) throw new BadRequestException("That is not a mark.");
    const room = await prisma.classRoom.findFirst({ where: { id: input.classId, schoolId, deletedAt: null }, select: { id: true, name: true, arm: true, classTeacherId: true, assistantClassTeacherId: true } });
    if (!room) throw new NotFoundException("That arm is not in this school.");
    await this.access.assertMarker(session, { id: room.id, name: armName(room), classTeacherId: room.classTeacherId, assistantClassTeacherId: room.assistantClassTeacherId });
    const row = await prisma.studentAttendance.findFirst({ where: { schoolId, classId: input.classId, studentId: input.student, date, subjectId: null } });
    if (!row) throw new BadRequestException("That child has no mark on that day's register, so there is nothing to correct.");
    if (row.status === to) throw new BadRequestException(`They are already marked ${MARK_LABEL[to].toLowerCase()}.`);
    const pending = await prisma.attendanceCorrection.findFirst({ where: { schoolId, studentId: input.student, date, status: "AWAITING" } });
    if (pending) throw new BadRequestException("A correction for that child and day is already waiting for a decision.");

    const sameDay = date.getTime() === today().getTime();
    const stamp = new Date();
    const data = { schoolId, classId: input.classId, studentId: input.student, date, fromStatus: row.status, toStatus: to, reasonCode: input.reason, explanation: input.explanation, evidence: input.evidence, requestedById: session.userId };
    if (sameDay) {
      const [created] = await prisma.$transaction([
        prisma.attendanceCorrection.create({ data: { ...data, kind: "SAME_DAY", status: "APPLIED", decidedById: session.userId, decidedAt: stamp } }),
        prisma.studentAttendance.update({ where: { id: row.id }, data: { status: to, reasonCode: input.reason, reason: input.explanation.slice(0, 200), evidence: input.evidence } })
      ]);
      await this.audit(session, AuditAction.UPDATE, created.id, { summary: `Register corrected the same day · ${MARK_LABEL[row.status as Mark]} → ${MARK_LABEL[to]}` });
      return { id: created.id, applied: true };
    }
    const created = await prisma.attendanceCorrection.create({ data: { ...data, kind: "PRIOR_DAY", status: "AWAITING" } });
    await this.audit(session, AuditAction.CREATE, created.id, { summary: `Register correction requested · ${MARK_LABEL[row.status as Mark]} → ${MARK_LABEL[to]} · ${iso(date)}` });
    return { id: created.id, applied: false };
  }

  /** The same correction for several children, each one decided on its own. */
  async bulk(session: SessionPayload, body: unknown) {
    const input = bulkSchema.parse(body);
    let applied = 0;
    let awaiting = 0;
    const skipped: string[] = [];
    for (const studentId of input.students) {
      try {
        const result = await this.request(session, { classId: input.classId, date: input.date, student: studentId, to: input.to, reason: input.reason, explanation: input.explanation });
        if (result.applied) applied += 1;
        else awaiting += 1;
      } catch (error) {
        skipped.push(error instanceof Error ? error.message : "Could not be corrected.");
      }
    }
    if (!applied && !awaiting) throw new BadRequestException(skipped[0] ?? "Nothing was corrected.");
    return { applied, awaiting, skipped, fields: [["Applied at once", String(applied)], ["Waiting for an approver", String(awaiting)], ...(skipped.length ? [["Skipped", skipped.slice(0, 3).join("; ")]] : [])] };
  }

  async decide(session: SessionPayload, id: string, body: unknown) {
    const input = decideSchema.parse(body);
    const schoolId = session.schoolId;
    const row = await prisma.attendanceCorrection.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That correction is not in this school.");
    if (row.status !== "AWAITING") throw new BadRequestException("That correction has already been decided.");
    const approve = /approve|accept/i.test(input.decision);
    if (!approve && (input.note ?? "").length < 4) throw new BadRequestException("Say why it is declined — the person who asked is told.");
    let selfApproved = false;
    if (row.requestedById === session.userId) {
      if (await this.otherApprover(schoolId, session.userId)) throw new BadRequestException("You asked for this correction, so someone else must decide it.");
      selfApproved = true;
    }
    const stamp = new Date();
    if (approve) {
      const mark = await prisma.studentAttendance.findFirst({ where: { schoolId, classId: row.classId, studentId: row.studentId, date: row.date, subjectId: null } });
      if (!mark) throw new BadRequestException("The mark this correction was about no longer exists.");
      await prisma.$transaction([
        prisma.studentAttendance.update({ where: { id: mark.id }, data: { status: row.toStatus as Mark, reasonCode: row.reasonCode, reason: row.explanation.slice(0, 200), evidence: row.evidence } }),
        prisma.attendanceCorrection.update({ where: { id }, data: { status: "APPLIED", decidedById: session.userId, decidedAt: stamp, decisionNote: input.note ?? null } })
      ]);
    } else {
      await prisma.attendanceCorrection.update({ where: { id }, data: { status: "DECLINED", decidedById: session.userId, decidedAt: stamp, decisionNote: input.note } });
    }
    const term = await currentTerm(schoolId);
    if (term && approve) {
      await this.cases.syncCases(schoolId, term, await loadPolicy(schoolId));
    }
    await this.audit(session, approve ? AuditAction.APPROVE : AuditAction.REJECT, id, { summary: `Register correction ${approve ? "approved" : "declined"} · ${iso(row.date)}`, selfApproved });
    return { id, state: approve ? "Approved" : "Declined", selfApproved };
  }

  /** The reason an absence is given — not a change of mark, unless the person says to excuse it. */
  async recordReason(session: SessionPayload, body: unknown) {
    const input = reasonSchema.parse(body);
    const schoolId = session.schoolId;
    const date = dayOf(input.date);
    const room = await prisma.classRoom.findFirst({ where: { id: input.classId, schoolId, deletedAt: null }, select: { id: true, name: true, arm: true, classTeacherId: true, assistantClassTeacherId: true } });
    if (!room) throw new NotFoundException("That arm is not in this school.");
    await this.access.assertMarker(session, { id: room.id, name: armName(room), classTeacherId: room.classTeacherId, assistantClassTeacherId: room.assistantClassTeacherId });
    const rows = await prisma.studentAttendance.findMany({ where: { schoolId, classId: input.classId, date, subjectId: null, studentId: { in: input.students } } });
    const absences = rows.filter((row) => row.status === "ABSENT" || row.status === "EXCUSED" || row.status === "LATE");
    if (!absences.length) throw new BadRequestException("None of those children is marked absent, late or excused on that day.");
    const reason = input.explanation ? `${input.reason} · ${input.explanation}` : input.reason;
    await prisma.studentAttendance.updateMany({ where: { id: { in: absences.map((row) => row.id) } }, data: { reasonCode: input.reason, reason: reason.slice(0, 200), evidence: input.evidence } });
    let excused = 0;
    let awaiting = 0;
    if (input.excuse) {
      for (const row of absences.filter((entry) => entry.status === "ABSENT")) {
        const result = await this.request(session, { classId: input.classId, date: input.date, student: row.studentId, to: "Excused", reason: "Guardian explanation accepted", explanation: reason.length >= 8 ? reason : `${reason} (reason recorded)`, evidence: input.evidence });
        if (result.applied) excused += 1;
        else awaiting += 1;
      }
    }
    await this.audit(session, AuditAction.UPDATE, input.classId, { summary: `Reason recorded · ${input.reason} · ${absences.length} ${absences.length === 1 ? "child" : "children"} · ${iso(date)}`, excused, awaiting });
    return { recorded: absences.length, excused, awaiting, fields: [["Children", String(absences.length)], ["Excused now", String(excused)], ["Excuse waiting for an approver", String(awaiting)]] };
  }
}
