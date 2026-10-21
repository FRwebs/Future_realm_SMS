import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { BillingExtrasService } from "./billing-extras.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"] as const;
const financeRoles = ["PLATFORM_OWNER", "FINANCE_MANAGER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-billing-extras")
@Controller("super-admin/billing-extras")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class BillingExtrasController {
  constructor(private readonly extras: BillingExtrasService) {}

  @Get("reconciliation-stats")
  stats() {
    return ok(this.extras.reconciliationStats());
  }

  @Get("tier-dismissals")
  dismissals() {
    return ok(this.extras.tierDismissals());
  }

  @Post("tier-recommendations/dismiss")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  dismiss(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.extras.dismissTier(session, body), "Recommendation dismissed");
  }

  @Get("wallets")
  wallets() {
    return ok(this.extras.wallets());
  }

  @Post("wallets/top-up")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  topUp(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.extras.addByHand(session, body), "Credit added by hand");
  }

  @Post("wallets/scan")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  scan() {
    return ok(this.extras.scanWallets(), "Wallets checked");
  }

  @Get("trial-journey")
  journey() {
    return ok(this.extras.journey());
  }

  @Get("invoices/export")
  async exportInvoices(@CurrentSession() session: SessionPayload, @Query("invoiceIds") ids: string, @Res() response: Response) {
    const csv = await this.extras.exportInvoices(session, (ids ?? "").split(",").filter(Boolean));
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="invoices.csv"');
    response.send(csv);
  }

  @Post("invoices/remind")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  remind(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.extras.remind(session, body), "Reminders sent");
  }

  @Post("invoices/send")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  send(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.extras.sendDrafts(session, body), "Invoices sent");
  }

  @Post("transactions/:id/correct")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  correct(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.extras.correctPayment(session, id, body), "Correcting entry written");
  }

  @Post("trial-journey/run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...financeRoles)
  run() {
    return ok(this.extras.runJourney(), "Trial messages checked");
  }
}
