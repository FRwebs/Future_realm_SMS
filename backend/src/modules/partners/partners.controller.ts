import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { PartnersService } from "./partners.service";

const partnerReadRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const partnerWriteRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-partners")
@Controller("super-admin/partners")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...partnerReadRoles)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  async listPartners() {
    return { ok: true, data: await this.partnersService.listPartners() };
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async createPartner(@Body() body: unknown) {
    return { ok: true, data: await this.partnersService.createPartner(body) };
  }

  @Get("deals")
  async listDeals(@Query("status") status?: string) {
    return { ok: true, data: await this.partnersService.listDeals(status) };
  }

  @Post("deals")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async createDeal(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.partnersService.createDeal(session.userId, body) };
  }

  @Patch("deals/:id/convert")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async convertDeal(@Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.partnersService.convertDeal(id, body) };
  }

  @Patch("deals/:id/expire")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async expireDeal(@Param("id") id: string) {
    return { ok: true, data: await this.partnersService.expireDeal(id) };
  }

  @Patch("deals/:id/commission-paid")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async markCommissionPaid(@Param("id") id: string) {
    return { ok: true, data: await this.partnersService.markCommissionPaid(id) };
  }

  @Get("commission-summary")
  async getCommissionSummary() {
    return { ok: true, data: await this.partnersService.getCommissionSummary() };
  }
}
