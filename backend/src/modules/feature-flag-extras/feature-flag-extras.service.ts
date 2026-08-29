import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Feature-flag / exceptions review actions that the main SuperAdminService does not (yet)
 * expose — approving overrides already exists there; rejecting a pending override and
 * revoking a previously-approved one do not. This module adds only those two real,
 * narrowly-scoped mutations plus a read endpoint that surfaces the existing AuditLog trail
 * for overrides / branding assets (the log is written by SuperAdminService.audit() already;
 * nothing here invents new data, it only reads what's already recorded).
 */
const reviewerRoles = new Set<UserRole>(["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"]);

function assertReviewer(session: SessionPayload) {
  if (!reviewerRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Reviewing feature-flag exceptions is restricted to Product Lead and Super Admin.");
  }
}

const reasonSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required.")
});

export interface CaseHistoryEvent {
  what: string;
  when: string;
}

function actorLabel(actor: { firstName: string; lastName: string } | null) {
  return actor ? `${actor.firstName} ${actor.lastName}` : "System";
}

function describeOverrideEvent(action: string, metadata: Record<string, unknown>, actor: string): string {
  if (metadata.requested) return `Requested by ${actor}`;
  if (metadata.approved) return `Approved by ${actor}`;
  if (metadata.rejected) return `Rejected by ${actor}${typeof metadata.reason === "string" && metadata.reason ? ` — ${metadata.reason}` : ""}`;
  if (metadata.revoked) return `Revoked by ${actor}${typeof metadata.reason === "string" && metadata.reason ? ` — ${metadata.reason}` : ""}`;
  return `${action.replaceAll("_", " ")} by ${actor}`;
}

function describeBrandingEvent(action: string, metadata: Record<string, unknown>, actor: string): string {
  if (action === "CREATE") return `Submitted by ${actor}`;
  if (action === "APPROVE") return `Approved by ${actor}`;
  if (metadata.applied) return `Applied by ${actor}`;
  return `${action.replaceAll("_", " ")} by ${actor}`;
}

@Injectable()
export class FeatureFlagExtrasService {
  async caseHistory(session: SessionPayload) {
    assertReviewer(session);

    const [overrideLogs, brandingLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: "PlatformFeatureFlagOverride" },
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.auditLog.findMany({
        where: { entityType: "BrandingAsset" },
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const overrides: Record<string, CaseHistoryEvent[]> = {};
    for (const log of overrideLogs) {
      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
      const actor = actorLabel(log.actor);
      (overrides[log.entityId] ??= []).push({
        what: describeOverrideEvent(log.action, metadata, actor),
        when: log.createdAt.toISOString()
      });
    }

    const branding: Record<string, CaseHistoryEvent[]> = {};
    for (const log of brandingLogs) {
      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
      const actor = actorLabel(log.actor);
      (branding[log.entityId] ??= []).push({
        what: describeBrandingEvent(log.action, metadata, actor),
        when: log.createdAt.toISOString()
      });
    }

    return { data: { overrides, branding } };
  }

  async rejectOverride(session: SessionPayload, overrideId: string, payload: unknown) {
    assertReviewer(session);
    const parsed = reasonSchema.parse(payload);
    const override = await prisma.platformFeatureFlagOverride.findUnique({ where: { id: overrideId } });
    if (!override) throw new NotFoundException("Override request not found.");
    if (override.status !== "PENDING") throw new BadRequestException("Only a pending override request can be rejected.");

    const updated = await prisma.platformFeatureFlagOverride.update({
      where: { id: overrideId },
      data: { status: "REJECTED", approvedById: session.userId }
    });
    await this.audit(session, "REJECT", "PlatformFeatureFlagOverride", updated.id, { rejected: true, reason: parsed.reason }, override.schoolId);
    return { data: { id: updated.id, status: updated.status } };
  }

  async revokeOverride(session: SessionPayload, overrideId: string, payload: unknown) {
    assertReviewer(session);
    const parsed = reasonSchema.parse(payload);
    const override = await prisma.platformFeatureFlagOverride.findUnique({ where: { id: overrideId } });
    if (!override) throw new NotFoundException("Override request not found.");
    if (override.status !== "APPROVED") throw new BadRequestException("Only an approved override can be revoked.");

    const updated = await prisma.platformFeatureFlagOverride.update({
      where: { id: overrideId },
      data: { status: "REVOKED", enabled: false }
    });
    await this.audit(session, "UPDATE", "PlatformFeatureFlagOverride", updated.id, { revoked: true, reason: parsed.reason }, override.schoolId);
    return { data: { id: updated.id, status: updated.status } };
  }

  private async audit(
    session: SessionPayload,
    action: "REJECT" | "UPDATE",
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    schoolId: string | null
  ) {
    const actor = await prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      select: { id: true }
    });
    await prisma.auditLog.create({
      data: {
        schoolId: schoolId ?? null,
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }
}
