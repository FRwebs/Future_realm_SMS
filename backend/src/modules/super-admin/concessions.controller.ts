import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { ConcessionsService } from "./concessions.service";

@ApiTags("super-admin")
@Controller("super-admin/billing/concessions")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "FINANCE_MANAGER", "SALES_MANAGER", "SUPER_ADMIN")
export class ConcessionsController {
  constructor(private readonly concessions: ConcessionsService) {}

  @Get()
  list() {
    return ok(this.concessions.list());
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  grant(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.concessions.grant(session, body), "Concession granted.");
  }

  @Patch(":id/renew")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  renew(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.concessions.renew(session, id, body), "Concession re-verified.");
  }

  @Patch(":id/revoke")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  revoke(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.concessions.revoke(session, id, body), "Concession revoked.");
  }
}
