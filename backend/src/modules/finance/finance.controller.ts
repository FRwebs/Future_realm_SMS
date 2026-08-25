import { Body, Controller, ForbiddenException, Get, Header, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { hasRole } from "../../../../src/lib/auth/roles";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { verifyFlutterwaveSignature, verifyPaystackSignature } from "../../../../src/lib/integrations/payment-gateways";
import { env } from "../../../../src/lib/utils/env";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { FinanceService } from "./finance.service";

const financeOversightRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "ADMIN_OFFICER", "BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"] as const;
const financeManagerRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "ADMIN_OFFICER", "BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"] as const;

@ApiTags("finance")
@Controller("v1/finance")
@UseGuards(SessionGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private assertFinanceManager(session: SessionPayload) {
    if (!hasRole(session.role, [...financeManagerRoles])) {
      throw new ForbiddenException("Only finance managers can perform this action.");
    }
  }

  @Get("dashboard")
  @Roles(...financeOversightRoles)
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.getFinanceDashboard(session.schoolId) };
  }

  @Get("fee-structures")
  @Roles(...financeOversightRoles)
  async listFeeStructures(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listFeeStructures(session.schoolId) };
  }

  @Post("fee-structures")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async createFeeStructure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.createFeeStructure(session.schoolId, body) };
  }

  @Get("invoices")
  @Roles(...financeOversightRoles)
  async listInvoices(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.financeService.listInvoices(session.schoolId)
    };
  }

  @Get("invoices/:invoiceId")
  @Roles(...financeOversightRoles)
  async getInvoice(@CurrentSession() session: SessionPayload, @Param("invoiceId") invoiceId: string) {
    return { ok: true, data: await this.financeService.getInvoice(session.schoolId, invoiceId) };
  }

  @Get("students/:studentId")
  @Roles(...financeOversightRoles)
  async getStudentFinanceLedger(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.financeService.getStudentFinanceLedger(session.schoolId, studentId) };
  }

  @Post("invoices")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async createInvoice(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return {
      ok: true,
      data: await this.financeService.createInvoice(session.schoolId, session.userId, body)
    };
  }

  @Post("invoices/generate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async generateInvoices(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.generateInvoices(session.schoolId, session.userId, body) };
  }

  @Post("payments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeOversightRoles, "PARENT")
  async initializePayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    if (session.role !== "PARENT") this.assertFinanceManager(session);
    return {
      ok: true,
      data: await this.financeService.initializePaymentFlow(session.schoolId, session.userId, body, session)
    };
  }

  @Get("payments")
  @Roles(...financeOversightRoles)
  async listPayments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listPayments(session.schoolId) };
  }

  @Post("payments/manual")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async recordManualPayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.recordManualPayment(session.schoolId, session.userId, body) };
  }

  @Post("payments/verify")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async verifyOnlinePayment(@CurrentSession() session: SessionPayload, @Body() body: { reference?: string }) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.verifyOnlinePayment(session.schoolId, session.userId, body.reference ?? "") };
  }

  @Post("discounts")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async applyDiscount(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.applyDiscount(session.schoolId, session.userId, body) };
  }

  @Post("waivers")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async applyWaiver(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.applyWaiver(session.schoolId, session.userId, body) };
  }

  @Get("discounts")
  @Roles(...financeOversightRoles)
  async listDiscounts(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listDiscounts(session.schoolId) };
  }

  @Get("installment-plans")
  @Roles(...financeOversightRoles)
  async listInstallmentPlans(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listInstallmentPlans(session.schoolId) };
  }

  @Post("installment-plans")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeManagerRoles)
  async createInstallmentPlan(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    this.assertFinanceManager(session);
    return { ok: true, data: await this.financeService.createInstallmentPlan(session.schoolId, session.userId, body) };
  }

  @Get("reports/export")
  @Header("Content-Type", "text/csv")
  @Roles(...financeOversightRoles)
  async exportReport(@CurrentSession() session: SessionPayload) {
    return this.financeService.exportFinanceReport(session.schoolId);
  }
}

@ApiTags("finance-webhooks")
@Controller("v1/finance/webhooks")
export class FinanceWebhookController {
  constructor(private readonly financeService: FinanceService) {}

  @Post("paystack")
  async paystackWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-paystack-signature") signature: string | undefined,
    @Body() body: Record<string, unknown>
  ) {
    if (!env.DEMO_MODE && !verifyPaystackSignature(req.rawBody ?? Buffer.from(JSON.stringify(body)), signature, env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY)) {
      throw new UnauthorizedException("Invalid Paystack webhook signature.");
    }
    return { ok: true, data: await this.financeService.handlePaystackWebhook(body) };
  }

  @Post("flutterwave")
  async flutterwaveWebhook(
    @Headers("verif-hash") verifHash: string | undefined,
    @Body() body: Record<string, unknown>
  ) {
    if (!env.DEMO_MODE && !verifyFlutterwaveSignature(verifHash, env.FLUTTERWAVE_WEBHOOK_SECRET)) {
      throw new UnauthorizedException("Invalid Flutterwave webhook signature.");
    }
    return { ok: true, data: await this.financeService.handleFlutterwaveWebhook(body) };
  }
}
