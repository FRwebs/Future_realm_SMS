import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { RolesManagementService } from "./roles-management.service";

@ApiTags("roles-management")
@Controller("v1/school/:schoolId/roles-management")
@UseGuards(SessionGuard, PermissionsGuard)
export class RolesManagementController {
  constructor(private readonly rolesManagementService: RolesManagementService) {}

  @Get("roles")
  @RequirePermission("roles.view")
  listRoles(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.rolesManagementService.listRoles(session, schoolId);
  }

  @Post("roles")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.create")
  createRole(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.rolesManagementService.createRole(session, schoolId, body);
  }

  @Get("roles/:roleId")
  @RequirePermission("roles.view")
  getRole(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("roleId") roleId: string) {
    return this.rolesManagementService.getRole(session, schoolId, roleId);
  }

  @Patch("roles/:roleId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.edit")
  updateRole(
    @CurrentSession() session: SessionPayload,
    @Param("schoolId") schoolId: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown
  ) {
    return this.rolesManagementService.updateRole(session, schoolId, roleId, body);
  }

  @Delete("roles/:roleId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.delete")
  deleteRole(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("roleId") roleId: string) {
    return this.rolesManagementService.deleteRole(session, schoolId, roleId);
  }

  @Get("roles/:roleId/staff")
  @RequirePermission("roles.view")
  listRoleStaff(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("roleId") roleId: string) {
    return this.rolesManagementService.listRoleStaff(session, schoolId, roleId);
  }

  @Get("permissions")
  @RequirePermission("roles.view")
  listPermissions(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.rolesManagementService.listPermissions(session, schoolId);
  }

  @Get("permissions/my")
  myPermissions(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.rolesManagementService.myPermissions(session, schoolId);
  }

  @Get("staff-roles")
  @RequirePermission("roles.assign")
  listStaffRoles(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.rolesManagementService.listStaffRoles(session, schoolId);
  }

  @Post("staff-roles/assign")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.assign")
  assignRoles(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.rolesManagementService.assignRoles(session, schoolId, body);
  }

  @Delete("staff-roles/revoke")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.assign")
  revokeRole(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.rolesManagementService.revokeRole(session, schoolId, body);
  }

  @Get("staff-roles/:userId")
  @RequirePermission("roles.assign")
  getStaffRoleDetail(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("userId") userId: string) {
    return this.rolesManagementService.getStaffRoleDetail(session, schoolId, userId);
  }

  @Get("staff-roles/:userId/overrides")
  @RequirePermission("roles.assign")
  listOverrides(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("userId") userId: string) {
    return this.rolesManagementService.listOverrides(session, schoolId, userId);
  }

  @Post("staff-roles/:userId/overrides")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.assign")
  createOverride(
    @CurrentSession() session: SessionPayload,
    @Param("schoolId") schoolId: string,
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    return this.rolesManagementService.createOverride(session, schoolId, userId, body);
  }

  @Delete("staff-roles/:userId/overrides/:overrideId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("roles.assign")
  deleteOverride(
    @CurrentSession() session: SessionPayload,
    @Param("schoolId") schoolId: string,
    @Param("userId") userId: string,
    @Param("overrideId") overrideId: string
  ) {
    return this.rolesManagementService.deleteOverride(session, schoolId, userId, overrideId);
  }
}
