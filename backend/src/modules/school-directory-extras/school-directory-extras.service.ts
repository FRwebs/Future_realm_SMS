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

export interface SchoolDormancyRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  lastSuccessfulLoginAt: string | null;
}

@Injectable()
export class SchoolDirectoryExtrasService {
  /**
   * Real-signal dormancy view: for every non-deleted school, the timestamp of the
   * most recent *successful* login recorded across any of its users (LoginAttempt.schoolId).
   * A school with no successful login on record ever shows `lastSuccessfulLoginAt: null` —
   * that absence is the honest signal rather than a fabricated "days inactive" number.
   */
  async listDormancy(session: SessionPayload): Promise<SchoolDormancyRow[]> {
    assertPlatformRole(session);

    const [schools, lastLogins] = await Promise.all([
      prisma.school.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, status: true, createdAt: true }
      }),
      prisma.loginAttempt.groupBy({
        by: ["schoolId"],
        where: { success: true, schoolId: { not: null } },
        _max: { createdAt: true }
      })
    ]);

    const lastLoginMap = new Map<string, Date>();
    for (const row of lastLogins) {
      if (row.schoolId && row._max.createdAt) {
        lastLoginMap.set(row.schoolId, row._max.createdAt);
      }
    }

    return schools
      .map((school) => ({
        id: school.id,
        name: school.name,
        status: school.status,
        createdAt: school.createdAt.toISOString(),
        lastSuccessfulLoginAt: lastLoginMap.get(school.id)?.toISOString() ?? null
      }))
      .sort((a, b) => {
        // Never-logged-in schools first, then oldest last-login first.
        if (a.lastSuccessfulLoginAt === null && b.lastSuccessfulLoginAt === null) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (a.lastSuccessfulLoginAt === null) return -1;
        if (b.lastSuccessfulLoginAt === null) return 1;
        return new Date(a.lastSuccessfulLoginAt).getTime() - new Date(b.lastSuccessfulLoginAt).getTime();
      });
  }
}
