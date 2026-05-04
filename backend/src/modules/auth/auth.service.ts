import { Injectable } from "@nestjs/common";

import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { SessionUser } from "../../../../src/lib/domain/types";

@Injectable()
export class AuthService {
  async authenticateUser(email: string, password: string): Promise<Omit<SessionUser, "csrfToken"> | null> {
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
