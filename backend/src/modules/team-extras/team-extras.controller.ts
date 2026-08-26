import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { TeamExtrasService } from "./team-extras.service";

/**
 * Adds the "Security Settings" data (internal-team sessions + IP access rules) under the
 * same /super-admin/internal-team path SuperAdminController already owns, without editing
 * that controller/service directly. Route segments here (sessions, ip-rules) don't overlap
 * any route already registered on SuperAdminController.
 */
@ApiTags("super-admin")
@Controller("super-admin/internal-team")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN")
export class TeamExtrasController {
  constructor(private readonly teamExtrasService: TeamExtrasService) {}

  @Get("sessions")
  async listSessions(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teamExtrasService.listInternalSessions(session) };
  }

  @Patch("sessions/:sessionId/revoke")
  async revokeSession(@CurrentSession() session: SessionPayload, @Param("sessionId") sessionId: string) {
    return { ok: true, data: await this.teamExtrasService.revokeInternalSession(session, sessionId) };
  }

  @Get("ip-rules")
  async listIpRules(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teamExtrasService.listIpRules(session) };
  }

  @Post("ip-rules")
  async upsertIpRule(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.teamExtrasService.upsertIpRule(session, body) };
  }

  @Delete("ip-rules/:ruleId")
  async deleteIpRule(@CurrentSession() session: SessionPayload, @Param("ruleId") ruleId: string) {
    return { ok: true, data: await this.teamExtrasService.deleteIpRule(session, ruleId) };
  }
}
