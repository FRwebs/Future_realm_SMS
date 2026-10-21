import { createHash } from "crypto";

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../src/lib/auth/role-architecture";
import { prisma } from "../../../src/lib/db/prisma";
import { memberships } from "../modules/memberships/memberships.service";

type AuthenticatedRequest = Request & {
  user?: Awaited<ReturnType<typeof verifySessionToken>>;
};

function getBearerToken(authorization?: string) {
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/**
 * A signed session is trusted as issued — until the person it names has changed. Every request is checked (cached for a
 * few seconds, so it costs one lookup in many) against the account itself: switched off, removed, given a different role,
 * signed out from the Sessions list — or its school suspended or removed by the Back Office. Any of those ends the session on the
 * next request, not at the next sign-in.
 */
const STATE_TTL_MS = 10_000;
/** Back Office accounts are signed out after this long without a request. 0 turns it off. School accounts keep their full session. */
const IDLE_MINUTES = Number(process.env.PLATFORM_IDLE_MINUTES ?? 30);
const state = new Map<string, { at: number; ok: boolean; reason: string | null }>();

async function accountStillMatches(userId: string, role: string, tokenHash: string, schoolId: string): Promise<{ ok: boolean; reason: string | null }> {
  const key = `${userId}:${tokenHash}`;
  const hit = state.get(key);
  if (hit && Date.now() - hit.at < STATE_TTL_MS) return hit;
  const [user, platformSession, school] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, deletedAt: true, role: true } }),
    prisma.platformSession.findFirst({ where: { tokenHash }, select: { revokedAt: true, lastActivityAt: true } }),
    schoolId ? prisma.school.findUnique({ where: { id: schoolId }, select: { status: true, deletedAt: true } }) : Promise.resolve(null)
  ]);
  const result = !user || user.deletedAt || !user.isActive
    ? { ok: false, reason: "This account has been switched off." }
    : !isPlatformRole(user.role) && school && (school.deletedAt || school.status === "SUSPENDED" || school.status === "DELETED")
      ? { ok: false, reason: "Your school account has been suspended. Please contact support." }
    : String(user.role) !== role && !(await memberships.holds(userId, schoolId, role))
      ? { ok: false, reason: "Your access has changed. Sign in again." }
      : platformSession?.revokedAt
        ? { ok: false, reason: "This session was signed out." }
        : platformSession && IDLE_MINUTES > 0 && isPlatformRole(user.role) && Date.now() - platformSession.lastActivityAt.getTime() > IDLE_MINUTES * 60_000
          ? { ok: false, reason: `Signed out after ${IDLE_MINUTES} minutes without activity. Sign in again.` }
          : { ok: true, reason: null };
  state.set(key, { at: Date.now(), ...result });
  return result;
}

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] ?? getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Unauthorized");
    }

    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unauthorized");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const standing = await accountStillMatches(session.userId, String(session.role), tokenHash, session.schoolId);
    if (!standing.ok) throw new UnauthorizedException(standing.reason ?? "Unauthorized");

    request.user = session;
    // Fire-and-forget so request latency is unaffected; keeps "online now" widgets and
    // session-based suspicious-activity detection working off real activity data.
    prisma.platformSession
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { lastActivityAt: new Date() }
      })
      .catch(() => undefined);
    return true;
  }
}
