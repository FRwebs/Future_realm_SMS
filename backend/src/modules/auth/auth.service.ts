import { createHash, randomBytes } from "crypto";

import { BadRequestException, Injectable } from "@nestjs/common";

import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { SessionUser } from "../../../../src/lib/domain/types";

export interface LoginContext {
  ipAddress?: string;
  device?: string;
}

const PASSWORD_RESET_TTL_MINUTES = 30;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  async authenticateUser(email: string, password: string, context: LoginContext = {}): Promise<Omit<SessionUser, "csrfToken"> | null> {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { school: true }
    });

    const recordAttempt = (success: boolean, reason?: string) =>
      prisma.loginAttempt.create({
        data: {
          userId: user?.id,
          schoolId: user?.schoolId,
          email: normalizedEmail,
          success,
          reason,
          ipAddress: context.ipAddress,
          device: context.device
        }
      });

    // Brute-force lockout: 5 or more failed attempts for this email in the last 10 minutes.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentFailures = await prisma.loginAttempt.count({
      where: { email: normalizedEmail, success: false, createdAt: { gte: tenMinutesAgo } }
    });
    if (recentFailures >= 5) {
      await recordAttempt(false, "LOCKED_OUT");
      // Raise a security incident once per lockout window (avoid duplicate open incidents).
      const existingOpen = await prisma.securityIncident.findFirst({
        where: { type: "BRUTE_FORCE_LOCKOUT", status: { not: "RESOLVED" }, description: { contains: normalizedEmail }, detectedAt: { gte: tenMinutesAgo } }
      });
      if (!existingOpen) {
        await prisma.securityIncident.create({
          data: {
            type: "BRUTE_FORCE_LOCKOUT",
            severity: "HIGH",
            status: "DETECTED",
            description: `Account temporarily locked after ${recentFailures}+ failed login attempts for ${normalizedEmail} within 10 minutes.`
          }
        });
      }
      throw new Error("Too many failed login attempts. This account is temporarily locked. Please try again in a few minutes.");
    }

    if (!user || user.deletedAt || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      await recordAttempt(false, !user ? "USER_NOT_FOUND" : !user.isActive || user.deletedAt ? "ACCOUNT_INACTIVE" : "INVALID_PASSWORD");
      return null;
    }

    const settings = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (settings?.maintenanceMode && !isPlatformRole(user.role)) {
      await recordAttempt(false, "MAINTENANCE_MODE");
      throw new Error("The platform is currently in maintenance mode. Please try again later.");
    }

    if (!isPlatformRole(user.role) && (user.school.deletedAt || user.school.status === "SUSPENDED" || user.school.status === "DELETED")) {
      await recordAttempt(false, "SCHOOL_SUSPENDED");
      throw new Error("Your school account has been suspended. Please contact support.");
    }

    await recordAttempt(true);
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

  async requestPasswordReset(email: string, context: LoginContext = {}) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || user.deletedAt || !user.isActive) {
      return { resetUrl: null };
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { consumedAt: new Date() }
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId,
        tokenHash: hashResetToken(token),
        ipAddress: context.ipAddress,
        device: context.device,
        expiresAt
      }
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        action: "RESET_PASSWORD",
        entityType: "User",
        entityId: user.id,
        ipAddress: context.ipAddress,
        metadata: { email: user.email, stage: "REQUESTED", expiresAt: expiresAt.toISOString() }
      }
    });

    return { resetUrl: `/reset-password?token=${token}` };
  }

  async resetPassword(token: string, password: string, context: LoginContext = {}) {
    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!record || record.consumedAt || record.expiresAt <= new Date() || record.user.deletedAt || !record.user.isActive) {
      throw new BadRequestException("This reset link is invalid or has expired.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: hashPassword(password),
          passwordResetRequired: false
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      }),
      prisma.platformSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      }),
      prisma.auditLog.create({
        data: {
          schoolId: record.schoolId,
          actorId: record.userId,
          action: "RESET_PASSWORD",
          entityType: "User",
          entityId: record.userId,
          ipAddress: context.ipAddress,
          metadata: { email: record.user.email, stage: "COMPLETED" }
        }
      })
    ]);

    return true;
  }
}
