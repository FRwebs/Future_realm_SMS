import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";

const ALLOWED = ["/api/v1/auth/logout", "/api/v1/telemetry"];

/**
 * A support session opened without the school's approval is read-only: every change is refused. A session opened
 * with an approved request (`elevated`) can act, until it expires.
 */
@Injectable()
export class SupportSessionInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: SessionPayload }>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next.handle();
    const impersonation = request.user?.impersonation as { elevated?: boolean } | undefined;
    if (!impersonation || impersonation.elevated) return next.handle();
    const path = request.originalUrl.split("?")[0];
    if (ALLOWED.some((prefix) => path.startsWith(prefix))) return next.handle();
    throw new ForbiddenException("This is a read-only support session — nothing can be changed. Support can ask your school's leadership for approval to act, from Support Access.");
  }
}
