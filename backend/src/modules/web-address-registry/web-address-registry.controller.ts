import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { WebAddressRegistryService } from "./web-address-registry.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-web-address-registry")
@Controller("super-admin/web-address-registry")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class WebAddressRegistryController {
  constructor(private readonly registryService: WebAddressRegistryService) {}

  @Get("records")
  listRegistry(@CurrentSession() session: SessionPayload) {
    return this.registryService.listRegistry(session);
  }

  @Get("availability")
  checkAvailability(@CurrentSession() session: SessionPayload, @Query("address") address: string) {
    return this.registryService.checkAvailability(session, address);
  }

  @Post("records/change")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  changeAddress(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.registryService.changeAddress(session, body);
  }

  @Get("disputes")
  listDisputes(@CurrentSession() session: SessionPayload) {
    return this.registryService.listDisputes(session);
  }

  @Post("disputes")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  createDispute(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.registryService.createDispute(session, body);
  }

  @Post("disputes/:id/notify-holder")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  notifyHolder(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.registryService.notifyHolder(session, id);
  }

  @Post("disputes/:id/holder-response")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  recordHolderResponse(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.registryService.recordHolderResponse(session, id, body);
  }

  @Post("disputes/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  decideDispute(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.registryService.decideDispute(session, id, body);
  }
}
