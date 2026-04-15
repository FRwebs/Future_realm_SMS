import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ParentPortalService } from "./parent-portal.service";

@ApiTags("parent-portal")
@Controller("v1/parent-portal")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PARENT")
export class ParentPortalController {
  constructor(private readonly parentPortalService: ParentPortalService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentDashboard(session) };
  }

  @Get("children")
  async children(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.listLinkedChildren(session) };
  }

  @Get("children/:studentId")
  async childOverview(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildOverviewForParent(session, studentId) };
  }

  @Get("children/:studentId/attendance")
  async childAttendance(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildAttendanceForParent(session, studentId) };
  }

  @Get("children/:studentId/results")
  async childResults(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildResultsForParent(session, studentId) };
  }

  @Get("children/:studentId/fees")
  async childFees(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildFeesForParent(session, studentId) };
  }

  @Get("children/:studentId/timetable")
  async childTimetable(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildTimetableForParent(session, studentId) };
  }

  @Get("announcements")
  async announcements(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentAnnouncements(session) };
  }

  @Get("notifications")
  async notifications(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentNotifications(session) };
  }

  @Get("profile")
  async profile(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentProfile(session) };
  }
}
