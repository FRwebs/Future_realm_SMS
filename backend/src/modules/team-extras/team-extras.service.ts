import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import type { SuperAdminInternalSession, SuperAdminIpAccessRule } from "../../../../src/lib/domain/types";

/**
 * Same "who counts as internal/platform team" set used by SuperAdminService.listInternalTeam,
 * kept in sync here so the Security Settings tab only ever surfaces sessions and never leaks
 * a school-side user's session into this view.
 */
const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

const sessionManagementRoles = new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

function assertSessionManagementRole(session: SessionPayload) {
  assertPlatformRole(session);
  if (!sessionManagementRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("You do not have permission to manage internal-team security settings.");
  }
}

const ipRuleSchema = z.object({
  ipAddress: z.string().trim().min(3, "IP address is required."),
  type: z.enum(["ALLOW", "DENY"]),
  reason: z.string().trim().optional().or(z.literal(""))
});

@Injectable()
export class TeamExtrasService {
  /**
   * Active internal-team sessions (PlatformSession), i.e. sessions belonging to a user whose
   * role is one of the platform roles above. Deliberately excludes revoked/expired sessions —
   * this is "who is currently signed in", not a full history.
   */
  async listInternalSessions(session: SessionPayload): Promise<SuperAdminInternalSession[]> {
    assertPlatformRole(session);

    const sessions = await prisma.platformSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { role: { in: Array.from(platformRoles) } }
      },
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { lastActivityAt: "desc" }
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      role: s.user.role,
      ipAddress: s.ipAddress,
      device: s.device,
      lastActivityAt: s.lastActivityAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString()
    }));
  }

  async revokeInternalSession(session: SessionPayload, sessionId: string) {
    assertSessionManagementRole(session);

    const target = await prisma.platformSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { role: true } } }
    });
    if (!target || !platformRoles.has(target.user.role)) {
      throw new NotFoundException("Session not found.");
    }
    if (target.revokedAt) {
      throw new BadRequestException("This session has already been revoked.");
    }

    await prisma.platformSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.audit(session, "UPDATE", "PlatformSession", sessionId, { forcedLogout: true, scope: "internal-team" });

    return { id: sessionId };
  }

  async listIpRules(session: SessionPayload): Promise<SuperAdminIpAccessRule[]> {
    assertPlatformRole(session);

    const rules = await prisma.ipAccessRule.findMany({ orderBy: { createdAt: "desc" } });

    return rules.map((r) => ({
      id: r.id,
      ipAddress: r.ipAddress,
      type: r.type,
      reason: r.reason,
      createdAt: r.createdAt.toISOString()
    }));
  }

  /**
   * Upserts on the model's [ipAddress, type] unique constraint — re-adding the same
   * address+type pair updates its reason rather than erroring or duplicating.
   */
  async upsertIpRule(session: SessionPayload, body: unknown): Promise<SuperAdminIpAccessRule> {
    assertSessionManagementRole(session);
    const parsed = ipRuleSchema.parse(body);
    const reason = parsed.reason && parsed.reason.trim().length > 0 ? parsed.reason.trim() : null;

    const rule = await prisma.ipAccessRule.upsert({
      where: { ipAddress_type: { ipAddress: parsed.ipAddress, type: parsed.type } },
      create: { ipAddress: parsed.ipAddress, type: parsed.type, reason },
      update: { reason }
    });

    await this.audit(session, "UPDATE", "IpAccessRule", rule.id, { ipAddress: rule.ipAddress, type: rule.type });

    return { id: rule.id, ipAddress: rule.ipAddress, type: rule.type, reason: rule.reason, createdAt: rule.createdAt.toISOString() };
  }

  async deleteIpRule(session: SessionPayload, ruleId: string) {
    assertSessionManagementRole(session);
    const rule = await prisma.ipAccessRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException("IP access rule not found.");

    await prisma.ipAccessRule.delete({ where: { id: ruleId } });
    await this.audit(session, "DELETE", "IpAccessRule", ruleId, { ipAddress: rule.ipAddress, type: rule.type });

    return { id: ruleId };
  }

  private async audit(
    session: SessionPayload,
    action: "CREATE" | "UPDATE" | "DELETE",
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue
  ) {
    const actor = await prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      select: { id: true }
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }
}
