import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { ACTIONS, BACK_OFFICE_MODULES, actionAllowed, actionOfRequest, customActionsFor, levelFor, moduleOfPath } from "./access";

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
    // Nothing set for this person and module, and no exact set of actions: the endpoint's own role check decides, as before.
    if (level === "UNSET" && !(await customActionsFor(session.userId, String(session.role), moduleId))) return next.handle();
    const label = BACK_OFFICE_MODULES.find((m) => m.id === moduleId)?.label ?? moduleId;
    if (level === "NONE") throw new ForbiddenException(`Your access to ${label} is switched off. Ask a Super Admin if you need it.`);
    const action = actionOfRequest(request.method, request.originalUrl.split("?")[0]);
    if (!(await actionAllowed(session.userId, String(session.role), moduleId, action))) {
      const what = ACTIONS.find((a) => a.id === action)?.label.toLowerCase() ?? action;
      throw new ForbiddenException(`You do not have permission to ${what} in ${label}. Ask a Super Admin if you need it.`);
    }
    return next.handle();
  }
}
