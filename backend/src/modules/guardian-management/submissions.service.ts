import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { refuseTeaching } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { currentTerm, daysSince, fullName } from "../student-records/records.shared";
import { notifyGuardian } from "./guardians.shared";

/**
 * Everything families have sent in, with an owner, a state and an age. Which submissions a
 * school accepts, how fast it promises to answer and who reviews each is the school's own list.
 */

export type SubmissionType = { name: string; target: number; reviewer: string; accepted: boolean };

export const SUBMISSION_DEFAULTS: SubmissionType[] = [
  { name: "Absence explanation", target: 2, reviewer: "Form master", accepted: true },
  { name: "Contact update", target: 3, reviewer: "Registrar", accepted: true },
  { name: "Record correction", target: 5, reviewer: "Registrar", accepted: true },
  { name: "Result query", target: 3, reviewer: "Exam Officer", accepted: true },
  { name: "Fee query", target: 5, reviewer: "Bursar", accepted: true },
  { name: "Meeting request", target: 5, reviewer: "Principal", accepted: true },
  { name: "Consent action", target: 0, reviewer: "Handled in person", accepted: false },
  { name: "Withdrawal notice", target: 0, reviewer: "Handled in person", accepted: false }
];

const REVIEWER_ROLES: Record<string, string[]> = {
  Registrar: ["ADMIN_OFFICER", "ADMISSIONS_OFFICER"],
  Bursar: ["BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"],
  "Exam Officer": ["EXAM_OFFICER", "EXAMINATION_OFFICER"],
  Principal: ["PRINCIPAL"],
  "Form master": ["CLASS_TEACHER"]
};

const logSchema = z.object({
  guardian: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  child: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (Array.isArray(value) ? value[0] : value)),
  type: z.string().min(1, "Choose the type."),
  detail: z.string().trim().min(8, "Say what the family wrote."),
  channel: z.string().default("In person"),
  owner: z.string().optional()
});

const resolveSchema = z.object({ decision: z.string().default("Resolved"), outcome: z.string().trim().min(4, "Record the outcome — an item cannot be closed without one."), tell: z.coerce.boolean().default(true) });

const stateLabel = (state: string) => (state === "IN_PROGRESS" ? "In progress" : state.charAt(0) + state.slice(1).toLowerCase());

@Injectable()
export class SubmissionsService {
  private types(schoolId: string) {
    return new ConfigStore(schoolId, "submission-types");
  }

  private async typeList(schoolId: string): Promise<SubmissionType[]> {
    const rows = await this.types(schoolId).list<SubmissionType>();
    return rows.length ? rows.map((row) => ({ ...row.data, name: row.name })) : SUBMISSION_DEFAULTS;
  }

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "GuardianSubmission", entityId, metadata } });
  }

  async overview(session: SessionPayload) {
    await refuseTeaching(session, "Guardians → Submissions");
    const schoolId = session.schoolId;
    const [rows, types, term] = await Promise.all([
      prisma.guardianSubmission.findMany({ where: { schoolId }, include: { guardian: { select: { firstName: true, lastName: true } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } }, orderBy: { createdAt: "desc" } }),
      this.typeList(schoolId),
      currentTerm(schoolId)
    ]);
    const target = (type: string) => types.find((entry) => entry.name === type)?.target ?? 3;
    const items = rows.map((row) => {
      const days = daysSince(row.createdAt);
      const open = row.state !== "RESOLVED" && row.state !== "DECLINED";
      const sla = target(row.type);
      return {
        id: row.id,
        type: row.type,
        family: fullName(row.guardian),
        child: row.student ? fullName(row.student) : null,
        detail: row.detail,
        owner: row.ownerName ?? "Nobody yet",
        ownerRole: row.ownerRole ?? "",
        state: open && sla && days > sla ? "Overdue" : stateLabel(row.state),
        open,
        overdue: open && Boolean(sla) && days > sla,
        age: open ? `${days} ${days === 1 ? "day" : "days"} · SLA ${sla}` : "—",
        days,
        sla,
        outcome: row.outcome,
        channel: row.channel,
        at: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null
      };
    });
    const open = items.filter((item) => item.open);
    const resolved = rows.filter((row) => row.resolvedAt && (!term || row.resolvedAt >= term.startDate));
    const spans = resolved.map((row) => ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) / 86_400_000).sort((a, b) => a - b);
    const median = spans.length ? spans[Math.floor(spans.length / 2)] : null;
    return {
      items,
      totals: { open: open.length, overdue: open.filter((item) => item.overdue).length, resolved: resolved.length, median: median === null ? null : Math.round(median * 10) / 10, all: items.length },
      levels: types.map((type) => ({ ...type, open: open.filter((item) => item.type === type.name).length, overdue: open.filter((item) => item.type === type.name && item.overdue).length })),
      types: types.filter((type) => type.accepted).map((type) => type.name)
    };
  }

  async options(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [guardians, types] = await Promise.all([
      prisma.guardian.findMany({ where: { schoolId, mergedIntoId: null, students: { some: {} } }, include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 400 }),
      this.typeList(schoolId)
    ]);
    return { guardians: guardians.map((guardian) => ({ id: guardian.id, name: fullName(guardian), phone: guardian.phone, children: guardian.students.map((link) => ({ id: link.studentId, name: fullName(link.student) })) })), types: types.filter((type) => type.accepted).map((type) => type.name) };
  }

  /** Staff log what a family told them in person or on the phone, so it has an owner and a clock like any other. */
  async log(session: SessionPayload, body: unknown) {
    const input = logSchema.parse(body);
    const schoolId = session.schoolId;
    const types = await this.typeList(schoolId);
    const type = types.find((entry) => entry.name === input.type);
    if (!type) throw new BadRequestException("That is not a type of submission.");
    if (!type.accepted) throw new BadRequestException(`${type.name} is not accepted here — it is handled in person.`);
    const guardian = await prisma.guardian.findFirst({ where: { id: input.guardian, schoolId } });
    if (!guardian) throw new BadRequestException("That family is not in this school.");
    let owner = input.owner ? await prisma.user.findFirst({ where: { schoolId, id: input.owner }, select: { id: true, firstName: true, lastName: true, role: true } }) : null;
    if (!owner) {
      const roles = REVIEWER_ROLES[type.reviewer] ?? [];
      if (type.reviewer === "Form master" && input.child) {
        const child = await prisma.student.findFirst({ where: { id: input.child, schoolId }, select: { currentClass: { select: { classTeacherId: true } } } });
        const teacher = child?.currentClass?.classTeacherId;
        if (teacher) owner = await prisma.user.findFirst({ where: { id: teacher }, select: { id: true, firstName: true, lastName: true, role: true } });
      }
      if (!owner && roles.length) owner = await prisma.user.findFirst({ where: { schoolId, isActive: true, role: { in: roles as never[] } }, select: { id: true, firstName: true, lastName: true, role: true } });
    }
    const created = await prisma.guardianSubmission.create({
      data: { schoolId, guardianId: guardian.id, studentId: input.child || null, type: type.name, detail: input.detail, state: owner ? "ASSIGNED" : "NEW", ownerUserId: owner?.id, ownerName: owner ? fullName(owner) : null, ownerRole: type.reviewer, channel: input.channel }
    });
    await this.audit(session, AuditAction.CREATE, created.id, { summary: `Submission logged · ${type.name}` });
    return { id: created.id, owner: owner ? fullName(owner) : null };
  }

  async resolve(session: SessionPayload, id: string, body: unknown) {
    const input = resolveSchema.parse(body);
    const schoolId = session.schoolId;
    const row = await prisma.guardianSubmission.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That submission does not exist.");
    if (row.state === "RESOLVED" || row.state === "DECLINED") throw new BadRequestException("That submission is already closed.");
    const state = input.decision.startsWith("Declin") ? "DECLINED" : input.decision.startsWith("In progress") ? "IN_PROGRESS" : "RESOLVED";
    await prisma.guardianSubmission.update({ where: { id }, data: { state, outcome: input.outcome, resolvedAt: state === "IN_PROGRESS" ? null : new Date(), ownerUserId: row.ownerUserId ?? session.userId } });
    if (input.tell && state !== "IN_PROGRESS") await notifyGuardian(schoolId, row.guardianId, `About your ${row.type.toLowerCase()}`, `The school has ${state === "DECLINED" ? "declined" : "resolved"} your ${row.type.toLowerCase()}: ${input.outcome}`, ["In-app", "SMS"]);
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Submission ${state.toLowerCase()} · ${row.type}`, outcome: input.outcome });
    return { id, state };
  }

  async assign(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ owner: z.string().min(1, "Choose who owns it.") }).parse(body);
    const row = await prisma.guardianSubmission.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That submission does not exist.");
    const owner = await prisma.user.findFirst({ where: { id: input.owner, schoolId: session.schoolId }, select: { id: true, firstName: true, lastName: true, role: true } });
    if (!owner) throw new BadRequestException("That person is not on the staff.");
    await prisma.guardianSubmission.update({ where: { id }, data: { ownerUserId: owner.id, ownerName: fullName(owner), state: row.state === "NEW" ? "ASSIGNED" : row.state } });
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Submission assigned · ${fullName(owner)}` });
    return { id };
  }
}
