import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { API_PREFIXES_BY_MODULE, switchedOffModules } from "./availability";

/**
 * Closes the API of a module the platform has switched off. Hiding it in the sidebar is not enough: the route is still there for
 * anyone who types it, and for an app that already had it open. Platform staff are never blocked — they have to be able to look.
 */
@Injectable()
export class AvailabilityInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: SessionPayload }>();
    const session = request.user;
    if (!session?.schoolId || isPlatformRole(session.role)) return next.handle();
    const path = request.originalUrl.split("?")[0];
    const match = API_PREFIXES_BY_MODULE.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
    if (!match) return next.handle();
    const off = (await switchedOffModules(session.schoolId)).find((module) => module.slug === match[1]);
    if (off) throw new ForbiddenException(`${off.reason} Contact FutureRealm support if you need it back.`);
    return next.handle();
  }
}
