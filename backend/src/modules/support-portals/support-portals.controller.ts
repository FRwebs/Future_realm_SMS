import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { SupportPortalsService } from "./support-portals.service";

@ApiTags("nurse")
@Controller("v1/nurse")
@UseGuards(SessionGuard, RolesGuard)
@Roles("SCHOOL_NURSE", "NURSE")
export class NursePortalController {
  constructor(private readonly supportPortalsService: SupportPortalsService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.getNurseDashboard(session) };
  }

  @Get("visits")
  async visits(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listNurseVisits(session) };
  }

  @Get("inventory")
  async inventory(@CurrentSession() session: SessionPayload) {
    const dashboard = await this.supportPortalsService.getNurseDashboard(session);
    return { ok: true, data: dashboard.inventory };
  }

  @Get("health-profiles/:studentId")
  async healthProfile(
    @CurrentSession() session: SessionPayload,
    @Param("studentId") studentId: string,
  ) {
    return { ok: true, data: await this.supportPortalsService.getNurseHealthProfile(session, studentId) };
  }
}

@ApiTags("library")
@Controller("v1/library")
@UseGuards(SessionGuard, RolesGuard)
@Roles("LIBRARIAN")
export class LibraryPortalController {
  constructor(private readonly supportPortalsService: SupportPortalsService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.getLibraryDashboard(session) };
  }

  @Get("books")
  async books(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listLibraryBooks(session) };
  }

  @Get("loans")
  async loans(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listLibraryLoans(session) };
  }

  @Get("loans/overdue")
  async overdue(@CurrentSession() session: SessionPayload) {
    const loans = await this.supportPortalsService.listLibraryLoans(session);
    return { ok: true, data: loans.filter((item) => !item.returnedAt && item.dueAt < new Date()) };
  }

  @Get("members")
  async members(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listLibraryMembers(session) };
  }
}

@ApiTags("front-desk")
@Controller("v1/front-desk")
@UseGuards(SessionGuard, RolesGuard)
@Roles("RECEPTIONIST")
export class FrontDeskPortalController {
  constructor(private readonly supportPortalsService: SupportPortalsService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.getFrontDeskDashboard(session) };
  }

  @Get("visitors")
  async visitors(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listFrontDeskVisitors(session) };
  }

  @Get("visitors/active")
  async activeVisitors(@CurrentSession() session: SessionPayload) {
    const visitors = await this.supportPortalsService.listFrontDeskVisitors(session);
    return { ok: true, data: visitors.filter((item) => !item.timeOut) };
  }

  @Get("meetings")
  async meetings(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listFrontDeskMeetings(session) };
  }
}

@ApiTags("hostel")
@Controller("v1/hostel")
@UseGuards(SessionGuard, RolesGuard)
@Roles("HOSTEL_MANAGER", "HOSTEL_MASTER", "HOSTEL_MATRON", "HOSTEL_MISTRESS")
export class HostelPortalController {
  constructor(private readonly supportPortalsService: SupportPortalsService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.getHostelDashboard(session) };
  }

  @Get("boarders")
  async boarders(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listHostelBoarders(session) };
  }

  @Get("rooms")
  async rooms(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listHostelRooms(session) };
  }

  @Get("bed-map")
  async bedMap(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listHostelRooms(session) };
  }
}

@ApiTags("transport")
@Controller("v1/transport")
@UseGuards(SessionGuard, RolesGuard)
@Roles("TRANSPORT_COORDINATOR", "TRANSPORT_MANAGER")
export class TransportPortalController {
  constructor(private readonly supportPortalsService: SupportPortalsService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.getTransportDashboard(session) };
  }

  @Get("vehicles")
  async vehicles(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listTransportVehicles(session) };
  }

  @Get("routes")
  async routes(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listTransportRoutes(session) };
  }

  @Get("students")
  async students(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listTransportStudents(session) };
  }

  @Get("compliance-alerts")
  async complianceAlerts(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.supportPortalsService.listTransportComplianceAlerts(session) };
  }
}
