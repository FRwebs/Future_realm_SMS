import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { PartnerEngineService } from "./partner-engine.service";
import { PartnersService } from "./partners.service";

const partnerReadRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const partnerWriteRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-partners")
@Controller("super-admin/partners")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...partnerReadRoles)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService, private readonly engine: PartnerEngineService) {}

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

  @Get("registry")
  async registry() {
    return { ok: true, data: await this.partnersService.registry() };
  }

  @Get("performance")
  async performance() {
    return { ok: true, data: await this.engine.performance() };
  }

  @Get("commission")
  async commission() {
    return { ok: true, data: await this.engine.commission() };
  }

  @Get("statements")
  async statements() {
    return { ok: true, data: await this.engine.listStatements() };
  }

  @Get("statements/export")
  async statementsExport(@Query("ids") ids: string | undefined, @Res() response: Response) {
    const csv = await this.engine.statementsCsv(ids ? ids.split(",") : undefined);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="partner-payment-run.csv"');
    response.send(csv);
  }

  @Get("statements/:id")
  async statement(@Param("id") id: string) {
    return { ok: true, data: await this.engine.statement(id) };
  }

  @Post("statements/generate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async generateStatements(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.engine.generateStatements(session, body) };
  }

  @Patch("statements/:id/settle")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async settleStatement(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.engine.settle(session, id, body) };
  }

  @Post("statements/settle-many")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async settleMany(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.engine.settleMany(session, body), message: "Payment run recorded" };
  }

  @Post("statements/resend")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async resendStatements(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.engine.resend(session, body), message: "Statements sent" };
  }

  @Post("clawbacks")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async clawback(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.engine.recordClawback(session, body) };
  }

  @Get("disputes")
  async disputes() {
    return { ok: true, data: await this.engine.disputes() };
  }

  @Post("disputes")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async raiseDispute(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.engine.raiseDispute(session, body) };
  }

  @Patch("disputes/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async decideDispute(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.engine.decide(session, id, body) };
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

  @Post("deals/expiry-alerts")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async sendExpiryAlerts() {
    return { ok: true, data: await this.partnersService.sendExpiryAlerts() };
  }

  @Get(":id/schools")
  async schoolsOf(@Param("id") id: string) {
    return { ok: true, data: await this.engine.schoolsOf(id) };
  }

  @Patch(":id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async updatePartner(@Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.partnersService.updatePartner(id, body) };
  }

  @Patch(":id/countersign")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async countersign(@Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.partnersService.countersign(id, body) };
  }

  @Patch(":id/suspend")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async suspend(@Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.partnersService.suspend(id, body) };
  }

  @Patch(":id/reactivate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...partnerWriteRoles)
  async reactivate(@Param("id") id: string) {
    return { ok: true, data: await this.partnersService.reactivate(id) };
  }
}
