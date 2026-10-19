import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { CommunicationCenterService } from "./communication-center.service";

/** Who may look at the school's own sends, and who may decide on one. */
const readRoles = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "ADMIN_OFFICER",
  "ACCOUNTANT",
] as const;

/** The threshold exists to put a send in front of these two. */
const approveRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;

@ApiTags("communication-center")
@Controller("v1/communication-center")
@UseGuards(SessionGuard, RolesGuard)
export class CommunicationCenterController {
  constructor(private readonly service: CommunicationCenterService) {}

  /** The five audiences with a live count each — what Compose opens on. */
  @Get("audience")
  @Roles(...readRoles)
  audience(@CurrentSession() session: SessionPayload, @Query("to") to?: string) {
    return this.service.ok(this.service.audience(session, to));
  }

  /** Everything the Sent tab paints: stats, campaigns and the failures. */
  @Get("campaigns")
  @Roles(...readRoles)
  campaigns(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.campaigns(session));
  }

  @Post("campaigns")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  compose(
    @CurrentSession() session: SessionPayload,
    @Body() body: unknown,
    @Query("to") to?: string,
  ) {
    return this.service.ok(this.service.compose(session, body, to), "Send created.");
  }

  @Patch("campaigns/:id/decision")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...approveRoles)
  decide(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.ok(this.service.decide(session, id, body), "Decision recorded.");
  }

  @Get("rules")
  @Roles(...readRoles)
  rules(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.rules(session));
  }

  @Patch("rules/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  updateRule(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.ok(this.service.updateRule(session, id, body), "Rule saved.");
  }

  @Get("templates")
  @Roles(...readRoles)
  templates(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.templates(session));
  }
}
