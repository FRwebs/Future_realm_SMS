import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TeamAccessService } from "./team-access.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const adminRoles = ["PLATFORM_OWNER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-team-access")
@Controller("super-admin/internal-team")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class TeamAccessController {
  constructor(private readonly team: TeamAccessService) {}

  @Get("me/access")
  mine(@CurrentSession() session: SessionPayload) {
    return ok(this.team.mine(session));
  }

  @Get("access-matrix")
  matrix() {
    return ok(this.team.matrix());
  }

  @Get("profiles")
  profiles() {
    return ok(this.team.profiles());
  }

  @Get("department-members")
  departmentMembers() {
    return ok(this.team.departmentMembers());
  }

  @Get("headlines")
  headlines() {
    return ok(this.team.headlines());
  }

  @Get("anomalies")
  anomalies() {
    return ok(this.team.anomalies());
  }

  @Get("devices/:userId")
  devices(@Param("userId") userId: string) {
    return ok(this.team.devices(userId));
  }

  @Get("owns/:userId")
  owns(@Param("userId") userId: string) {
    return ok(this.team.owns(userId));
  }

  @Post("module-access")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER")
  setGrid(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.team.setGrid(session, body), "Access updated");
  }

  @Post("module-actions")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER")
  setActions(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.team.setActions(session, body), "Actions updated");
  }

  @Get("action-matrix")
  actionMatrix() {
    return ok(this.team.actionsMatrix());
  }

  @Patch("profiles/:userId")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...adminRoles)
  saveProfile(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return ok(this.team.saveProfile(session, userId, body), "Profile saved");
  }

  @Post("anomalies/:id/review")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...adminRoles)
  review(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.team.review(session, id, body), "Flag reviewed");
  }

  @Post("anomalies/scan")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...adminRoles)
  scan() {
    return ok(this.team.scan(), "Scan complete");
  }
}
