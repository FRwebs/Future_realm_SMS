import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { AnalyticsService, CORE_MODULES } from "./analytics.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-analytics-bi")
@Controller("super-admin/analytics-bi")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("trends")
  trends() {
    return ok(this.analytics.trends());
  }

  @Get("owners")
  owners() {
    return ok(this.analytics.owners());
  }

  @Get("paid-unused")
  paidUnused() {
    return ok(this.analytics.paidUnused());
  }

  @Get("tickets-about")
  ticketsAbout(@Query("modules") modules?: string) {
    return ok(this.analytics.ticketsAbout((modules ? modules.split(",") : [...CORE_MODULES]).map((m) => m.trim()).filter(Boolean)));
  }

  @Post("owners")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  setOwner(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.analytics.setOwner(session, body), "Owner saved");
  }

  @Post("snapshot")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  snapshot() {
    return ok(this.analytics.tick(), "Snapshot taken");
  }

  @Get("reports")
  reports(@CurrentSession() session: SessionPayload) {
    return ok(this.analytics.list(session));
  }

  @Post("reports")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  save(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.analytics.save(session, body), "Report template saved");
  }

  @Patch("reports/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  update(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.analytics.save(session, body, id), "Report template saved");
  }

  @Get("reports/:id/run")
  run(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Query("dimension") dimension?: string, @Query("metric") metric?: string) {
    return ok(this.analytics.runReport(session, id, { dimension, metric }));
  }

  @Get("reports/:id/export")
  async export(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Res() response: Response) {
    const file = await this.analytics.csv(session, id);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${file.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`);
    response.send(file.content);
  }
}
