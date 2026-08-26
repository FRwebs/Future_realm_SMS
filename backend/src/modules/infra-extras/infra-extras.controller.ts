import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

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
}
