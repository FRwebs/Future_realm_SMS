import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { MyWorkService } from "./my-work.service";

@ApiTags("super-admin")
@Controller("super-admin/my-work")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN")
export class MyWorkController {
  constructor(private readonly myWorkService: MyWorkService) {}

  @Get()
  getMyWork(@CurrentSession() session: SessionPayload) {
    return this.myWorkService.getMyWork(session);
  }
}
