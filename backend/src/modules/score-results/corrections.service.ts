import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { LEADER_ROLES, currentTerm, iso, notifyStaff } from "../attendance-management/attendance.shared";
import { type ArmData, loadArm, loadStaffNames, studentResults } from "./arm";
import { CardService } from "../report-cards/card.service";
import { ABSENT, fullName, ordinal, readFramework } from "./scores.shared";
import { syncResultSheets } from "./sync";

/**
 * A score that has been approved changes only through here. The old mark, the new one, the reason and
 * the consequence are stated before anyone decides; one that has already reached a parent is decided
 * in two steps and issues a revision rather than quietly replacing what the family holds.
 */

const REASONS = ["Marking error", "Mark entered in the wrong column", "Mark entered against the wrong child", "Script re-marked after a query", "Absence entered in error", "Other — described below"];

const requestSchema = z.object({
  student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  subject: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  component: z.string().min(1, "Choose the component."),
  to: z.string().trim().min(1, "Give the corrected mark, or A for absent."),
  reason: z.string().min(1, "Choose the reason."),
  explanation: z.string().trim().min(8, "Say what happened — it stays beside both marks."),
  evidence: z.string().trim().optional()
});
const decideSchema = z.object({ decision: z.string().min(1), note: z.string().trim().optional() });

const personAverage = (arm: ArmData, studentId: string) => {
  const results = studentResults(arm);
  const mine = results.find((entry) => entry.id === studentId);
  return { average: mine?.average ?? null, pos: mine?.pos ?? null };
};

@Injectable()
export class ScoreCorrectionsService {
  constructor(private readonly cards: CardService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "ScoreCorrection", entityId, metadata } });
  }

  private async term(schoolId: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current.");
    return { id: term.id, name: term.name };
  }

  private async otherApprover(schoolId: string, excluded: string[]) {
    return (await prisma.user.count({ where: { schoolId, isActive: true, deletedAt: null, id: { notIn: excluded }, role: { in: Array.from(LEADER_ROLES).concat(["EXAM_OFFICER", "EXAMINATION_OFFICER"]) as never[] } } })) > 0;
  }

  async options(session: SessionPayload) {
    const term = await this.term(session.schoolId);
    const subjects = await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, classRoom: { students: { some: { status: "ACTIVE" } } } }, select: { subject: { select: { name: true } } }, distinct: ["subjectId"] });
    const live = await prisma.sectionAssessmentComponent.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ termId: term.id }, { termId: null }] }, select: { name: true }, orderBy: { order: "asc" } });
    /* a sheet keeps the components it was begun under, so those count too — they may not be today's */
    const pinned = await prisma.scoreSheet.findMany({ where: { schoolId: session.schoolId, termId: term.id }, select: { framework: true } });
    const components = [...live.map((entry) => entry.name), ...pinned.flatMap((sheet) => readFramework(sheet.framework).map((column) => column.name))];
    const students = await prisma.student.findMany({ where: { schoolId: session.schoolId, status: "ACTIVE", currentClassId: { not: null }, resultSheets: { some: { termId: term.id } } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } }, orderBy: [{ lastName: "asc" }], take: 800 });
    return {
      reasons: REASONS, subjects: Array.from(new Set(subjects.map((entry) => entry.subject.name))).sort(), components: Array.from(new Set(components)),
      students: students.map((student) => ({ id: student.id, name: fullName(student), adm: student.admissionNumber, arm: student.currentClass ? `${student.currentClass.name}${student.currentClass.arm && !student.currentClass.name.endsWith(student.currentClass.arm) ? ` ${student.currentClass.arm}` : ""}` : "No arm yet" })),
      routing: "Exam Officer, then the Principal once a parent has seen the result"
    };
  }

  async list(session: SessionPayload, filter: { classId?: string }) {
    const term = await this.term(session.schoolId);
    const rows = await prisma.scoreCorrection.findMany({ where: { schoolId: session.schoolId, ...(filter.classId ? { classId: filter.classId } : {}) }, orderBy: { createdAt: "desc" }, take: 60 });
    const [students, subjects, rooms, people] = await Promise.all([
      prisma.student.findMany({ where: { id: { in: rows.map((row) => row.studentId) } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }),
      prisma.subject.findMany({ where: { id: { in: rows.map((row) => row.subjectId) } }, select: { id: true, name: true } }),
      prisma.classRoom.findMany({ where: { id: { in: rows.map((row) => row.classId) } }, select: { id: true, name: true, arm: true } }),
      loadStaffNames(session.schoolId, rows.flatMap((row) => [row.requestedById, row.stepOneById ?? "", row.decidedById ?? ""]))
    ]);
    const studentOf = new Map(students.map((student) => [student.id, student]));
    const subjectOf = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const roomOf = new Map(rooms.map((room) => [room.id, `${room.name}${room.arm && !room.name.endsWith(room.arm) ? ` ${room.arm}` : ""}`]));
    return {
      term,
      rows: rows.map((row) => {
        const student = studentOf.get(row.studentId);
        const open = row.status === "AWAITING" || row.status === "IN_REVIEW";
        return {
          id: row.id, classId: row.classId, subjectId: row.subjectId, studentId: row.studentId, arm: roomOf.get(row.classId) ?? "—", subject: subjectOf.get(row.subjectId) ?? "—", student: student ? fullName(student) : "—", adm: student?.admissionNumber ?? "",
          component: row.componentName, from: row.fromScore, to: row.toScore, reason: row.reasonCode, explanation: row.explanation, evidence: row.evidence, status: row.status, open, reachedParent: row.reachedParent,
          requestedBy: people.get(row.requestedById) ?? "—", requestedById: row.requestedById, requestedAt: iso(row.createdAt), stepOneBy: row.stepOneById ? people.get(row.stepOneById) ?? null : null, decidedBy: row.decidedById ? people.get(row.decidedById) ?? null : null, decidedAt: row.decidedAt ? iso(row.decidedAt) : null,
          note: row.decisionNote, effect: row.effect as null | { avgBefore: number | null; avgAfter: number | null; posBefore: number | null; posAfter: number | null }, revision: row.revision, steps: row.reachedParent ? 2 : 1,
          nextStep: row.status === "AWAITING" ? 1 : row.status === "IN_REVIEW" ? 2 : null
        };
      })
    };
  }

  async request(session: SessionPayload, body: unknown) {
    const input = requestSchema.parse(body);
    const term = await this.term(session.schoolId);
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId: session.schoolId }, select: { id: true, currentClassId: true } });
    if (!student?.currentClassId) throw new BadRequestException("That child is not on an arm's roll.");
    const classId = student.currentClassId;
    const arm = await loadArm(session.schoolId, term, classId);
    const subject = arm?.subjects.find((entry) => entry.name === input.subject || entry.subjectId === input.subject);
    if (!arm || !subject) throw new BadRequestException(`${input.subject} is not offered to this child's arm.`);
    if (subject.state !== "Approved") throw new BadRequestException(`${subject.name} is ${subject.state.toLowerCase()} — it is not approved yet, so correct it on the sheet itself rather than through a correction.`);
    const column = subject.columns.find((entry) => entry.name === input.component);
    if (!column?.id) throw new BadRequestException(`${input.component} is not a component of ${subject.name} here.`);
    const row = subject.rows.find((entry) => entry.id === student.id);
    const text = input.to.trim().toUpperCase();
    const to = text === "A" || text === "ABS" ? null : Number(text);
    if (to !== null && (!/^\d+(\.\d+)?$/.test(text) || to > column.max)) throw new BadRequestException(`${input.to} is not a mark from 0 to ${column.max}, and not an A for absent.`);
    const current = row?.cells[column.key];
    const from = typeof current === "number" ? current : null;
    if (to === from) throw new BadRequestException("That is the mark already on the sheet.");
    const pending = await prisma.scoreCorrection.findFirst({ where: { schoolId: session.schoolId, studentId: student.id, subjectId: subject.subjectId, componentId: column.id, termId: term.id, status: { in: ["AWAITING", "IN_REVIEW"] } } });
    if (pending) throw new BadRequestException("A correction to that same mark is already waiting for a decision.");
    const published = await prisma.resultSheet.count({ where: { schoolId: session.schoolId, studentId: student.id, termId: term.id, OR: [{ status: "PUBLISHED" }, { publishedAt: { not: null } }] } });

    /* what it would do — worked out against the sheet as it stands, never guessed */
    const before = personAverage(arm, student.id);
    const copy = structuredClone({ rows: subject.rows }) as { rows: typeof subject.rows };
    const copied = copy.rows.find((entry) => entry.id === student.id);
    if (copied) {
      copied.cells[column.key] = to === null ? ABSENT : to;
      const entered = subject.columns.reduce((sum, value) => sum + (typeof copied.cells[value.key] === "number" ? (copied.cells[value.key] as number) : 0), 0);
      const any = subject.columns.some((value) => typeof copied.cells[value.key] === "number");
      copied.total = any ? Math.round(entered * 100) / 100 : null;
    }
    const totals = arm.subjects.map((entry) => (entry.subjectId === subject.subjectId ? copied?.total ?? null : entry.rows.find((r) => r.id === student.id)?.total ?? null)).filter((value): value is number => typeof value === "number");
    const avgAfter = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : null;
    const effect = { avgBefore: before.average, avgAfter, posBefore: before.pos, posAfter: null };

    const created = await prisma.scoreCorrection.create({
      data: { schoolId: session.schoolId, termId: term.id, classId, subjectId: subject.subjectId, studentId: student.id, sheetId: subject.sheet?.id ?? null, componentId: column.id, componentName: column.name, fromScore: from, toScore: to ?? -1, reasonCode: input.reason, explanation: input.explanation, evidence: input.evidence || null, status: "AWAITING", reachedParent: published > 0, requestedById: session.userId, effect: effect as unknown as Prisma.InputJsonValue }
    });
    await this.audit(session, AuditAction.CREATE, created.id, { summary: `Score correction requested · ${subject.name} · ${from ?? "blank"} → ${to ?? "absent"}`, reachedParent: published > 0 });
    const approvers = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, id: { not: session.userId }, role: { in: ["EXAM_OFFICER", "EXAMINATION_OFFICER"] as never[] } }, select: { id: true } });
    if (approvers.length) await notifyStaff(session.schoolId, session.userId, approvers.map((entry) => entry.id), { title: "Score review · a correction is waiting", body: `${subject.name}: ${from ?? "blank"} → ${to ?? "absent"} (${input.reason}). ${published ? "The result has already reached the family." : "It has not reached the family."}`, channels: ["In-app inbox"], link: "/score-entry-results/results" });
    return { id: created.id, steps: published ? 2 : 1, reachedParent: published > 0, fields: [["Subject", subject.name], ["Change", `${from ?? "blank"} → ${to ?? "absent"}`], ["Reached a family?", published ? "Yes — decided in two steps, and a revision is issued" : "No — one approval"], ["Effect on the average", `${before.average ?? "—"} → ${avgAfter ?? "—"}`]] };
  }

  async decide(session: SessionPayload, id: string, body: unknown) {
    const input = decideSchema.parse(body);
    const row = await prisma.scoreCorrection.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That correction is not in this school.");
    if (row.status !== "AWAITING" && row.status !== "IN_REVIEW") throw new BadRequestException("That correction has already been decided.");
    const approve = /approve|accept|agree/i.test(input.decision);
    if (!approve && (input.note ?? "").length < 4) throw new BadRequestException("Say why it is declined — the person who asked is told.");
    const second = row.status === "IN_REVIEW";
    let selfPass = false;
    if (row.requestedById === session.userId) {
      if (await this.otherApprover(session.schoolId, [session.userId])) throw new BadRequestException("You asked for this correction, so someone else must decide it. A mark never changes on its requester's word alone.");
      selfPass = true;
    }
    if (second && row.stepOneById === session.userId && (await this.otherApprover(session.schoolId, [session.userId, row.requestedById]))) throw new BadRequestException("You took the first step, so the second must be someone else's — that is what two steps are for.");
    const stamp = new Date();
    if (!approve) {
      await prisma.scoreCorrection.update({ where: { id }, data: { status: "DECLINED", decidedById: session.userId, decidedAt: stamp, decisionNote: input.note } });
      await this.audit(session, AuditAction.REJECT, id, { summary: "Score correction declined", reason: input.note ?? "" });
      await notifyStaff(session.schoolId, session.userId, [row.requestedById], { title: "Score review · correction declined", body: `Your correction to ${row.componentName} was declined: ${input.note}`, channels: ["In-app inbox"] });
      return { state: "Declined", fields: [["Decision", "Declined"], ["The mark", "Unchanged"]] };
    }
    if (row.reachedParent && !second) {
      await prisma.scoreCorrection.update({ where: { id }, data: { status: "IN_REVIEW", stepOneById: session.userId, stepOneAt: stamp, stepOneNote: input.note ?? null } });
      await this.audit(session, AuditAction.APPROVE, id, { summary: "Score correction · first step agreed", selfPass });
      return { state: "In review", fields: [["First step", "Agreed"], ["Next", "The Principal decides — the result has already reached a family"]] };
    }
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, row.classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === row.subjectId);
    if (!arm || !subject) throw new BadRequestException("The sheet this correction was about no longer exists.");
    const before = personAverage(arm, row.studentId);
    const resultSheet = await prisma.resultSheet.findFirst({ where: { schoolId: session.schoolId, studentId: row.studentId, termId: row.termId } });
    if (!resultSheet) throw new BadRequestException("That child has no result sheet to correct.");
    const column = subject.columns.find((entry) => entry.id === row.componentId);
    const existing = await prisma.scoreEntry.findFirst({ where: { schoolId: session.schoolId, studentId: row.studentId, subjectId: row.subjectId, assessmentComponentId: row.componentId, resultSheetId: resultSheet.id } });
    const absences = { ...((subject.sheet?.absences ?? {}) as Record<string, string[]>) };
    const absent = row.toScore < 0;
    await prisma.$transaction([
      ...(absent
        ? [...(existing ? [prisma.scoreEntry.delete({ where: { id: existing.id } })] : []), prisma.scoreSheet.update({ where: { id: subject.sheet?.id as string }, data: { absences: { ...absences, [row.studentId]: Array.from(new Set([...(absences[row.studentId] ?? []), column?.key ?? ""])) } as Prisma.InputJsonValue } })]
        : [
            ...(existing ? [prisma.scoreEntry.update({ where: { id: existing.id }, data: { score: row.toScore, recordedAt: stamp } })] : [prisma.scoreEntry.create({ data: { schoolId: session.schoolId, studentId: row.studentId, resultSheetId: resultSheet.id, subjectId: row.subjectId, assessmentComponentId: row.componentId, enteredById: row.requestedById, score: row.toScore, maxScore: column?.max ?? 100, isDraft: false, submittedAt: stamp } })]),
            ...(column && (absences[row.studentId] ?? []).includes(column.key) ? [prisma.scoreSheet.update({ where: { id: subject.sheet?.id as string }, data: { absences: { ...absences, [row.studentId]: absences[row.studentId].filter((key) => key !== column.key) } as Prisma.InputJsonValue } })] : [])
          ]),
      prisma.scoreCorrection.update({ where: { id }, data: { status: "APPROVED", decidedById: session.userId, decidedAt: stamp, decisionNote: input.note ?? null } })
    ]);
    await syncResultSheets(session.schoolId, term, row.classId, session.userId);
    const after = await loadArm(session.schoolId, term, row.classId);
    const now = after ? personAverage(after, row.studentId) : before;
    await prisma.scoreCorrection.update({ where: { id }, data: { effect: { avgBefore: before.average, avgAfter: now.average, posBefore: before.pos, posAfter: now.pos } as unknown as Prisma.InputJsonValue } });
    let told = 0;
    let issued: number | null = null;
    if (row.reachedParent) {
      /* the card the family holds is revised beside the original, never replaced, and they are told why */
      const reissued = await this.cards.reissue(session.schoolId, session.userId, row.studentId, row.termId, `${subject.name} · ${row.componentName} corrected — ${row.explanation}`);
      told = reissued?.told ?? 0;
      issued = reissued?.revision ?? null;
      if (issued) await prisma.scoreCorrection.update({ where: { id }, data: { revision: issued } });
    }
    await this.audit(session, AuditAction.APPROVE, id, { summary: `Score correction approved · ${subject.name} · ${row.fromScore ?? "blank"} → ${absent ? "absent" : row.toScore}`, revision: issued, selfPass });
    return { state: "Approved", fields: [["The mark", `${row.fromScore ?? "blank"} → ${absent ? "absent" : row.toScore}`], ["Average", `${before.average ?? "—"} → ${now.average ?? "—"}`], ["Position", `${before.pos ? ordinal(before.pos) : "—"} → ${now.pos ? ordinal(now.pos) : "—"}`], ...(row.reachedParent ? [["Revision", `Revision ${issued ?? "—"} issued · ${told} ${told === 1 ? "family" : "families"} told · the earlier version is kept`]] : [])] };
  }
}
