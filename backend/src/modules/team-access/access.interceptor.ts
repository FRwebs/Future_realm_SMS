import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { BACK_OFFICE_MODULES, RANK, levelFor, moduleOfPath } from "./access";

/**
 * The per-module access grid, read on every Back Office request. Reading needs View; changing needs Edit; deleting needs
 * Full. Where nothing has been set for a person and module the endpoint's own role check decides, as before.
 */
@Injectable()
export class AccessInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: SessionPayload }>();
    const session = request.user;
    if (!session || !isPlatformRole(session.role)) return next.handle();
    const moduleId = moduleOfPath(request.originalUrl.split("?")[0]);
    if (!moduleId) return next.handle();
    const level = await levelFor(session.userId, String(session.role), moduleId);
    if (level === "UNSET") return next.handle();
    const label = BACK_OFFICE_MODULES.find((m) => m.id === moduleId)?.label ?? moduleId;
    const method = request.method.toUpperCase();
    const reading = ["GET", "HEAD", "OPTIONS"].includes(method);
    if (level === "NONE") throw new ForbiddenException(`Your access to ${label} is switched off. Ask a Super Admin if you need it.`);
    if (!reading && RANK[level] < RANK.EDIT) throw new ForbiddenException(`You can view ${label} but not change it.`);
    if (method === "DELETE" && RANK[level] < RANK.FULL) throw new ForbiddenException(`Deleting in ${label} needs full access; you have edit access.`);
    return next.handle();
  }
}
