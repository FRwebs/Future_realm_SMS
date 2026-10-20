import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, type Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Discounts for NGO and mission schools are grants with an end date, not a plan choice that lasts forever.
 * Each one records who verified it, on what evidence, and when it has to be verified again. The lifecycle engine
 * reminds before it runs out and, if nobody re-verifies, moves the school off the discounted plan.
 */

export const CONCESSION_PLAN = "CUSTOM" as const;
export const FALLBACK_PLAN = "STANDARD" as const;
const FINANCE = new Set(["PLATFORM_OWNER", "PLATFORM_ADMIN", "FINANCE_MANAGER", "SUPER_ADMIN"]);

const grantSchema = z.object({
  schoolId: z.string().min(1, "Choose the school."),
  kind: z.enum(["NGO", "MISSION"]),
  evidence: z.string().trim().min(8, "Say what evidence was seen — a registration certificate, a letter from the mission body."),
  evidenceRef: z.string().trim().optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
});
const decisionSchema = z.object({ reason: z.string().trim().min(5, "Say why.") });
const renewSchema = z.object({ evidence: z.string().trim().min(8, "Say what evidence was seen this time."), months: z.coerce.number().int().min(1).max(24).default(12) });

function assertFinance(session: SessionPayload) {
  if (!FINANCE.has(String(session.role))) throw new BadRequestException("Concessions are decided by platform finance roles.");
}

const month = (from: Date, months: number) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()));

@Injectable()
export class ConcessionsService {
  private async audit(session: SessionPayload, schoolId: string, entityId: string, summary: string, extra: Record<string, unknown> = {}) {
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "Concession", entityId, metadata: { summary, ...extra } as Prisma.InputJsonValue } });
  }

  async list() {
    const rows = await prisma.schoolConcession.findMany({ orderBy: [{ status: "asc" }, { expiresAt: "asc" }], include: { school: { select: { id: true, name: true, plan: true, state: true } } }, take: 300 });
    const names = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((row) => row.verifiedById).filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true } })).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id, schoolId: row.schoolId, school: row.school.name, state: row.school.state, plan: row.school.plan,
      kind: row.kind, status: row.status, evidence: row.evidence, evidenceRef: row.evidenceRef,
      verifiedAt: row.verifiedAt?.toISOString() ?? null, verifiedBy: row.verifiedById ? names.get(row.verifiedById) ?? null : null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      daysLeft: row.expiresAt ? Math.ceil((row.expiresAt.getTime() - now) / 86_400_000) : null,
      revokedReason: row.revokedReason,
    }));
  }

  /** Placing a school on the discount is a grant: it is verified now, on evidence, and ends in `months` unless renewed. */
  async grant(session: SessionPayload, body: unknown) {
    assertFinance(session);
    const input = grantSchema.parse(body);
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException("School not found.");
    if (await prisma.schoolConcession.findFirst({ where: { schoolId: school.id, status: { in: ["PENDING", "VERIFIED"] } } })) throw new BadRequestException("This school already has a concession. Renew or revoke it instead.");
    const now = new Date();
    const concession = await prisma.$transaction(async (tx) => {
      const created = await tx.schoolConcession.create({ data: { schoolId: school.id, kind: input.kind, status: "VERIFIED", evidence: input.evidence, evidenceRef: input.evidenceRef ?? null, verifiedAt: now, verifiedById: session.userId, expiresAt: month(now, input.months), priorPlan: school.plan === CONCESSION_PLAN ? null : school.plan, createdById: session.userId } });
      await tx.school.update({ where: { id: school.id }, data: { plan: CONCESSION_PLAN } });
      return created;
    });
    await this.audit(session, school.id, concession.id, `${input.kind === "NGO" ? "NGO" : "Mission"} concession granted · ${school.name}`, { evidence: input.evidence, expiresAt: concession.expiresAt?.toISOString() });
    return { id: concession.id, expiresAt: concession.expiresAt?.toISOString() };
  }

  /** The year is up and the school is still what it said it was: seen again, on new evidence, for another term. */
  async renew(session: SessionPayload, id: string, body: unknown) {
    assertFinance(session);
    const input = renewSchema.parse(body);
    const row = await prisma.schoolConcession.findUnique({ where: { id }, include: { school: true } });
    if (!row) throw new NotFoundException("That concession does not exist.");
    if (row.status === "REVOKED") throw new BadRequestException("A revoked concession cannot be renewed. Grant a new one.");
    const now = new Date();
    const from = row.status === "VERIFIED" && row.expiresAt && row.expiresAt > now ? row.expiresAt : now;
    await prisma.$transaction([
      prisma.schoolConcession.update({ where: { id }, data: { status: "VERIFIED", evidence: input.evidence, verifiedAt: now, verifiedById: session.userId, expiresAt: month(from, input.months), revokedReason: null } }),
      prisma.school.update({ where: { id: row.schoolId }, data: { plan: CONCESSION_PLAN } }),
    ]);
    await this.audit(session, row.schoolId, id, `Concession re-verified · ${row.school.name}`, { evidence: input.evidence });
    return { renewed: true };
  }

  async revoke(session: SessionPayload, id: string, body: unknown) {
    assertFinance(session);
    const input = decisionSchema.parse(body);
    const row = await prisma.schoolConcession.findUnique({ where: { id }, include: { school: true } });
    if (!row || row.status === "REVOKED") throw new NotFoundException("That concession is not active.");
    await prisma.$transaction([
      prisma.schoolConcession.update({ where: { id }, data: { status: "REVOKED", revokedReason: input.reason } }),
      prisma.school.update({ where: { id: row.schoolId }, data: { plan: row.priorPlan && row.priorPlan !== CONCESSION_PLAN ? (row.priorPlan as never) : FALLBACK_PLAN } }),
    ]);
    await this.audit(session, row.schoolId, id, `Concession revoked · ${row.school.name}`, { reason: input.reason });
    return { revoked: true };
  }
}
