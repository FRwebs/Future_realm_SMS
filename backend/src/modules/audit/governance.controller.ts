import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { GovernanceService } from "./governance.service";

/**
 * The tracked half of compliance and data protection. Guarded by the module
 * keys the sidebar already uses, so a role that cannot open the tab cannot read
 * it through the API either.
 */
@ApiTags("governance")
@Controller("v1/governance")
@UseGuards(SessionGuard, PermissionsGuard)
export class GovernanceController {
  constructor(private readonly service: GovernanceService) {}

  @Get("compliance-returns")
  @RequirePermission("analytics-reports.compliance.view")
  returns(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.complianceReturns(session));
  }

  @Post("compliance-returns")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.compliance.create")
  createReturn(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.service.ok(this.service.createReturn(session, body), "Return tracked.");
  }

  @Patch("compliance-returns/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("analytics-reports.compliance.edit")
  updateReturn(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.ok(this.service.updateReturn(session, id, body), "Return updated.");
  }

  @Get("data-subject-requests")
  @RequirePermission("audit-security.data-protection.view")
  requests(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.dataSubjectRequests(session));
  }

  @Post("data-subject-requests")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("audit-security.data-protection.create")
  createRequest(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.service.ok(this.service.createRequest(session, body), "Request logged.");
  }

  @Patch("data-subject-requests/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("audit-security.data-protection.edit")
  decideRequest(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.ok(this.service.decideRequest(session, id, body), "Response recorded.");
  }

  @Get("integrity")
  @RequirePermission("audit-security.monitoring.view")
  integrity(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.integrity(session));
  }

  @Patch("integrity/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("audit-security.monitoring.edit")
  resolveFlag(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.ok(this.service.resolveFlag(session, id, body), "Flag closed.");
  }
}
