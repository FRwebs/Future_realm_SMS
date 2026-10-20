import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { ComplianceService } from "./compliance.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"] as const;
const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;
const incidentRoles = ["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-compliance")
@Controller("super-admin/compliance")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get()
  overview() {
    return ok(this.compliance.overview());
  }

  @Patch("obligations/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  updateObligation(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.updateObligation(session, id, body), "Obligation updated");
  }

  @Post("dpa-versions")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  publishDpa(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.compliance.publishDpa(session, body), "Agreement version published");
  }

  @Patch("retention/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  updateRetention(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.updateRetention(session, id, body), "Retention rule updated");
  }

  @Post("retention/run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  runRetention(@CurrentSession() session: SessionPayload) {
    return ok(this.compliance.enforceRetention(session), "Retention run complete");
  }

  @Post("incidents/:id/contain")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...incidentRoles)
  contain(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.containIncident(session, id, body), "Containment recorded");
  }

  @Post("incidents/:id/assess")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...incidentRoles)
  assess(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.assessIncident(session, id, body), "Assessment recorded");
  }

  @Post("incidents/:id/regulator")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...incidentRoles)
  regulator(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.notifyRegulator(session, id, body), "Regulator notice recorded");
  }

  @Post("incidents/:id/schools")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...incidentRoles)
  schools(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.compliance.notifySchools(session, id, body), "Schools notified");
  }

  @Get("audit-exports")
  auditExports() {
    return ok(this.compliance.listAuditExports());
  }

  @Get("audit-actors")
  auditActors() {
    return ok(this.compliance.auditActors());
  }

  @Post("audit-exports")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  createAuditExport(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.compliance.createAuditExport(session, body), "Audit export ready");
  }

  @Get("audit-exports/:id/download")
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  async download(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Res() response: Response) {
    const file = await this.compliance.auditExportFile(session, id);
    response.setHeader("Content-Type", `${file.type}; charset=utf-8`);
    response.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    response.send(file.content);
  }
}
