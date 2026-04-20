import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { StaffService } from "./staff.service";

@ApiTags("staff")
@Controller("v1/staff")
@UseGuards(SessionGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermission("staff.view")
  list(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.staffService.ok(this.staffService.listStaff(session, query));
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff.create")
  create(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.staffService.ok(this.staffService.createStaff(session, body), "Staff member created.");
  }

  @Get(":staffId")
  @RequirePermission("staff.view")
  detail(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string) {
    return this.staffService.ok(this.staffService.getStaff(session, staffId));
  }

  @Patch(":staffId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff.update")
  update(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: unknown) {
    return this.staffService.ok(this.staffService.updateStaff(session, staffId, body), "Staff member updated.");
  }

  @Patch(":staffId/status")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff.manage_status")
  status(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: unknown) {
    return this.staffService.ok(this.staffService.updateStatus(session, staffId, body), "Staff status updated.");
  }

  @Post(":staffId/roles")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff.assign_roles")
  assignRoles(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: unknown) {
    return this.staffService.ok(this.staffService.assignRoles(session, staffId, body), "Staff roles updated.");
  }

  @Delete(":staffId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff.delete")
  archive(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string) {
    return this.staffService.ok(this.staffService.archiveStaff(session, staffId), "Staff member archived.");
  }
}
