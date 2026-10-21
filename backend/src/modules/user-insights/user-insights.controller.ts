import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { UserInsightsService } from "./user-insights.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const salesRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-user-insights")
@Controller("super-admin/users/insights")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class UserInsightsController {
  constructor(private readonly insights: UserInsightsService) {}

  @Get("memberships")
  memberships() {
    return ok(this.insights.memberships());
  }

  @Get("teachers")
  teachers() {
    return ok(this.insights.teachers());
  }

  @Post("teachers/message")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...salesRoles)
  message(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.insights.bulkMessage(session, body), "Messages queued");
  }

  @Post("teachers/approach")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...salesRoles)
  approach(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.insights.addToApproachList(session, body), "Added to the approach list");
  }

  @Post("teachers/approach-selected")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...salesRoles)
  approachSelected(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.insights.approachSelected(session, body), "Added to the approach list");
  }

  @Post("teachers/route")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...salesRoles)
  route(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.insights.routeToPartner(session, body), "Routed under the registered deal");
  }
}
