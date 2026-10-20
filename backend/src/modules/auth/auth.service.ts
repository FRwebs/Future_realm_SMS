import { createHash, randomBytes } from "crypto";

import { BadRequestException, Injectable } from "@nestjs/common";

import { verifyTotp } from "../../../../src/lib/auth/mfa";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { assertPasswordNotReused, rememberPassword } from "../../../../src/lib/auth/password-history";
import { looksLikeUserCode, normaliseUserCode } from "../../../../src/lib/auth/user-code";
import { sendEmail } from "../../../../src/lib/integrations/mailer";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";
import { SessionUser } from "../../../../src/lib/domain/types";

export interface LoginContext {
  ipAddress?: string;
  device?: string;
  /** Country (and city) a network edge reported — absent when nothing in front of the API says where the request came from. */
  location?: string;
}

/** Thrown when a password checks out but the account has MFA enabled and no code was sent yet — lets the controller respond distinctly so the frontend can show a code-entry step instead of a generic error. */
export class MfaRequiredError extends Error {
  constructor(message: string, readonly channel: "EMAIL" | "APP" = "APP", readonly sentTo?: string) {
    super(message);
  }
}

/** The people who run the platform, and Principal, Proprietor and Bursar accounts, move money and publish results, so they confirm each sign-in with a code sent to their email. */
const EMAIL_MFA_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "BURSAR", "PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER", "SUPPORT_AGENT", "SALES_MANAGER", "DEVELOPER"]);
const MFA_CODE_TTL_MINUTES = 10;
const MFA_MAX_ATTEMPTS = 3;
const MFA_MAX_CODES = 3;
const MFA_WINDOW_MINUTES = 15;
const LOCK_AFTER_FAILURES = 5;
const LOCK_WINDOW_MINUTES = 10;
const LOCK_FOR_MINUTES = 15;

const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
};

/** Without a mail server the code cannot reach anyone, so requiring it would lock every leader out. AUTH_EMAIL_MFA=on forces it regardless. */
const emailMfaWorks = () => process.env.AUTH_EMAIL_MFA === "on" || (process.env.AUTH_EMAIL_MFA !== "off" && Boolean(process.env.SMTP_HOST));

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
    // The sign-in box takes an email address or the permanent User ID issued at signup.
    const identifier = email.trim();
    const byCode = looksLikeUserCode(identifier);
    const normalizedEmail = byCode ? normaliseUserCode(identifier) : identifier.toLowerCase();
    const user = await prisma.user.findUnique({
      where: byCode ? { userCode: normalizedEmail } : { email: normalizedEmail },
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
          device: context.device,
          location: context.location
        }
      });

    // Brute-force lockout: five failures inside ten minutes lock the account for fifteen, counted from the fifth.
    const since = new Date(Date.now() - (LOCK_WINDOW_MINUTES + LOCK_FOR_MINUTES) * 60 * 1000);
    const failures = await prisma.loginAttempt.findMany({
      // Counted by account, not by what was typed: switching from the email to the User ID does not reset the count.
      where: { OR: [{ email: normalizedEmail }, ...(user ? [{ userId: user.id }] : [])], success: false, createdAt: { gte: since }, reason: { not: "LOCKED_OUT" } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    });
    let lockedUntil: Date | null = null;
    for (let index = LOCK_AFTER_FAILURES - 1; index < failures.length; index += 1) {
      const span = failures[index].createdAt.getTime() - failures[index - (LOCK_AFTER_FAILURES - 1)].createdAt.getTime();
      if (span <= LOCK_WINDOW_MINUTES * 60 * 1000) lockedUntil = new Date(failures[index].createdAt.getTime() + LOCK_FOR_MINUTES * 60 * 1000);
    }
    if (lockedUntil && lockedUntil > new Date()) {
      await recordAttempt(false, "LOCKED_OUT");
      // Raise a security incident once per lockout (avoid duplicate open incidents).
      const existingOpen = await prisma.securityIncident.findFirst({
        where: { type: "BRUTE_FORCE_LOCKOUT", status: { not: "RESOLVED" }, description: { contains: normalizedEmail }, detectedAt: { gte: since } }
      });
      if (!existingOpen) {
        await prisma.securityIncident.create({
          data: {
            type: "BRUTE_FORCE_LOCKOUT",
            severity: "HIGH",
            status: "DETECTED",
            description: `Account locked after ${LOCK_AFTER_FAILURES} failed sign-ins for ${normalizedEmail} within ${LOCK_WINDOW_MINUTES} minutes; locked for ${LOCK_FOR_MINUTES}.`
          }
        });
      }
      const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
      throw new Error(`Too many failed sign-ins. This account is locked for ${minutes} more ${minutes === 1 ? "minute" : "minutes"}.`);
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

    let mfaChannel: "app" | "email" | "skipped" | "none" = "none";
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new MfaRequiredError("MFA code required.", "APP");
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
      mfaChannel = "app";
    } else if (EMAIL_MFA_ROLES.has(String(user.role))) {
      if (!emailMfaWorks()) {
        mfaChannel = "skipped";
      } else if (!mfaCode) {
        await this.sendSignInCode(user.id, user.email);
        throw new MfaRequiredError("A code has been sent to your email.", "EMAIL", maskEmail(user.email));
      } else {
        await this.checkSignInCode(user.id, mfaCode, recordAttempt);
        mfaChannel = "email";
      }
    }

    // A device this person has never signed in from. The very first sign-in has nothing to compare with, so it is not flagged.
    const earlier = await prisma.loginAttempt.findMany({ where: { userId: user.id, success: true }, select: { device: true }, take: 200 });
    const newDevice = earlier.length > 0 && Boolean(context.device) && !earlier.some((row) => row.device === context.device);
    await prisma.loginAttempt.create({ data: { userId: user.id, schoolId: user.schoolId, email: normalizedEmail, success: true, ipAddress: context.ipAddress, device: context.device, location: context.location, newDevice } });
    if (newDevice && EMAIL_MFA_ROLES.has(String(user.role))) {
      await sendEmail({
        to: user.email,
        subject: "New sign-in to your Future Realm account",
        text: `Your account was just signed in to from a device we have not seen before${context.location ? ` (${context.location})` : ""}.\n\nDevice: ${context.device ?? "unknown"}\nAddress: ${context.ipAddress ?? "unknown"}\n\nIf this was you, there is nothing to do. If it was not, change your password now and tell your administrator.`
      }).catch(() => undefined);
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
        metadata: { email: user.email, role: user.role, signedInWith: byCode ? "USER_ID" : "EMAIL", mfa: mfaChannel, ...(newDevice ? { newDevice: true } : {}) }
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

  /** One code at a time, valid ten minutes, three tries, and never more than three codes in fifteen minutes. */
  private async sendSignInCode(userId: string, email: string) {
    const windowStart = new Date(Date.now() - MFA_WINDOW_MINUTES * 60 * 1000);
    const recent = await prisma.emailVerificationCode.count({ where: { userId, purpose: "LOGIN_MFA", createdAt: { gt: windowStart } } });
    if (recent >= MFA_MAX_CODES) throw new Error("Too many codes requested. Wait a few minutes and sign in again.");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.emailVerificationCode.updateMany({ where: { userId, purpose: "LOGIN_MFA", consumedAt: null }, data: { consumedAt: new Date() } });
    await prisma.emailVerificationCode.create({ data: { userId, email, purpose: "LOGIN_MFA", codeHash: hashPassword(code), expiresAt: new Date(Date.now() + MFA_CODE_TTL_MINUTES * 60 * 1000) } });
    await sendEmail({ to: email, subject: "Your sign-in code", text: `Your sign-in code is ${code}. It is valid for ${MFA_CODE_TTL_MINUTES} minutes and allows ${MFA_MAX_ATTEMPTS} attempts. If you did not just try to sign in, change your password.` });
  }

  private async checkSignInCode(userId: string, code: string, recordAttempt: (success: boolean, reason?: string) => Promise<unknown>) {
    const record = await prisma.emailVerificationCode.findFirst({ where: { userId, purpose: "LOGIN_MFA", consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!record) throw new Error("That code has expired. Sign in again to get a new one.");
    if (record.attempts >= MFA_MAX_ATTEMPTS) throw new Error("Too many wrong codes. Sign in again to get a new one.");
    if (!verifyPassword(code.trim(), record.codeHash)) {
      await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      await recordAttempt(false, "MFA_INVALID");
      throw new Error("That code is not right.");
    }
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
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

    try {
      await assertPasswordNotReused(record.userId, password, record.user.passwordHash);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Choose a different password.");
    }
    const nextHash = hashPassword(password);
    await rememberPassword(record.userId, record.user.passwordHash);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: nextHash,
          passwordChangedAt: new Date(),
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
