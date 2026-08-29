import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

const userContextSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  schoolId: true,
  accountStatus: true,
  isActive: true,
  suspendedAt: true,
  passwordResetRequired: true,
  lastLoginAt: true,
  school: { select: { name: true } }
} as const;

/**
 * Read-only enrichment for the Super Admin "Reviews & Cases" case-review board (Users page).
 * Adds real, previously-unexposed fields (school name, account status, recent login attempts)
 * to the same open suspicious-activity flags, pending duplicate flags, and recovery records the
 * existing super-admin endpoints already list — no new writes, no new data sources invented.
 */
@Injectable()
export class UserCaseContextService {
  async getCaseReviewContext(session: SessionPayload) {
    assertPlatformRole(session);

    const [suspiciousFlags, duplicateFlags, recoveryRecords] = await Promise.all([
      prisma.suspiciousActivityFlag.findMany({
        where: { resolvedAt: null },
        include: { user: { select: userContextSelect } },
        orderBy: { detectedAt: "desc" }
      }),
      prisma.duplicateFlag.findMany({
        where: { status: "PENDING" },
        include: {
          userA: { select: userContextSelect },
          userB: { select: userContextSelect }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.accountRecoveryRecord.findMany({
        include: { user: { select: userContextSelect } },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    const flaggedUserIds = Array.from(new Set(suspiciousFlags.map((flag) => flag.userId)));
    const loginAttemptsByUser = new Map<string, Array<{ success: boolean; reason: string | null; ipAddress: string | null; device: string | null; createdAt: string }>>();
    if (flaggedUserIds.length > 0) {
      const attempts = await prisma.loginAttempt.findMany({
        where: { userId: { in: flaggedUserIds } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { userId: true, success: true, reason: true, ipAddress: true, device: true, createdAt: true }
      });
      for (const attempt of attempts) {
        if (!attempt.userId) continue;
        const list = loginAttemptsByUser.get(attempt.userId) ?? [];
        if (list.length < 5) list.push({ success: attempt.success, reason: attempt.reason, ipAddress: attempt.ipAddress, device: attempt.device, createdAt: attempt.createdAt.toISOString() });
        loginAttemptsByUser.set(attempt.userId, list);
      }
    }

    return {
      ok: true,
      data: {
        suspicious: suspiciousFlags.map((flag) => ({
          flagId: flag.id,
          schoolId: flag.user.schoolId,
          schoolName: flag.user.school.name,
          accountStatus: flag.user.accountStatus,
          isActive: flag.user.isActive,
          suspendedAt: flag.user.suspendedAt?.toISOString() ?? null,
          passwordResetRequired: flag.user.passwordResetRequired,
          lastLoginAt: flag.user.lastLoginAt?.toISOString() ?? null,
          loginAttempts: loginAttemptsByUser.get(flag.userId) ?? []
        })),
        duplicates: duplicateFlags.map((flag) => ({
          flagId: flag.id,
          userA: { schoolId: flag.userA.schoolId, schoolName: flag.userA.school.name, accountStatus: flag.userA.accountStatus, isActive: flag.userA.isActive },
          userB: { schoolId: flag.userB.schoolId, schoolName: flag.userB.school.name, accountStatus: flag.userB.accountStatus, isActive: flag.userB.isActive }
        })),
        recovery: recoveryRecords.map((record) => ({
          recordId: record.id,
          schoolId: record.user.schoolId,
          schoolName: record.user.school.name,
          accountStatus: record.user.accountStatus,
          isActive: record.user.isActive
        }))
      }
    };
  }
}
