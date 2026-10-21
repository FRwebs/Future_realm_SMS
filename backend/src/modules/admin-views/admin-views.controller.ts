import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { AdminViewsService } from "./admin-views.service";

const roles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-views")
@Controller("super-admin/my-work/views")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...roles)
export class AdminViewsController {
  constructor(private readonly views: AdminViewsService) {}

  @Get()
  recent(@CurrentSession() session: SessionPayload) {
    return ok(this.views.recent(session));
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...roles)
  record(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.views.record(session, body));
  }
}
