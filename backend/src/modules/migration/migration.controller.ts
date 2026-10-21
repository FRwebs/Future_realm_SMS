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

  @Post("jobs/:id/import-result")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  recordImport(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.migrationService.recordImport(session, id, body);
  }

  @Get("retention")
  retention(@CurrentSession() session: SessionPayload) {
    return this.migrationService.retention(session);
  }

  @Post("jobs/:id/retention/extend")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  extend(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.migrationService.extendRetention(session, id, body);
  }

  @Post("jobs/:id/retention/deleted")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  deleted(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.migrationService.confirmDeleted(session, id, body);
  }

  @Post("source-adapters")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  createAdapter(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.migrationService.saveAdapter(session, null, body);
  }

  @Patch("source-adapters/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  updateAdapter(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.migrationService.saveAdapter(session, id, body);
  }

  @Post("setup-progress/nudge")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  nudge(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.migrationService.nudgeSetup(session, body);
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
