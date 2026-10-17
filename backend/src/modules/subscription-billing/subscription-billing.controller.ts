import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AccountService } from "./account.service";
import { ok } from "./billing.shared";
import { CreditsService } from "./credits.service";
import { PaymentsService } from "./payments.service";
import { PlanService } from "./plan.service";

/**
 * Subscription & Billing: what Future Realm costs, what is left to send with, and the account's
 * rare, consequential settings. Literal paths come before parameters so `:id` never swallows a word.
 */
@ApiTags("subscription-billing")
@Controller("v1/subscription-billing")
@UseGuards(SessionGuard, PermissionsGuard)
export class SubscriptionBillingController {
  constructor(
    private readonly plan: PlanService,
    private readonly credits: CreditsService,
    private readonly account: AccountService,
    private readonly payments: PaymentsService
  ) {}

  /* plan */

  @Get("plan")
  @RequirePermission("subscription-billing.plan.view")
  planOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.plan.overview(session));
  }

  @Post("plan/renew")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.plan.create")
  renew(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.plan.renew(session, body), "Renewal invoiced.");
  }

  @Post("plan/switch")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.plan.edit")
  switchPlan(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.plan.switchPlan(session, body), "Plan switch scheduled.");
  }

  @Post("plan/switch/cancel")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.plan.edit")
  cancelSwitch(@CurrentSession() session: SessionPayload) {
    return ok(this.plan.cancelSwitch(session), "Plan switch withdrawn.");
  }

  @Get("invoices/:id")
  @RequirePermission("subscription-billing.plan.view")
  invoice(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.plan.invoice(session, id));
  }

  @Post("invoices/:id/pay")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.plan.create")
  pay(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.payments.start(session, id, body));
  }

  @Post("payments/verify")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.plan.view")
  verify(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.payments.settle(session, String(body.reference ?? "")));
  }

  /* credits */

  @Get("credits")
  @RequirePermission("subscription-billing.credits.view")
  creditsOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.credits.overview(session));
  }

  @Get("credits/price")
  @RequirePermission("subscription-billing.credits.view")
  price(@Query("channel") channel: string, @Query("credits") credits: string) {
    return ok(Promise.resolve(this.credits.price(channel ?? "SMS", Number(credits) || 0)));
  }

  @Post("credits/top-up")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.credits.create")
  topUp(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.credits.topUp(session, body), "Top-up invoiced.");
  }

  @Put("credits/settings")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.credits.edit")
  settings(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.credits.saveSettings(session, body), "Credit settings saved.");
  }

  /* account */

  @Get("account")
  @RequirePermission("subscription-billing.account.view")
  accountOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.account.overview(session));
  }

  @Post("account/agreement")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.account.edit")
  agreement(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.account.acceptAgreement(session, body), "Agreement accepted.");
  }

  @Put("account/preferences")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.account.edit")
  preferences(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.account.savePreferences(session, body), "Saved.");
  }

  @Post("account/ownership-transfer")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.account.edit")
  transfer(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.account.requestTransfer(session, body), "Transfer requested.");
  }

  @Post("account/export")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.account.edit")
  createExport(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.account.createExport(session, body), "Export generated.");
  }

  @Get("account/export/:token")
  @RequirePermission("subscription-billing.account.view")
  exportGrant(@CurrentSession() session: SessionPayload, @Param("token") token: string) {
    return ok(this.account.exportGrant(session, token));
  }

  @Get("account/export/:token/:dataset")
  @RequirePermission("subscription-billing.account.view")
  async dataset(@CurrentSession() session: SessionPayload, @Param("token") token: string, @Param("dataset") dataset: string, @Res() res: Response) {
    const csv = await this.account.dataset(session, token, decodeURIComponent(dataset));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${dataset.toLowerCase().replace(/\s+/g, "-")}.csv"`);
    res.send(String.fromCharCode(0xfeff) + csv);
  }

  @Post("account/closure")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subscription-billing.account.edit")
  closure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.account.requestClosure(session, body), "Closure requested.");
  }
}
