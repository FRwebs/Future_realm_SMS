import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { store } from "../staff-access/staff-access.shared";
import { LEADERS, fullName } from "./records.shared";

export const SUPPORT_GROUP = "Learning support plans";
const COUNSELLORS = new Set(["GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR"]);

const planSchema = z.object({
  strategies: z.union([z.string(), z.array(z.object({ area: z.string(), strategy: z.string() }))]),
  reviewedOn: z.string().min(8, "Say when it was last reviewed."),
  nextReviewOn: z.string().min(8, "Say when it is next reviewed."),
  confidentialNote: z.string().trim().max(4000).optional()
});

/** "Seating: Front of the room" per line, or already split. */
export function parseStrategies(input: string | Array<{ area: string; strategy: string }>): Array<{ area: string; strategy: string }> {
  const lines = typeof input === "string" ? input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : input.map((entry) => `${entry.area}: ${entry.strategy}`);
  return lines.map((line) => {
    const at = line.indexOf(":");
    return at > 0 ? { area: line.slice(0, at).trim(), strategy: line.slice(at + 1).trim() } : { area: "General", strategy: line };
  }).filter((entry) => entry.strategy);
}

/**
 * Learning support plans. A plan says what a child's teachers must do — seat them here, give them longer, give one instruction at a
 * time. Every teacher of the child reads that. The reasons behind it, and any diagnosis, are held by the person who wrote it and by
 * the leadership, and are never part of what a teacher is sent. Who may write one is named, not inherited from a role: the school's
 * leadership, its counsellor, and anyone the school has placed in the "Learning support plans" group.
 */
@Injectable()
export class SupportPlansService {
  async canManage(session: Pick<SessionPayload, "userId" | "schoolId" | "role">) {
    if (LEADERS.has(session.role) || COUNSELLORS.has(session.role)) return true;
    const groups = await store(session.schoolId, "sensitive-groups").list<{ holders?: string[] }>();
    return groups.some((group) => group.name.trim().toLowerCase() === SUPPORT_GROUP.toLowerCase() && group.data.holders?.includes(session.userId));
  }

  /** The plan as the people who hold it read it (with its background), or as a teacher does (strategies, review dates, author). */
  async forStudent(session: SessionPayload, studentId: string, as: "manager" | "teacher") {
    const [plan, manage] = await Promise.all([
      prisma.learningSupportPlan.findFirst({ where: { schoolId: session.schoolId, studentId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } }),
      this.canManage(session)
    ]);
    if (!plan) return { plan: null, canManage: as === "manager" && manage };
    const author = await prisma.user.findUnique({ where: { id: plan.authorId }, select: { firstName: true, lastName: true, jobTitle: true } });
    const overdue = plan.nextReviewOn.getTime() < Date.now();
    return {
      canManage: as === "manager" && manage,
      plan: {
        id: plan.id, strategies: plan.strategies as Array<{ area: string; strategy: string }>, reviewedOn: plan.reviewedOn.toISOString(), nextReviewOn: plan.nextReviewOn.toISOString(), overdue,
        author: author ? { name: fullName(author), title: author.jobTitle ?? "" } : null,
        ...(as === "manager" && manage ? { confidentialNote: plan.confidentialNote } : {})
      }
    };
  }

  async save(session: SessionPayload, studentId: string, body: unknown) {
    if (!(await this.canManage(session))) throw new ForbiddenException("A learning support plan is written by the school’s leadership, its counsellor, or someone placed in the Learning support plans group.");
    const input = planSchema.parse(body);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: session.schoolId }, select: { id: true, firstName: true, lastName: true } });
    if (!student) throw new NotFoundException("That child is not on this school’s roll.");
    const strategies = parseStrategies(input.strategies);
    if (!strategies.length) throw new BadRequestException("Write at least one strategy — what the teachers must do, one per line, as “Area: what to do”.");
    const reviewedOn = new Date(`${input.reviewedOn.slice(0, 10)}T00:00:00.000Z`);
    const nextReviewOn = new Date(`${input.nextReviewOn.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(reviewedOn.getTime()) || Number.isNaN(nextReviewOn.getTime())) throw new BadRequestException("Give real dates.");
    if (nextReviewOn < reviewedOn) throw new BadRequestException("The next review cannot come before the last.");
    const existing = await prisma.learningSupportPlan.findFirst({ where: { schoolId: session.schoolId, studentId, status: "ACTIVE" } });
    const data = { strategies, reviewedOn, nextReviewOn, confidentialNote: input.confidentialNote || null, authorId: session.userId };
    const plan = existing ? await prisma.learningSupportPlan.update({ where: { id: existing.id }, data }) : await prisma.learningSupportPlan.create({ data: { schoolId: session.schoolId, studentId, ...data } });
    // The audit line names the child and what changed — never the strategies or the background.
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: existing ? AuditAction.UPDATE : AuditAction.CREATE, entityType: "LearningSupportPlan", entityId: plan.id, metadata: { summary: `Learning support plan ${existing ? "revised" : "written"} · ${student.firstName} ${student.lastName}`, strategies: strategies.length } } });
    return { id: plan.id };
  }

  async end(session: SessionPayload, studentId: string, body: unknown) {
    if (!(await this.canManage(session))) throw new ForbiddenException("Only the people who write a plan may end it.");
    const input = z.object({ reason: z.string().trim().min(5, "Say why the child no longer needs it.") }).parse(body);
    const plan = await prisma.learningSupportPlan.findFirst({ where: { schoolId: session.schoolId, studentId, status: "ACTIVE" } });
    if (!plan) throw new NotFoundException("This child has no active plan.");
    await prisma.learningSupportPlan.update({ where: { id: plan.id }, data: { status: "ENDED", endedAt: new Date(), endedReason: input.reason } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "LearningSupportPlan", entityId: plan.id, metadata: { summary: "Learning support plan ended", reason: input.reason } } });
    return { id: plan.id };
  }

  /** Who has a plan, so a teacher can be told which of their children do — a count and names, never a reason. */
  async activeFor(schoolId: string, studentIds: string[]) {
    if (!studentIds.length) return new Set<string>();
    const rows = await prisma.learningSupportPlan.findMany({ where: { schoolId, status: "ACTIVE", studentId: { in: studentIds } }, select: { studentId: true } });
    return new Set(rows.map((row) => row.studentId));
  }
}
