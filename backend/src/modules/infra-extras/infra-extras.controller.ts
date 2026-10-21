import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { InfraExtrasService } from "./infra-extras.service";

const technicalRoles = ["PLATFORM_OWNER", "DEVELOPER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-infra-extras")
@Controller("super-admin/infra-extras")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...technicalRoles)
export class InfraExtrasController {
  constructor(private readonly infraExtrasService: InfraExtrasService) {}

  @Get("computation")
  async computationMonitoring() {
    const { data } = await this.infraExtrasService.computationMonitoring();
    return { ok: true, data };
  }

  @Post("regression/run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  async runRegression(@CurrentSession() session: SessionPayload) {
    const result = await this.infraExtrasService.runRegressionAs(session);
    return { ok: true, success: true, message: result.failures.length ? `${result.failures.length} of ${result.total} golden cases failed` : `All ${result.total} golden cases passed`, data: result };
  }

  @Post("integration-owners")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  async integrationOwner(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, success: true, message: "Owner saved", data: await this.infraExtrasService.setIntegrationOwner(session, body) };
  }
}
