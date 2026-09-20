import { createHash, randomBytes } from "crypto";

import { BadRequestException, Injectable } from "@nestjs/common";

import { verifyTotp } from "../../../../src/lib/auth/mfa";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";
import { SessionUser } from "../../../../src/lib/domain/types";

export interface LoginContext {
  ipAddress?: string;
  device?: string;
}

/** Thrown when a password checks out but the account has MFA enabled and no code was sent yet — lets the controller respond distinctly so the frontend can show a code-entry step instead of a generic error. */
export class MfaRequiredError extends Error {}

const PASSWORD_RESET_TTL_MINUTES = 30;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  async authenticateUser(
    email: string,
    password: string,
    context: LoginContext = {},
    mfaCode?: string
  ): Promise<Omit<SessionUser, "csrfToken"> | null> {
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

    if (isPlatformRole(user.role)) {
      const ipCheck = await this.checkIpAccess(context.ipAddress);
      if (!ipCheck.allowed) {
        await recordAttempt(false, "IP_BLOCKED");
        const tenMinutesAgoForIncident = new Date(Date.now() - 10 * 60 * 1000);
        const existingOpenIncident = await prisma.securityIncident.findFirst({
          where: { type: "IP_BLOCKED_LOGIN", status: { not: "RESOLVED" }, description: { contains: normalizedEmail }, detectedAt: { gte: tenMinutesAgoForIncident } }
        });
        if (!existingOpenIncident) {
          await prisma.securityIncident.create({
            data: {
              type: "IP_BLOCKED_LOGIN",
              severity: "MEDIUM",
              status: "DETECTED",
              description: `Sign-in blocked for ${normalizedEmail} from ${context.ipAddress ?? "an unrecorded address"}: ${ipCheck.reason}.`
            }
          });
        }
        throw new Error("Sign-in from this network isn't permitted for this account. Contact a platform admin if this is a mistake.");
      }
    }

    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new MfaRequiredError("MFA code required.");
      }
      const usedBackupCodeIndex = user.mfaBackupCodeHashes.findIndex((hash) => verifyPassword(mfaCode, hash));
      const validTotp = user.mfaSecret ? verifyTotp(mfaCode, user.mfaSecret) : false;
      if (!validTotp && usedBackupCodeIndex === -1) {
        await recordAttempt(false, "MFA_INVALID");
        throw new Error("Invalid authentication code.");
      }
      if (usedBackupCodeIndex !== -1) {
        const remainingCodes = user.mfaBackupCodeHashes.filter((_, index) => index !== usedBackupCodeIndex);
        await prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodeHashes: remainingCodes } });
      }
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

  /**
   * IpAccessRule enforcement for platform/internal accounts only — school accounts are
   * unaffected. A DENY rule always blocks its exact address. Any ALLOW rule existing at all
   * switches this into allow-list mode: only addresses with a matching ALLOW rule may sign
   * in, and an address that can't be determined is blocked (fail closed).
   */
  private async checkIpAccess(ipAddress?: string): Promise<{ allowed: boolean; reason?: string }> {
    const rules = await prisma.ipAccessRule.findMany();
    if (rules.length === 0) return { allowed: true };

    const denyRules = rules.filter((rule) => rule.type === "DENY");
    const allowRules = rules.filter((rule) => rule.type === "ALLOW");

    if (ipAddress && denyRules.some((rule) => rule.ipAddress === ipAddress)) {
      return { allowed: false, reason: "this address is on the deny list" };
    }

    if (allowRules.length > 0) {
      if (!ipAddress || !allowRules.some((rule) => rule.ipAddress === ipAddress)) {
        return { allowed: false, reason: "this address is not on the allow list" };
      }
    }

    return { allowed: true };
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
