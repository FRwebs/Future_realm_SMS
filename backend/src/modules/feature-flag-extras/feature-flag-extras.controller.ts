import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { FeatureFlagExtrasService } from "./feature-flag-extras.service";

const technicalRoles = ["PLATFORM_OWNER", "DEVELOPER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-feature-flag-extras")
@Controller("super-admin/feature-flag-extras")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...technicalRoles)
export class FeatureFlagExtrasController {
  constructor(private readonly featureFlagExtrasService: FeatureFlagExtrasService) {}

  @Get("case-history")
  async caseHistory(@CurrentSession() session: SessionPayload) {
    const { data } = await this.featureFlagExtrasService.caseHistory(session);
    return { ok: true, data };
  }

  @Patch("overrides/:overrideId/reject")
  async rejectOverride(@CurrentSession() session: SessionPayload, @Param("overrideId") overrideId: string, @Body() body: unknown) {
    const { data } = await this.featureFlagExtrasService.rejectOverride(session, overrideId, body);
    return { ok: true, data, message: "Feature override rejected" };
  }

  @Patch("overrides/:overrideId/revoke")
  async revokeOverride(@CurrentSession() session: SessionPayload, @Param("overrideId") overrideId: string, @Body() body: unknown) {
    const { data } = await this.featureFlagExtrasService.revokeOverride(session, overrideId, body);
    return { ok: true, data, message: "Feature override revoked" };
  }
}
