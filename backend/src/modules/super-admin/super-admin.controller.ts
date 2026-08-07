import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { SuperAdminService } from "./super-admin.service";

@ApiTags("super-admin")
@Controller("super-admin")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN")
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get("schools")
  listSchools(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listSchools(session, query);
  }

  @Get("schools/:schoolId")
  getSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.getSchool(session, schoolId);
  }

  @Post("schools")
  createSchool(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createSchool(session, body);
  }

  @Patch("schools/:schoolId")
  updateSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.updateSchool(session, schoolId, body);
  }

  @Patch("schools/:schoolId/suspend")
  suspendSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.suspendSchool(session, schoolId);
  }

  @Patch("schools/:schoolId/activate")
  activateSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.activateSchool(session, schoolId);
  }

  @Delete("schools/:schoolId")
  deleteSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.softDeleteSchool(session, schoolId);
  }

  @Patch("schools/:schoolId/status")
  updateSchoolStatus(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.updateSchoolStatus(session, schoolId, body);
  }

  @Post("schools/:schoolId/account-manager")
  assignAccountManager(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.assignAccountManager(session, schoolId, body);
  }

  @Get("schools/:schoolId/contacts")
  listSchoolContacts(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.listSchoolContacts(session, schoolId);
  }

  @Post("schools/:schoolId/contacts")
  addSchoolContact(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.addSchoolContact(session, schoolId, body);
  }

  @Delete("schools/:schoolId/contacts/:contactId")
  removeSchoolContact(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Param("contactId") contactId: string) {
    return this.superAdminService.removeSchoolContact(session, schoolId, contactId);
  }

  @Get("schools/:schoolId/export")
  async exportSchoolData(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Res() response: Response) {
    const csv = await this.superAdminService.exportSchoolData(session, schoolId);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="school-${schoolId}-export.csv"`);
    response.send(csv);
  }

  @Get("schools/:schoolId/features")
  getFeatures(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.getFeatures(session, schoolId);
  }

  @Patch("schools/:schoolId/features")
  updateFeatures(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.updateFeatures(session, schoolId, body);
  }

  @Get("users")
  listUsers(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listUsers(session, query);
  }

  @Post("users/suspicious-activity/recalculate")
  recalculateSuspiciousActivity(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.recalculateSuspiciousActivity(session);
  }

  @Get("users/suspicious-activity")
  listSuspiciousActivity(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listSuspiciousActivity(session);
  }

  @Patch("users/suspicious-activity/:flagId/resolve")
  resolveSuspiciousActivity(@CurrentSession() session: SessionPayload, @Param("flagId") flagId: string, @Body() body: unknown) {
    return this.superAdminService.resolveSuspiciousActivity(session, flagId, body);
  }

  @Post("users/duplicates/recalculate")
  recalculateDuplicateAccounts(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.recalculateDuplicateAccounts(session);
  }

  @Get("users/duplicates")
  listDuplicateAccounts(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listDuplicateAccounts(session);
  }

  @Patch("users/duplicates/:flagId/resolve")
  resolveDuplicateAccount(@CurrentSession() session: SessionPayload, @Param("flagId") flagId: string, @Body() body: unknown) {
    return this.superAdminService.resolveDuplicateAccount(session, flagId, body);
  }

  @Get("users/:userId")
  getUser(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.getUser(session, userId);
  }

  @Patch("users/:userId/reset-password")
  resetPassword(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.resetPassword(session, userId);
  }

  @Patch("users/:userId/suspend")
  suspendUser(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.suspendUser(session, userId);
  }

  @Patch("users/:userId/reinstate")
  reinstateUser(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.reinstateUser(session, userId);
  }

  @Post("users/:userId/recovery")
  initiateAccountRecovery(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return this.superAdminService.initiateAccountRecovery(session, userId, body);
  }

  @Delete("users/:userId")
  deleteUser(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.softDeleteUser(session, userId);
  }

  @Get("billing")
  listBilling(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listBilling(session, query);
  }

  @Patch("billing/:schoolId")
  updateBilling(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.updateBilling(session, schoolId, body);
  }

  @Post("billing/:schoolId/extend-trial")
  extendTrial(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.extendTrial(session, schoolId, body);
  }

  @Patch("billing/:schoolId/suspend-billing")
  suspendBilling(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.suspendBilling(session, schoolId);
  }

  @Get("billing/invoices")
  listInvoices(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listInvoices(session, query);
  }

  @Post("billing/invoices")
  createInvoice(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createInvoice(session, body);
  }

  @Patch("billing/invoices/:invoiceId/send")
  sendInvoice(@CurrentSession() session: SessionPayload, @Param("invoiceId") invoiceId: string) {
    return this.superAdminService.sendInvoice(session, invoiceId);
  }

  @Post("billing/invoices/:invoiceId/payments")
  recordInvoicePayment(@CurrentSession() session: SessionPayload, @Param("invoiceId") invoiceId: string, @Body() body: unknown) {
    return this.superAdminService.recordInvoicePayment(session, invoiceId, body);
  }

  @Patch("billing/invoices/:invoiceId/cancel")
  cancelInvoice(@CurrentSession() session: SessionPayload, @Param("invoiceId") invoiceId: string, @Body() body: unknown) {
    return this.superAdminService.cancelInvoice(session, invoiceId, body);
  }

  @Post("billing/churn/recalculate")
  recalculateChurnRisk(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.recalculateChurnRisk(session);
  }

  @Get("billing/churn")
  listChurnRisk(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listChurnRisk(session);
  }

  @Get("billing/:schoolId/wallet")
  getNotificationWallet(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.getNotificationWallet(session, schoolId);
  }

  @Post("billing/:schoolId/wallet/top-up")
  topUpNotificationWallet(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.topUpNotificationWallet(session, schoolId, body);
  }

  @Get("billing/promo-codes")
  listPromoCodes(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPromoCodes(session);
  }

  @Post("billing/promo-codes")
  createPromoCode(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createPromoCode(session, body);
  }

  @Post("billing/promo-codes/apply")
  applyPromoCode(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.applyPromoCode(session, body);
  }

  @Get("billing/promo-codes/report")
  promoCodeCampaignReport(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.promoCodeCampaignReport(session);
  }

  @Get("analytics/revenue-report")
  revenueReport(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.revenueReport(session);
  }

  @Get("analytics/overview")
  analyticsOverview(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.analyticsOverview(session);
  }

  @Get("analytics/usage")
  usage(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.usage(session);
  }

  @Get("analytics/revenue")
  revenue(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.revenue(session);
  }

  @Get("audit-logs")
  auditLogs(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listAuditLogs(session, query);
  }

  @Get("audit-logs/export")
  async exportAuditLogs(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>, @Res() response: Response) {
    const csv = await this.superAdminService.exportAuditLogsCsv(session, query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=\"super-admin-audit-logs.csv\"");
    response.send(csv);
  }

  @Post("impersonate/:userId")
  impersonate(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return this.superAdminService.impersonate(session, userId, body);
  }

  @Get("settings")
  settings(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.getSettings(session);
  }

  @Patch("settings")
  updateSettings(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.updateSettings(session, body);
  }

  @Get("support/tickets")
  supportTickets(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listSupportTickets(session, query);
  }

  @Post("support/tickets")
  createSupportTicket(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createSupportTicket(session, body);
  }

  @Get("support/analytics")
  ticketAnalytics(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.ticketAnalytics(session);
  }

  @Get("support/canned-responses")
  listCannedResponses(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listCannedResponses(session);
  }

  @Post("support/canned-responses")
  createCannedResponse(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createCannedResponse(session, body);
  }

  @Patch("support/canned-responses/:responseId")
  updateCannedResponse(@CurrentSession() session: SessionPayload, @Param("responseId") responseId: string, @Body() body: unknown) {
    return this.superAdminService.updateCannedResponse(session, responseId, body);
  }

  @Patch("support/data-correction/:recordId/approve")
  approveDataCorrection(@CurrentSession() session: SessionPayload, @Param("recordId") recordId: string) {
    return this.superAdminService.approveDataCorrection(session, recordId);
  }

  @Get("support/tickets/:ticketId")
  getSupportTicket(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string) {
    return this.superAdminService.getSupportTicket(session, ticketId);
  }

  @Post("support/tickets/:ticketId/messages")
  addTicketMessage(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.addTicketMessage(session, ticketId, body);
  }

  @Patch("support/tickets/:ticketId/status")
  updateTicketStatus(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.updateTicketStatus(session, ticketId, body);
  }

  @Patch("support/tickets/:ticketId/assign")
  assignTicket(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.assignTicket(session, ticketId, body);
  }

  @Post("support/tickets/:ticketId/csat")
  submitTicketCsat(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.submitTicketCsat(session, ticketId, body);
  }

  @Post("support/tickets/:ticketId/data-correction")
  requestDataCorrection(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.requestDataCorrection(session, ticketId, body);
  }

  @Get("feature-flags")
  featureFlags(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listFeatureFlags(session);
  }

  @Post("feature-flags")
  createFeatureFlag(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createFeatureFlag(session, body);
  }

  @Get("communications")
  communications(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listCommunications(session);
  }

  @Post("communications/announcements")
  createAnnouncement(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createAnnouncement(session, body);
  }

  @Post("communications/maintenance")
  createMaintenanceWindow(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createMaintenanceWindow(session, body);
  }

  @Get("crm")
  crm(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listCrm(session);
  }

  @Post("crm/interactions")
  createCrmInteraction(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createCrmInteraction(session, body);
  }

  @Post("crm/leads")
  createLead(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createLead(session, body);
  }

  @Get("security")
  security(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.securityOverview(session);
  }

  @Post("security/privacy-requests")
  createPrivacyRequest(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createPrivacyRequest(session, body);
  }

  @Patch("security/privacy-requests/:requestId/status")
  updatePrivacyRequestStatus(@CurrentSession() session: SessionPayload, @Param("requestId") requestId: string, @Body() body: unknown) {
    return this.superAdminService.updatePrivacyRequestStatus(session, requestId, body);
  }

  @Patch("security/privacy-requests/:requestId/complete")
  completeDataDeletion(@CurrentSession() session: SessionPayload, @Param("requestId") requestId: string) {
    return this.superAdminService.completeDataDeletion(session, requestId);
  }

  @Get("security/compliance-report")
  complianceReport(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.complianceReport(session);
  }

  @Get("security/incidents")
  listSecurityIncidents(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listSecurityIncidents(session);
  }

  @Post("security/incidents")
  createSecurityIncident(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createSecurityIncident(session, body);
  }

  @Patch("security/incidents/:incidentId")
  updateSecurityIncident(@CurrentSession() session: SessionPayload, @Param("incidentId") incidentId: string, @Body() body: unknown) {
    return this.superAdminService.updateSecurityIncident(session, incidentId, body);
  }

  @Get("plans")
  plans(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPlans(session);
  }

  @Post("plans")
  createPlan(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createPlan(session, body);
  }
}
