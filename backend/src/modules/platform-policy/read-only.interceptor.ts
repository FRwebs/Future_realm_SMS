import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * A school whose trial has ended is read-only — and so is every school while the platform is in maintenance: it can read, export,
 * and choose a plan, but it cannot change a record.
 * Reads are never touched. Platform staff are never blocked, and neither are the routes that let a school get out of
 * this state (plans, payment, support) or prove who it is (sign-in, profile).
 */

const OPEN = ["/api/v1/auth", "/api/v1/subscription-billing", "/api/v1/support", "/api/v1/onboarding", "/api/v1/profile", "/api/v1/dashboard/context"];
const TTL_MS = 20_000;
const cache = new Map<string, { at: number; reason: string | null }>();

const TRIAL_ENDED = "This school's free trial has ended, so it is read-only. Choose a plan in Subscription & Billing to switch editing back on.";
const MAINTENANCE = "FutureRealm is in maintenance, so every school can read but not change records until it ends.";

/** Why this school cannot change anything right now, or null when it can. */
async function readOnlyReason(schoolId: string): Promise<string | null> {
  const hit = cache.get(schoolId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.reason;
  const [school, settings] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { status: true, billingStatus: true } }),
    prisma.platformSetting.findFirst({ select: { maintenanceMode: true }, orderBy: { createdAt: "asc" } })
  ]);
  const reason = settings?.maintenanceMode ? MAINTENANCE : school?.status === "GRACE_PERIOD" && school.billingStatus === "TRIAL" ? TRIAL_ENDED : null;
  cache.set(schoolId, { at: Date.now(), reason });
  return reason;
}

@Injectable()
export class ReadOnlyInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: SessionPayload }>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next.handle();
    const session = request.user;
    if (!session?.schoolId || isPlatformRole(session.role)) return next.handle();
    const path = request.originalUrl.split("?")[0];
    if (OPEN.some((prefix) => path.startsWith(prefix))) return next.handle();
    const reason = await readOnlyReason(session.schoolId);
    if (reason) throw new ForbiddenException(reason);
    return next.handle();
  }
}

/** Called when a school's state changes, so a paid-up school is not held read-only for the length of the cache. */
export const forgetReadOnly = (schoolId?: string) => (schoolId ? cache.delete(schoolId) : cache.clear());
