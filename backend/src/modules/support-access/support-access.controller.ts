import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { SupportAccessService } from "./support-access.service";

@ApiTags("super-admin-support-access")
@Controller("super-admin/users/support-access")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "DEVELOPER", "SUPER_ADMIN")
export class SupportAccessController {
  constructor(private readonly access: SupportAccessService) {}

  @Get("elevations")
  elevations() {
    return ok(this.access.listElevations());
  }

  @Get("restrictions")
  restrictions() {
    return ok(this.access.restrictions());
  }

  @Post("elevations")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SUPER_ADMIN")
  request(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.access.requestElevation(session, body), "Request sent to the school");
  }

  @Post("restrictions")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SUPER_ADMIN")
  restrict(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.access.restrictGuardian(session, body), "Guardian account restricted");
  }

  @Post("restrictions/:id/lift")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  lift(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.access.liftRestriction(session, id, body), "Restriction lifted");
  }
}
