import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalKind, ApprovalStatus, AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const PLATFORM_ROLES: UserRole[] = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"];
const DAY = 86_400_000;
/** How long after a school's approval it can still be used to start an acting session. */
const ELEVATION_VALID_MS = DAY;

const requestSchema = z.object({ email: z.string().trim().email("Enter the school user's email."), reason: z.string().trim().min(10, "Say what needs doing and why — the school will read this.") });
const restrictSchema = z.object({ email: z.string().trim().email(), note: z.string().trim().min(5, "Record the basis for the restriction.") });
const liftSchema = z.object({ note: z.string().trim().min(5, "Record why it is being lifted.") });

@Injectable()
export class SupportAccessService {
  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId?: string | null) {
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    await prisma.auditLog.create({ data: { schoolId: schoolId ?? null, actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  /** Why nobody from the platform may open this account right now, or null when it is allowed. */
  async blockedReason(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (!user) return null;
    const guardian = await prisma.guardian.findFirst({ where: { userId, safeguardingRestrictedAt: { not: null } }, select: { safeguardingNote: true } });
    if (guardian) return "This guardian's account is under a safeguarding restriction. Nobody from the platform may open it until the restriction is lifted.";
    const [transfer, dispute] = await Promise.all([
      prisma.ownershipTransfer.findFirst({ where: { schoolId: user.schoolId, status: { in: ["OBJECTION_RAISED", "FROZEN"] } }, select: { status: true } }),
      prisma.addressDispute.findFirst({ where: { status: { not: "DECIDED" }, webAddressRecord: { schoolId: user.schoolId } }, select: { id: true } })
    ]);
    if (transfer) return `This school has an unresolved ownership dispute (${transfer.status.toLowerCase().replaceAll("_", " ")}). Support access is closed until it is decided.`;
    if (dispute) return "This school's web address is in an unresolved dispute. Support access is closed until it is decided.";
    return null;
  }

  /** A support agent asks the school's leadership to let them act, not just look. It lands in the school's own approvals queue. */
  async requestElevation(session: SessionPayload, body: unknown) {
    const input = requestSchema.parse(body);
    const target = await prisma.user.findFirst({ where: { email: input.email.toLowerCase(), deletedAt: null, isActive: true, role: { notIn: PLATFORM_ROLES } }, include: { school: { select: { id: true, name: true } } } });
    if (!target) throw new NotFoundException("No active school user has that email.");
    const blocked = await this.blockedReason(target.id);
    if (blocked) throw new BadRequestException(blocked);
    const open = await prisma.approvalRequest.findFirst({ where: { schoolId: target.schoolId, subjectType: "SupportAccess", subjectId: target.id, status: ApprovalStatus.PENDING } });
    if (open) throw new BadRequestException("A request to act on this account is already waiting for the school.");
    const requester = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true, firstName: true, lastName: true } });
    const request = await prisma.approvalRequest.create({
      data: {
        schoolId: target.schoolId, kind: ApprovalKind.OTHER, subjectType: "SupportAccess", subjectId: target.id,
        title: `Future Realm support asks to act on ${target.firstName} ${target.lastName}'s account`,
        summary: `${requester ? `${requester.firstName} ${requester.lastName}` : "A support agent"} (Future Realm) asks to make changes, not just look: ${input.reason}`,
        blocking: "A support session that can change records", priority: 5, requestedById: requester?.id, assigneeRole: "SCHOOL_OWNER"
      }
    });
    const owners = await prisma.user.findMany({ where: { schoolId: target.schoolId, isActive: true, deletedAt: null, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] } }, select: { id: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: target.schoolId, userId: owner.id, channel: "IN_APP" as const, title: "Future Realm support is asking for your approval", body: `Support wants to make changes on ${target.firstName} ${target.lastName}'s account. Open Approvals to approve or decline. Until you approve, support can only look.`, status: "QUEUED", sentAt: new Date() })) });
    await this.audit(session, AuditAction.CREATE, "SupportElevation", request.id, { target: target.email, reason: input.reason }, target.schoolId);
    return { id: request.id, school: target.school.name };
  }

  async listElevations() {
    const rows = await prisma.approvalRequest.findMany({ where: { subjectType: "SupportAccess" }, include: { school: { select: { name: true } }, requestedBy: { select: { firstName: true, lastName: true } }, decidedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 60 });
    const targets = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.subjectId).filter((id): id is string => Boolean(id)) } }, select: { id: true, email: true } });
    const email = new Map(targets.map((t) => [t.id, t.email]));
    const used = new Set((await prisma.auditLog.findMany({ where: { action: "IMPERSONATE", createdAt: { gte: new Date(Date.now() - 30 * DAY) } }, select: { metadata: true } })).map((row) => (row.metadata as { elevationId?: string } | null)?.elevationId).filter((id): id is string => Boolean(id)));
    return rows.map((r) => ({
      id: r.id, school: r.school.name, target: r.subjectId ? (email.get(r.subjectId) ?? "—") : "—", summary: r.summary, requestedBy: r.requestedBy ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}` : "—",
      requestedAt: r.createdAt.toISOString(), status: r.status === "APPROVED" && used.has(r.id) ? "USED" : r.status === "APPROVED" && r.decidedAt && Date.now() - r.decidedAt.getTime() > ELEVATION_VALID_MS ? "EXPIRED" : r.status,
      decidedBy: r.decidedBy ? `${r.decidedBy.firstName} ${r.decidedBy.lastName}` : null, decidedAt: r.decidedAt?.toISOString() ?? null, note: r.decisionNote, usable: r.status === "APPROVED" && !used.has(r.id) && Boolean(r.decidedAt) && Date.now() - (r.decidedAt?.getTime() ?? 0) <= ELEVATION_VALID_MS
    }));
  }

  /** Checks an approved request is the one for this person, recent, and not used before. */
  async redeem(elevationId: string, targetUserId: string) {
    const row = await prisma.approvalRequest.findUnique({ where: { id: elevationId } });
    if (!row || row.subjectType !== "SupportAccess" || row.subjectId !== targetUserId) throw new BadRequestException("That approval is not for this account.");
    if (row.status !== ApprovalStatus.APPROVED || !row.decidedAt) throw new BadRequestException("The school has not approved this request.");
    if (Date.now() - row.decidedAt.getTime() > ELEVATION_VALID_MS) throw new BadRequestException("The school's approval has expired (it is valid for 24 hours). Ask again.");
    const used = await prisma.auditLog.findFirst({ where: { action: "IMPERSONATE", metadata: { path: ["elevationId"], equals: elevationId } } });
    if (used) throw new BadRequestException("This approval has already been used for a session.");
    return row;
  }

  /* ───────────────────────── safeguarding restrictions ───────────────────────── */

  async restrictGuardian(session: SessionPayload, body: unknown) {
    const input = restrictSchema.parse(body);
    const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase(), deletedAt: null } });
    const guardian = user ? await prisma.guardian.findFirst({ where: { userId: user.id } }) : null;
    if (!user || !guardian) throw new NotFoundException("No guardian account has that email.");
    if (guardian.safeguardingRestrictedAt) throw new BadRequestException("This guardian is already restricted.");
    await prisma.guardian.update({ where: { id: guardian.id }, data: { safeguardingRestrictedAt: new Date(), safeguardingNote: input.note, safeguardingById: session.userId } });
    await this.audit(session, AuditAction.UPDATE, "Guardian", guardian.id, { safeguardingRestricted: true, note: input.note }, guardian.schoolId);
    return { id: guardian.id };
  }

  async liftRestriction(session: SessionPayload, guardianId: string, body: unknown) {
    const input = liftSchema.parse(body);
    const guardian = await prisma.guardian.findUnique({ where: { id: guardianId } });
    if (!guardian?.safeguardingRestrictedAt) throw new BadRequestException("That guardian is not restricted.");
    await prisma.guardian.update({ where: { id: guardianId }, data: { safeguardingRestrictedAt: null, safeguardingNote: null } });
    await this.audit(session, AuditAction.UPDATE, "Guardian", guardianId, { safeguardingRestricted: false, note: input.note }, guardian.schoolId);
    return { id: guardianId };
  }

  async restrictions() {
    const rows = await prisma.guardian.findMany({ where: { safeguardingRestrictedAt: { not: null } }, include: { school: { select: { name: true } }, user: { select: { email: true } } }, orderBy: { safeguardingRestrictedAt: "desc" } });
    return rows.map((g) => ({ id: g.id, guardian: `${g.firstName} ${g.lastName}`, email: g.user?.email ?? "—", school: g.school.name, since: g.safeguardingRestrictedAt!.toISOString(), note: g.safeguardingNote }));
  }

  /** The school-side notice that a support session has begun, and whether it can change anything. */
  async tellSchool(schoolId: string, who: string, target: string, elevated: boolean, reason: string) {
    const owners = await prisma.user.findMany({ where: { schoolId, isActive: true, deletedAt: null, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] } }, select: { id: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId, userId: owner.id, channel: "IN_APP" as const, title: "A Future Realm support session has started", body: `${who} opened ${target}'s account for up to 30 minutes — ${elevated ? "with your approval to make changes" : "read-only, nothing can be changed"}. Reason given: ${reason}`, status: "QUEUED", sentAt: new Date() })) });
  }
}

export const supportAccess = new SupportAccessService();
export { ForbiddenException };
