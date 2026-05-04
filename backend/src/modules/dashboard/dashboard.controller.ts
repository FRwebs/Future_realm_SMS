import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { adminDashboardRoles } from "../../../../src/lib/auth/roles";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("v1/dashboard")
@UseGuards(SessionGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("context")
  async context(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.dashboardService.getSchoolContext(session)
    };
  }

  @Get("overview")
  @Roles(...adminDashboardRoles)
  async overview(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.dashboardService.getOverview(session)
    };
  }
}
