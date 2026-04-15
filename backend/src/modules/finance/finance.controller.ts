import { Body, Controller, ForbiddenException, Get, Header, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { FinanceService } from "./finance.service";

@ApiTags("finance")
@Controller("v1/finance")
@UseGuards(SessionGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private assertFinanceManager(session: SessionPayload) {
    if (!["SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT"].includes(session.role)) {
      throw new ForbiddenException("Only finance managers can perform this action.");
    }
  }

  @Get("dashboard")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.getFinanceDashboard(session.schoolId) };
  }

  @Get("fee-structures")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async listFeeStructures(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listFeeStructures(session.schoolId) };
  }

  @Post("fee-structures")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async createFeeStructure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.createFeeStructure(session.schoolId, body) };
  }

  @Get("invoices")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async listInvoices(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.financeService.listInvoices(session.schoolId)
    };
  }

  @Get("invoices/:invoiceId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async getInvoice(@CurrentSession() session: SessionPayload, @Param("invoiceId") invoiceId: string) {
    return { ok: true, data: await this.financeService.getInvoice(session.schoolId, invoiceId) };
  }

  @Post("invoices")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async createInvoice(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return {
      ok: true,
      data: await this.financeService.createInvoice(session.schoolId, session.userId, body)
    };
  }

  @Post("invoices/generate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async generateInvoices(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.generateInvoices(session.schoolId, session.userId, body) };
  }

  @Post("payments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT", "PARENT")
  async initializePayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    if (session.role !== "PARENT") this.assertFinanceManager(session);
    return {
      ok: true,
      data: await this.financeService.initializePaymentFlow(session.schoolId, session.userId, body, session)
    };
  }

  @Get("payments")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async listPayments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listPayments(session.schoolId) };
  }

  @Post("payments/manual")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async recordManualPayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.recordManualPayment(session.schoolId, session.userId, body) };
  }

  @Post("payments/verify")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async verifyOnlinePayment(@CurrentSession() session: SessionPayload, @Body() body: { reference?: string }) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.verifyOnlinePayment(session.schoolId, session.userId, body.reference ?? "") };
  }

  @Post("discounts")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async applyDiscount(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.applyDiscount(session.schoolId, session.userId, body) };
  }

  @Post("waivers")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async applyWaiver(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.applyWaiver(session.schoolId, session.userId, body) };
  }

  @Get("installment-plans")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async listInstallmentPlans(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listInstallmentPlans(session.schoolId) };
  }

  @Post("installment-plans")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT")
  async createInstallmentPlan(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.createInstallmentPlan(session.schoolId, session.userId, body) };
  }

  @Get("reports/export")
  @Header("Content-Type", "text/csv")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT")
  async exportReport(@CurrentSession() session: SessionPayload) {
    return this.financeService.exportFinanceReport(session.schoolId);
  }
}
