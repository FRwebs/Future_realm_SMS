import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName, fullName } from "./records.shared";

const COUNSELLORS = ["GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR"] as const;
const FALLBACK = ["PRINCIPAL", "HEAD_TEACHER"] as const;
const decideSchema = z.object({ status: z.enum(["ACKNOWLEDGED", "ACTION_TAKEN", "CLOSED"]), note: z.string().trim().min(5, "Say what was done — the audit stream keeps it.") });

/**
 * Safeguarding concerns: raised by anyone who works with the child, read by the safeguarding lead alone. The lead is the school's
 * counsellor; where a school has none, the Principal holds it, so a concern never lands on nobody. The reader is told only the
 * child, who raised it and what they said; every action is written to a separate audit stream.
 */
@Injectable()
export class SafeguardingService {
  /** Who is told, and who may read: counsellors, or — with none — the Principal (and head teacher). */
  async leads(schoolId: string): Promise<string[]> {
    const counsellors = await prisma.user.findMany({ where: { schoolId, role: { in: [...COUNSELLORS] }, isActive: true, deletedAt: null }, select: { id: true } });
    if (counsellors.length) return counsellors.map((user) => user.id);
    return (await prisma.user.findMany({ where: { schoolId, role: { in: [...FALLBACK] }, isActive: true, deletedAt: null }, select: { id: true } })).map((user) => user.id);
  }

  async canRead(session: Pick<SessionPayload, "userId" | "schoolId">) {
    return (await this.leads(session.schoolId)).includes(session.userId);
  }

  async list(session: SessionPayload) {
    if (!(await this.canRead(session))) return { canRead: false as const, rows: [], open: 0, urgent: 0 };
    const rows = await prisma.safeguardingConcern.findMany({ where: { schoolId: session.schoolId }, orderBy: [{ status: "asc" }, { urgent: "desc" }, { createdAt: "desc" }], take: 100 });
    const students = await prisma.student.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.studentId))] } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true, arm: true } } } });
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.raisedById))] } }, select: { id: true, firstName: true, lastName: true, role: true } });
    const studentOf = new Map(students.map((student) => [student.id, student]));
    const personOf = new Map(people.map((person) => [person.id, person]));
    return {
      canRead: true as const,
      open: rows.filter((row) => row.status === "OPEN").length, urgent: rows.filter((row) => row.status === "OPEN" && row.urgent).length,
      rows: rows.map((row) => {
        const student = studentOf.get(row.studentId);
        const raiser = personOf.get(row.raisedById);
        return { id: row.id, studentId: row.studentId, child: student ? fullName(student) : "A child", adm: student?.admissionNumber ?? "", arm: student?.currentClass ? armName(student.currentClass) : "", raisedBy: raiser ? fullName(raiser) : "A member of staff", role: raiser?.role ?? "", summary: row.summary, urgent: row.urgent, status: row.status, note: row.decisionNote, at: row.createdAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null };
      })
    };
  }

  async decide(session: SessionPayload, id: string, body: unknown) {
    if (!(await this.canRead(session))) throw new ForbiddenException("Safeguarding concerns are held by the safeguarding lead alone.");
    const input = decideSchema.parse(body);
    const concern = await prisma.safeguardingConcern.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!concern) throw new NotFoundException("That concern is not on this school’s record.");
    if (concern.status === "CLOSED") throw new BadRequestException("That concern is closed.");
    await prisma.safeguardingConcern.update({ where: { id }, data: { status: input.status, decisionNote: input.note, decidedAt: new Date(), leadId: session.userId } });
    // The person who raised it is told it was received — never what was decided.
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: concern.raisedById, channel: "IN_APP", title: "Your safeguarding concern was received", body: "The safeguarding lead has it. Thank you for raising it.", status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "SafeguardingConcern", entityId: id, metadata: { summary: `Safeguarding concern ${input.status.toLowerCase().replace("_", " ")}` } } });
    return { id, status: input.status };
  }
}
