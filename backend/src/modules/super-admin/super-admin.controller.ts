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
  impersonate(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.superAdminService.impersonate(session, userId);
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

  @Post("support/tickets/:ticketId/messages")
  addTicketMessage(@CurrentSession() session: SessionPayload, @Param("ticketId") ticketId: string, @Body() body: unknown) {
    return this.superAdminService.addTicketMessage(session, ticketId, body);
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

  @Get("plans")
  plans(@CurrentSession() session: SessionPayload) {
    return this.superAdminService.listPlans(session);
  }

  @Post("plans")
  createPlan(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.superAdminService.createPlan(session, body);
  }
}
