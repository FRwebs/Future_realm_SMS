import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { CurriculumExtrasService } from "./curriculum-extras.service";

@ApiTags("super-admin")
@Controller("curriculum-extras")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN")
export class CurriculumExtrasController {
  constructor(private readonly curriculumExtrasService: CurriculumExtrasService) {}

  @Get("overview")
  async overview(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.curriculumExtrasService.getOverview(session) };
  }
}
