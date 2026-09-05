import { Body, Controller, Param, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { MigrationService } from "./migration.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-migration")
@Controller("super-admin/migration")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Get("jobs")
  listJobs(@CurrentSession() session: SessionPayload) {
    return this.migrationService.listJobs(session);
  }

  @Post("jobs")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  createJob(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.migrationService.createJob(session, body);
  }

  @Patch("jobs/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  updateJob(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.migrationService.updateJob(session, id, body);
  }

  @Post("jobs/:id/files-received")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  markFilesReceived(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.migrationService.markFilesReceived(session, id);
  }

  @Get("source-adapters")
  listSourceAdapters(@CurrentSession() session: SessionPayload) {
    return this.migrationService.listSourceAdapters(session);
  }

  @Get("setup-progress")
  setupProgress(@CurrentSession() session: SessionPayload) {
    return this.migrationService.setupProgress(session);
  }
}
