import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { SessionPayload } from "../../../src/lib/auth/session-core";
import { isPlatformRole } from "../../../src/lib/auth/role-architecture";
import { RolesManagementService } from "../modules/roles-management/roles-management.service";
import { REQUIRED_PERMISSION_KEY } from "./require-permission.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesManagementService: RolesManagementService
  ) {}

  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: SessionPayload; params?: { schoolId?: string } }>();
    const session = request.user;
    const schoolId = request.params?.schoolId ?? session?.schoolId;
    if (!session || !schoolId || (session.schoolId !== schoolId && !isPlatformRole(session.role))) {
      throw new ForbiddenException("You cannot access roles for this school.");
    }

    const permissions = await this.rolesManagementService.resolveUserPermissions(session.userId, schoolId, session);
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return true;
  }
}
