import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { hasRole } from "../../../src/lib/auth/roles";
import { Role } from "../../../src/lib/domain/types";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { role: Role } }>();
    const role = request.user?.role;
    if (!role || !hasRole(role, roles)) {
      throw new ForbiddenException("Forbidden");
    }

    return true;
  }
}
