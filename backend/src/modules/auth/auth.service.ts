import { Injectable } from "@nestjs/common";

import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { demoCredentials } from "../../../../src/lib/demo/data";
import { SessionUser } from "../../../../src/lib/domain/types";
import { env } from "../../../../src/lib/utils/env";

const demoPasswordHashes = new Map(
  demoCredentials.map((credential) => [credential.email, hashPassword(credential.password)])
);

@Injectable()
export class AuthService {
  async authenticateUser(email: string, password: string): Promise<Omit<SessionUser, "csrfToken"> | null> {
    if (env.DEMO_MODE) {
      const credential = demoCredentials.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (!credential) return null;
      const expectedPasswordHash = demoPasswordHashes.get(credential.email);
      if (!expectedPasswordHash || !verifyPassword(password, expectedPasswordHash)) return null;

      try {
        if (process.env.VITEST) {
          throw new Error("Skip database-backed demo lookup during tests.");
        }
        const seededUser = await prisma.user.findUnique({
          where: { email: credential.email.toLowerCase() },
          include: { school: true }
        });
        if (seededUser && !seededUser.deletedAt && seededUser.isActive) {
          return {
            userId: seededUser.id,
            schoolId: seededUser.schoolId,
            role: seededUser.role,
            email: seededUser.email,
            name: `${seededUser.firstName} ${seededUser.lastName}`
          };
        }
      } catch {
        // Unit/integration tests can run without Postgres; demo auth still falls back to static credentials.
      }

      return {
        userId: `user_${credential.role.toLowerCase()}`,
        schoolId: "school_greenfield",
        role: credential.role,
        email: credential.email,
        name: credential.name
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { school: true }
    });

    if (!user || user.deletedAt || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return null;
    }

    const settings = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (settings?.maintenanceMode && !isPlatformRole(user.role)) {
      throw new Error("The platform is currently in maintenance mode. Please try again later.");
    }

    if (!isPlatformRole(user.role) && (user.school.deletedAt || user.school.status === "SUSPENDED" || user.school.status === "DELETED")) {
      throw new Error("Your school account has been suspended. Please contact support.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email, role: user.role }
      }
    });

    return {
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    };
  }
}
