import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { CSRF_COOKIE_NAME, getCookieOptions, SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "../../../../src/lib/auth/session-core";
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

  @Get("schools/groups")
  listSchoolGroups(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listSchoolGroups(session);
  }

  @Post("schools/groups")
  createSchoolGroup(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createSchoolGroup(session, body);
  }

  @Patch("schools/groups/:groupId")
  updateSchoolGroup(@CurrentSession() session: SessionPayload, @Param("groupId") groupId: string, @Body() body: unknown) {
    return this.superAdminService.updateSchoolGroup(session, groupId, body);
  }

  @Delete("schools/groups/:groupId")
  deleteSchoolGroup(@CurrentSession() session: SessionPayload, @Param("groupId") groupId: string) {
    return this.superAdminService.deleteSchoolGroup(session, groupId);
  }

  @Get("schools/:schoolId")
  getSchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.getSchool(session, schoolId);
  }

  @Get("schools-pending-verification")
  listPendingVerificationSchools(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPendingVerificationSchools(session);
  }

  @Post("schools/:schoolId/verify")
  verifySchool(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.verifySchool(session, schoolId);
  }

  @Post("schools/:schoolId/reject-verification")
  rejectSchoolVerification(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.rejectSchoolVerification(session, schoolId, body);
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

  @Post("schools/:schoolId/group")
  linkSchoolToGroup(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.superAdminService.linkSchoolToGroup(session, schoolId, body);
  }

  @Delete("schools/:schoolId/group")
  unlinkSchoolFromGroup(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.superAdminService.unlinkSchoolFromGroup(session, schoolId);
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

  @Get("users/recovery")
  listAccountRecoveries(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listAccountRecoveries(session);
  }

  @Get("users/impersonation-log")
  listImpersonationLog(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listImpersonationLog(session);
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

  @Get("analytics/bi")
  biOverview(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.biOverview(session);
  }

  @Get("analytics/churn")
  churnAnalysis(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.churnAnalysis(session);
  }

  @Post("analytics/churn")
  logChurn(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.logChurn(session, body);
  }

  @Get("analytics/nps")
  npsAnalytics(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.npsAnalytics(session);
  }

  @Post("analytics/nps")
  submitNps(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.submitNps(session, body);
  }

  @Get("analytics/custom-reports")
  listCustomReports(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listCustomReports(session);
  }

  @Post("analytics/custom-reports")
  createCustomReport(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createCustomReport(session, body);
  }

  @Get("analytics/custom-reports/:reportId/run")
  runCustomReport(@CurrentSession() session: SessionPayload, @Param("reportId") reportId: string) {
    return this.superAdminService.runCustomReport(session, reportId);
  }

  @Get("system/monitoring")
  infrastructureMonitoring(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.infrastructureMonitoring(session);
  }

  @Post("system/backups")
  triggerBackup(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.triggerBackup(session);
  }

  @Get("system/sync-failures")
  listSyncFailures(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listSyncFailures(session);
  }

  @Get("config-library")
  listConfigLibrary(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listConfigLibrary(session);
  }

  @Post("config-library/curricula")
  upsertCurriculumTemplate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertCurriculumTemplate(session, body);
  }

  @Post("config-library/grading-scales")
  upsertGradingScaleTemplate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertGradingScaleTemplate(session, body);
  }

  @Post("config-library/report-cards")
  upsertReportCardTemplate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertReportCardTemplate(session, body);
  }

  @Get("internal-team")
  listInternalTeam(@CurrentSession() session: SessionPayload, @Query() query: Record<string, unknown>) {
    return this.superAdminService.listInternalTeam(session, query);
  }

  @Post("internal-team")
  createInternalUser(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createInternalUser(session, body);
  }

  @Get("internal-team/activity")
  teamActivityDashboard(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.teamActivityDashboard(session);
  }

  @Get("internal-team/departments")
  listDepartments(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listDepartments(session);
  }

  @Post("internal-team/departments")
  upsertDepartment(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertDepartment(session, body);
  }

  @Get("internal-team/permission-templates")
  listPermissionTemplates(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPermissionTemplates(session);
  }

  @Post("internal-team/permission-templates")
  upsertPermissionTemplate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertPermissionTemplate(session, body);
  }

  @Get("internal-team/permission-grid")
  listPermissionGridMatrix(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPermissionGridMatrix(session);
  }

  @Post("internal-team/permission-grid")
  setPermissionGrid(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.setPermissionGrid(session, body);
  }

  @Post("internal-team/access-grants")
  grantTimeBoundAccess(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.grantTimeBoundAccess(session, body);
  }

  @Get("internal-team/:userId/permissions")
  getInternalUserPermissions(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.getInternalUserPermissions(session, userId);
  }

  @Delete("internal-team/:userId")
  revokeInternalUser(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.revokeInternalUser(session, userId);
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
  async impersonate(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.superAdminService.impersonate(session, userId, body);
    const impersonationSession = await verifySessionToken(result.data.token);
    if (impersonationSession) {
      response.cookie(SESSION_COOKIE_NAME, result.data.token, getCookieOptions(true));
      response.cookie(CSRF_COOKIE_NAME, impersonationSession.csrfToken, getCookieOptions(false));
    }
    return result;
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

  @Get("support/data-corrections")
  listDataCorrections(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listDataCorrections(session);
  }

  @Patch("support/data-correction/:recordId/approve")
  approveDataCorrection(@CurrentSession() session: SessionPayload, @Param("recordId") recordId: string) {
    return this.superAdminService.approveDataCorrection(session, recordId);
  }

  @Patch("support/data-correction/:recordId/reject")
  rejectDataCorrection(@CurrentSession() session: SessionPayload, @Param("recordId") recordId: string, @Body() body: unknown) {
    return this.superAdminService.rejectDataCorrection(session, recordId, body);
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

  @Get("feature-flags/tier-matrix")
  listTierFeatures(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listTierFeatures(session);
  }

  @Post("feature-flags/tier-matrix")
  upsertTierFeature(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.upsertTierFeature(session, body);
  }

  @Get("feature-flags/overrides")
  listFeatureOverrides(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listFeatureOverrides(session);
  }

  @Post("feature-flags/overrides")
  requestFeatureOverride(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.requestFeatureOverride(session, body);
  }

  @Patch("feature-flags/overrides/:overrideId/approve")
  approveFeatureOverride(@CurrentSession() session: SessionPayload, @Param("overrideId") overrideId: string) {
    return this.superAdminService.approveFeatureOverride(session, overrideId);
  }

  @Get("feature-flags/branding")
  listBrandingAssets(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listBrandingAssets(session);
  }

  @Post("feature-flags/branding")
  submitBrandingAsset(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.submitBrandingAsset(session, body);
  }

  @Patch("feature-flags/branding/:assetId/approve")
  approveBrandingAsset(@CurrentSession() session: SessionPayload, @Param("assetId") assetId: string) {
    return this.superAdminService.approveBrandingAsset(session, assetId);
  }

  @Patch("feature-flags/branding/:assetId/apply")
  applyBrandingAsset(@CurrentSession() session: SessionPayload, @Param("assetId") assetId: string) {
    return this.superAdminService.applyBrandingAsset(session, assetId);
  }

  @Patch("feature-flags/:flagId/rollout")
  updateFeatureFlagRollout(@CurrentSession() session: SessionPayload, @Param("flagId") flagId: string, @Body() body: unknown) {
    return this.superAdminService.updateFeatureFlagRollout(session, flagId, body);
  }

  @Post("feature-flags/:flagId/rollback")
  rollbackFeatureFlag(@CurrentSession() session: SessionPayload, @Param("flagId") flagId: string) {
    return this.superAdminService.rollbackFeatureFlag(session, flagId);
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

  @Post("communications/audience-preview")
  previewAudience(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.previewAudience(session, body);
  }

  @Get("communications/campaigns")
  listCampaigns(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listCampaigns(session);
  }

  @Post("communications/campaigns")
  createCampaign(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createCampaign(session, body);
  }

  @Get("communications/campaigns/:campaignId/report")
  getCampaignReport(@CurrentSession() session: SessionPayload, @Param("campaignId") campaignId: string) {
    return this.superAdminService.getCampaignReport(session, campaignId);
  }

  @Patch("communications/campaigns/:campaignId/approve")
  approveCampaign(@CurrentSession() session: SessionPayload, @Param("campaignId") campaignId: string) {
    return this.superAdminService.approveCampaign(session, campaignId);
  }

  @Post("communications/campaigns/:campaignId/send")
  sendCampaign(@CurrentSession() session: SessionPayload, @Param("campaignId") campaignId: string) {
    return this.superAdminService.sendCampaign(session, campaignId);
  }

  @Get("communications/templates")
  listMessageTemplates(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listMessageTemplates(session);
  }

  @Post("communications/templates")
  createMessageTemplate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createMessageTemplate(session, body);
  }

  @Patch("communications/templates/:templateId/approval")
  updateTemplateApproval(@CurrentSession() session: SessionPayload, @Param("templateId") templateId: string, @Body() body: unknown) {
    return this.superAdminService.updateTemplateApproval(session, templateId, body);
  }

  @Get("communications/consent")
  listConsentRecords(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listConsentRecords(session);
  }

  @Post("communications/consent")
  setConsent(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.setConsent(session, body);
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

  @Patch("crm/leads/:leadId")
  updateLeadStage(@CurrentSession() session: SessionPayload, @Param("leadId") leadId: string, @Body() body: unknown) {
    return this.superAdminService.updateLeadStage(session, leadId, body);
  }

  @Get("security")
  security(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.securityOverview(session);
  }

  @Patch("security/sessions/:sessionId/revoke")
  revokeSession(@CurrentSession() session: SessionPayload, @Param("sessionId") sessionId: string) {
    return this.superAdminService.revokeSession(session, sessionId);
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

  @Patch("plans/:planId")
  updatePlan(@CurrentSession() session: SessionPayload, @Param("planId") planId: string, @Body() body: unknown) {
    return this.superAdminService.updatePlan(session, planId, body);
  }

  @Patch("plans/:planId/toggle")
  togglePlanActive(@CurrentSession() session: SessionPayload, @Param("planId") planId: string) {
    return this.superAdminService.togglePlanActive(session, planId);
  }

  @Get("feature-flags/lifecycle")
  planLifecycle(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPlanLifecycle(session);
  }
}
