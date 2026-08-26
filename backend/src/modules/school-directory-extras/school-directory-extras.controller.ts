import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { SchoolDirectoryExtrasService } from "./school-directory-extras.service";

@ApiTags("super-admin")
@Controller("school-directory-extras")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN")
export class SchoolDirectoryExtrasController {
  constructor(private readonly schoolDirectoryExtrasService: SchoolDirectoryExtrasService) {}

  @Get("dormancy")
  async dormancy(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.schoolDirectoryExtrasService.listDormancy(session) };
  }
}
