import { Injectable } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";

/**
 * What the back office's sign-in page says about itself.
 *
 * This used to hold the back office's extra sign-in conditions too — a platform-role gate, an IP
 * allow list and a requirement that an authenticator app be enrolled — and none of them was ever
 * called. They had looked like enforcement for as long as they existed. Every one is now accounted
 * for where it actually runs: `AuthService.login` checks the IP rules for a platform account and
 * requires a code at every sign-in, `SessionGuard` ends an idle session, and `super-admin/layout`
 * refuses anyone who is not platform staff. Nothing is left here but the four access levels and
 * the two figures the page prints, which are read before anyone has signed in.
 */

/** The page says thirty minutes of inactivity, and `SessionGuard` is what enforces it. */
export const PLATFORM_IDLE_MINUTES = 30;

@Injectable()
export class PlatformAuthService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  /**
   * What the sign-in page shows beside the form.
   *
   * Readable without a session, because it is the page you have not signed in to yet — so it
   * carries no names, no addresses and no counts that would describe the team to a stranger. Only
   * the four levels, and whether the allow list is on.
   */
  async accessControl() {
    const enforced = await prisma.ipAccessRule.count({ where: { type: "ALLOW" } });
    return {
      idleMinutes: PLATFORM_IDLE_MINUTES,
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
