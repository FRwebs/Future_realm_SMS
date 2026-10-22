import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { loadPolicy } from "../report-cards/cards.shared";
import { TeacherWorkspaceService } from "./workspace.service";

const submitSchema = z.object({ classId: z.string().min(1, "Say which class.") });

/**
 * A teacher writes remarks as drafts, and submits the class together. Until they do, a remark is the teacher's alone; once they do, it
 * is on the child's result sheet and the Principal reads it. Nothing reaches a family until the Principal publishes the card.
 */
@Injectable()
export class TeacherRemarksService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  async submitArm(session: SessionPayload, body: unknown) {
    const { classId } = submitSchema.parse(body);
    const me = await this.workspace.me(session);
    const arm = me.formArms.find((entry) => entry.id === classId);
    if (!arm) throw new ForbiddenException("You are not the form master of that class, so its remarks are not yours to submit.");
    if (!me.term) throw new BadRequestException("No term is current.");
    const schoolId = session.schoolId;
    const policy = await loadPolicy(schoolId);
    const drafts = await prisma.reportRemark.findMany({ where: { schoolId, termId: me.term.id, classId, author: "FORM_MASTER", state: "DRAFT" } });
    const ready = drafts.filter((row) => row.text.trim().length >= policy.minRemark);
    const short = drafts.length - ready.length;
    if (!ready.length) throw new BadRequestException(drafts.length ? `${drafts.length} draft${drafts.length === 1 ? " is" : "s are"} shorter than ${policy.minRemark} characters. A remark is at least a sentence.` : "There is no draft to submit. Write a remark first.");
    const stamp = new Date();
    for (const row of ready) {
      await prisma.reportRemark.update({ where: { id: row.id }, data: { state: "SUBMITTED", submittedAt: stamp } });
      const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: row.studentId, termId: me.term.id }, select: { id: true, status: true } });
      if (sheet && sheet.status !== "PUBLISHED") await prisma.resultSheet.update({ where: { id: sheet.id }, data: { teacherComment: row.text } });
    }
    const principal = await prisma.user.findFirst({ where: { schoolId, role: "PRINCIPAL", isActive: true, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    if (principal) await prisma.notificationLog.create({ data: { schoolId, userId: principal.id, channel: "IN_APP", title: `${arm.name} remarks submitted`, body: `${me.person.name} has submitted ${ready.length} remark${ready.length === 1 ? "" : "s"} for ${arm.name}.`, status: "QUEUED", sentAt: stamp } });
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "ReportRemark", entityId: classId, metadata: { summary: `Form master remarks submitted · ${arm.name}`, submitted: ready.length, tooShort: short } } });
    return { submitted: ready.length, tooShort: short, to: principal ? fullName(principal) : "the Principal" };
  }

  /** Who a form master's remarks go to, and what it is called there. */
  async recipient(session: SessionPayload) {
    const principal = await prisma.user.findFirst({ where: { schoolId: session.schoolId, role: "PRINCIPAL", isActive: true, deletedAt: null }, select: { firstName: true, lastName: true } });
    return principal ? fullName(principal) : null;
  }
}
