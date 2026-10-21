import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { SupportDeskService } from "./support-desk.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SUPER_ADMIN"] as const;
const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SUPER_ADMIN"] as const;
const leadRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-support-desk")
@Controller("super-admin/support-desk")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class SupportDeskController {
  constructor(private readonly desk: SupportDeskService) {}

  @Get("board")
  board() {
    return ok(this.desk.board());
  }

  @Get("service-levels")
  levels() {
    return ok(this.desk.serviceLevels());
  }

  @Get("analytics")
  analytics() {
    return ok(this.desk.analytics());
  }

  @Get("knowledge")
  knowledge() {
    return ok(this.desk.knowledge());
  }

  @Post("sla-scan")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...leadRoles)
  scan() {
    return ok(this.desk.scanSla(), "Service levels checked");
  }

  @Post("tickets/assign")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  assign(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.desk.assignMany(session, body), "Tickets assigned");
  }

  @Post("tickets/priority")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  priority(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.desk.changePriorityMany(session, body), "Priority changed");
  }

  @Post("tickets/close")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  close(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.desk.closeMany(session, body), "Tickets closed");
  }

  @Post("countries")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...leadRoles)
  country(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.desk.saveCountryHours(session, body), "Working hours saved");
  }

  @Post("corrections/:id/validate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...leadRoles)
  validate(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.desk.validateCorrection(session, id), "Request validated");
  }
}
