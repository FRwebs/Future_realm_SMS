import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { InsightsService } from "./insights.service";
import { ReportsService } from "./reports.service";

const csv = (response: Response, name: string, content: string) => {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^A-Za-z0-9._-]+/g, "-")}.csv"`);
  response.setHeader("Cache-Control", "no-store");
  response.send(content);
};

@ApiTags("analytics-reports")
@Controller("v1/analytics-reports")
@UseGuards(SessionGuard, PermissionsGuard)
export class AnalyticsReportsController {
  constructor(private readonly insights: InsightsService, private readonly reports: ReportsService) {}

  @Get("insights")
  @RequirePermission("analytics-reports.insights.view")
  overview(@CurrentSession() session: SessionPayload) {
    return ok(this.insights.overview(session));
  }

  @Get("reports")
  @RequirePermission("analytics-reports.reports.view")
  reportsOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.reports.overview(session));
  }

  @Get("reports/columns/:dataset")
  @RequirePermission("analytics-reports.reports.view")
  columns(@CurrentSession() session: SessionPayload, @Param("dataset") dataset: string) {
    return ok(this.reports.columnsOf(session, dataset));
  }

  /** Producing a document writes a line to the audit log and keeps the copy, so it is a deliberate request. */
  @Get("reports/generate/:kind/:code")
  @RequirePermission("analytics-reports.reports.export")
  async generate(@CurrentSession() session: SessionPayload, @Param("kind") kind: string, @Param("code") code: string, @Res() response: Response) {
    const made = await this.reports.generate(session, kind, code);
    csv(response, made.name, made.content);
  }

  @Get("reports/archive/:id")
  @RequirePermission("analytics-reports.reports.view")
  async archived(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Res() response: Response) {
    const copy = await this.reports.archived(session, id);
    csv(response, copy.name, copy.content);
  }

  @Post("reports/run")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.reports.export")
  run(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.reports.run(session, body), "Report produced.");
  }

  @Post("reports/definitions")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.reports.create")
  define(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.reports.saveDefinition(session, body), "Report saved.");
  }

  @Delete("reports/definitions/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.reports.edit")
  removeDefinition(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return ok(this.reports.deleteDefinition(session, code), "Report removed.");
  }

  @Get("compliance")
  @RequirePermission("analytics-reports.compliance.view")
  compliance(@CurrentSession() session: SessionPayload) {
    return ok(this.reports.compliance(session));
  }

  @Post("compliance/:id/run")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.compliance.export")
  runReturn(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.reports.runReturn(session, id), "Return produced.");
  }

  @Get("compliance/:id/generate")
  @RequirePermission("analytics-reports.compliance.export")
  async generateReturn(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Res() response: Response) {
    const made = await this.reports.generateReturn(session, id);
    csv(response, made.name, made.content);
  }
}
