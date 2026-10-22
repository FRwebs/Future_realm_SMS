import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { assertStudentArmReadable } from "../../common/teaching-scope";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";

const incidentSchema = z.object({
  studentId: z.string().min(1, "Choose the child."),
  category: z.string().trim().min(2, "Say what kind of incident it was."),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  description: z.string().trim().min(10, "Say what happened, in a sentence or two."),
  when: z.string().optional(),
});
const concernSchema = z.object({
  studentId: z.string().min(1, "Choose the child."),
  summary: z.string().trim().min(10, "Say what you saw or heard, in your own words."),
  urgent: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
});
const changeSchema = z.object({
  studentId: z.string().min(1, "Choose the child."),
  field: z.string().trim().min(2, "Say what should change."),
  after: z.string().trim().min(1, "Say what it should become."),
  reason: z.string().trim().min(8, "Say why — the Principal reads it."),
});

const LEAD_ROLES = ["GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR"] as const;

/**
 * The three things a teacher may raise about a child without ever being allowed to read what happens next: an incident (it goes to the
 * deputy for administration), a safeguarding concern (it goes to the safeguarding lead and nobody else), and a change to the child's
 * record (it is a request with a reason, and the Principal decides it). A teacher reports; they never open the file.
 */
@Injectable()
export class TeacherConcernsService {
  private async child(session: SessionPayload, studentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: session.schoolId }, select: { id: true, firstName: true, lastName: true, currentClassId: true } });
    if (!student) throw new NotFoundException("That child is not in this school.");
    await assertStudentArmReadable(session, student.currentClassId);
    return student;
  }

  private async notify(schoolId: string, userIds: string[], title: string, body: string) {
    if (!userIds.length) return;
    await prisma.notificationLog.createMany({ data: userIds.map((userId) => ({ schoolId, userId, channel: "IN_APP" as const, title, body, status: "QUEUED", sentAt: new Date() })) });
  }

  async incident(session: SessionPayload, body: unknown) {
    const input = incidentSchema.parse(body);
    const student = await this.child(session, input.studentId);
    const deputy = await prisma.user.findFirst({ where: { schoolId: session.schoolId, role: "VICE_PRINCIPAL_ADMINISTRATION", isActive: true, deletedAt: null }, select: { id: true } })
      ?? (await prisma.user.findFirst({ where: { schoolId: session.schoolId, role: "PRINCIPAL", isActive: true, deletedAt: null }, select: { id: true } }));
    const row = await prisma.disciplineRecord.create({ data: { schoolId: session.schoolId, studentId: student.id, classId: student.currentClassId, reporterId: session.userId, escalatedToId: deputy?.id ?? null, category: input.category, severity: input.severity, description: input.description, occurredAt: input.when ? new Date(input.when) : new Date() } });
    await this.notify(session.schoolId, deputy ? [deputy.id] : [], `Incident reported · ${fullName(student)}`, `${input.category}: ${input.description.slice(0, 160)}`);
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "DisciplineRecord", entityId: row.id, metadata: { summary: `Incident reported · ${fullName(student)}`, category: input.category, severity: input.severity } } });
    return { id: row.id, goesTo: deputy ? "the Deputy — Administration" : "the Principal" };
  }

  async concern(session: SessionPayload, body: unknown) {
    const input = concernSchema.parse(body);
    const student = await this.child(session, input.studentId);
    const leads = await prisma.user.findMany({ where: { schoolId: session.schoolId, role: { in: [...LEAD_ROLES] }, isActive: true, deletedAt: null }, select: { id: true } });
    const row = await prisma.safeguardingConcern.create({ data: { schoolId: session.schoolId, studentId: student.id, raisedById: session.userId, summary: input.summary, urgent: input.urgent, leadId: leads[0]?.id ?? null } });
    // The notification names nobody and says nothing of what was seen — only that there is something to read.
    await this.notify(session.schoolId, leads.map((lead) => lead.id), input.urgent ? "An urgent safeguarding concern has been raised" : "A safeguarding concern has been raised", "Open Student Records to read it. It is visible to you alone.");
    // A separate audit stream: this action is recorded under its own entity, never against the child's ordinary record.
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "SafeguardingConcern", entityId: row.id, metadata: { summary: "A safeguarding concern was raised", urgent: input.urgent } } });
    return { id: row.id, told: leads.length };
  }

  async change(session: SessionPayload, body: unknown) {
    const input = changeSchema.parse(body);
    const student = await this.child(session, input.studentId);
    if (/^(fee|balance|invoice)/i.test(input.field)) throw new ForbiddenException("A fee is not part of a teacher's scope, so it cannot be asked about here.");
    const row = await prisma.studentChangeRequest.create({ data: { schoolId: session.schoolId, studentId: student.id, field: input.field, after: input.after, reason: input.reason, requestedById: session.userId } });
    const principal = await prisma.user.findFirst({ where: { schoolId: session.schoolId, role: "PRINCIPAL", isActive: true, deletedAt: null }, select: { id: true } });
    await this.notify(session.schoolId, principal ? [principal.id] : [], `Record change requested · ${fullName(student)}`, `${input.field}: ${input.after}`);
    return { id: row.id };
  }
}
