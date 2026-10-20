import { ForbiddenException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The extra conditions the back office puts on signing in.
 *
 * Deliberately not a second login endpoint: `AuthService.login` already does
 * passwords, TOTP, backup codes and sessions, and a parallel copy of that is
 * how two sign-in paths drift until one of them is weaker. This adds only what
 * the back office needs on top and the school login must not have — a platform
 * role, an address on the allow list, and a browser that may skip the second
 * factor for thirty days.
 */

const DAY = 86_400_000;
/** The page says thirty days, so the row and the cookie agree on thirty days. */
export const TRUST_DAYS = 30;
/** The page says thirty minutes of inactivity. */
export const PLATFORM_IDLE_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class PlatformAuthService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  /**
   * The allow list, when one exists.
   *
   * An empty ALLOW list means "not enforced" rather than "nobody": a Super
   * Admin who has not turned this on should not be locked out by it. A DENY
   * entry always wins.
   */
  async ipAllowed(ip: string | null): Promise<boolean> {
    const address = (ip ?? "").trim();
    const [allow, denied] = await Promise.all([
      prisma.ipAccessRule.findMany({ where: { type: "ALLOW" }, select: { ipAddress: true } }),
      prisma.ipAccessRule.count({ where: { type: "DENY", ipAddress: address } }),
    ]);
    if (denied > 0) return false;
    if (allow.length === 0) return true;
    return Boolean(address) && allow.some((rule) => rule.ipAddress === address);
  }

  /**
   * Run before a platform account is allowed through. Throws rather than
   * returning a boolean, because every refusal here has a different sentence
   * and the person reading it needs to know which one applies to them.
   */
  async assertMayUseBackOffice(
    user: { id: string; role: string; mfaEnabled: boolean },
    ip: string | null,
  ): Promise<void> {
    if (!isPlatformRole(user.role)) {
      throw new ForbiddenException(
        "This sign-in is for Nooria team accounts. Schools sign in at their own workspace.",
      );
    }
    if (!(await this.ipAllowed(ip))) {
      throw new ForbiddenException(
        "This address is not on the allow list for the back office. Contact a Super Admin.",
      );
    }
    // The page says multi-factor is required for every admin login. An account
    // without it enrolled cannot sign in here at all, or that sentence is not
    // true.
    if (!user.mfaEnabled) {
      throw new ForbiddenException(
        "Multi-factor authentication is required for the back office, and this account has none enrolled. A Super Admin must enrol it first.",
      );
    }
  }

  /** Whether this browser was trusted earlier, and is still within its window. */
  async deviceIsTrusted(userId: string, token: string | undefined, ip: string | null) {
    if (!token) return false;
    const device = await prisma.adminTrustedDevice.findFirst({
      where: { userId, tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!device) return false;
    await prisma.adminTrustedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date(), ipAddress: ip },
    });
    return true;
  }

  /**
   * Trust this browser for thirty days. The token is returned once, to be set
   * as a cookie, and stored only as a hash — a readable table of these would be
   * a list of ways past MFA.
   */
  async trustDevice(userId: string, ip: string | null, label?: string) {
    const token = randomBytes(32).toString("hex");
    await prisma.adminTrustedDevice.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        label: label ?? null,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + TRUST_DAYS * DAY),
      },
    });
    return token;
  }

  /**
   * What the sign-in page shows beside the form.
   *
   * Readable without a session, because it is the page you have not signed in
   * to yet — so it carries no names, no addresses and no counts that would
   * describe the team to a stranger. Only the four levels, and whether the
   * allow list is on.
   */
  async accessControl() {
    const enforced = await prisma.ipAccessRule.count({ where: { type: "ALLOW" } });
    return {
      idleMinutes: PLATFORM_IDLE_MINUTES,
      trustDays: TRUST_DAYS,
      ipAllowListEnforced: enforced > 0,
      levels: [
        { level: "1", role: "Super Admin", scope: "Every module, every function · Global data scope" },
        { level: "2", role: "Department Lead", scope: "Full within own department, at or below a set ceiling" },
        { level: "3", role: "Team Member", scope: "Function-scoped, normally Assigned or Portfolio scope" },
        { level: "4", role: "Read-Only / Advisor", scope: "View-only, scope None — aggregates without identities" },
      ],
    };
  }
}
