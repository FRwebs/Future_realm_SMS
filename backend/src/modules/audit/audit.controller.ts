import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@Controller("v1/audit")
@UseGuards(SessionGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** This school's own trail. Platform-wide reads stay under super-admin. */
  @Get("recent")
  @RequirePermission("audit-security.audit-log.view")
  recent(
    @CurrentSession() session: SessionPayload,
    @Query() query: { take?: string; action?: string; entityType?: string },
  ) {
    return this.auditService.ok(this.auditService.recent(session, query));
  }

  /** What personal data the school holds, for the data-protection tab. */
  @Get("data-protection")
  @RequirePermission("audit-security.data-protection.view")
  dataProtection(@CurrentSession() session: SessionPayload) {
    return this.auditService.ok(this.auditService.dataProtection(session));
  }


  @Get("reports")
  @RequirePermission("analytics-reports.reports.view")
  reports(@CurrentSession() session: SessionPayload) {
    return this.auditService.ok(this.auditService.reports(session));
  }

  @Get("compliance")
  @RequirePermission("analytics-reports.compliance.view")
  compliance(@CurrentSession() session: SessionPayload) {
    return this.auditService.ok(this.auditService.compliance(session));
  }

}
