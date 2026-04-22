import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { StudentPortalService } from "./student-portal.service";

@ApiTags("student-portal")
@Controller("v1/student-portal")
@UseGuards(SessionGuard, RolesGuard)
@Roles("STUDENT")
export class StudentPortalController {
  constructor(private readonly studentPortalService: StudentPortalService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentDashboard(session) };
  }

  @Get("profile")
  async profile(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentProfile(session) };
  }

  @Get("attendance")
  async attendance(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentAttendance(session) };
  }

  @Get("results")
  async results(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentResults(session) };
  }

  @Get("timetable")
  async timetable(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentTimetable(session) };
  }

  @Get("subjects")
  async subjects(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentSubjects(session) };
  }

  @Get("subjects/:subjectId/scheme-of-work")
  async subjectSchemeOfWork(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string) {
    return { ok: true, data: await this.studentPortalService.getStudentSubjectSchemeOfWork(session, subjectId) };
  }

  @Get("assignments")
  async assignments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentAssignments(session) };
  }

  @Get("fees")
  async fees(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentFees(session) };
  }

  @Get("announcements")
  async announcements(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentAnnouncements(session) };
  }

  @Get("notifications")
  async notifications(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentNotifications(session) };
  }

  @Get("services")
  async services(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.studentPortalService.getStudentServices(session) };
  }
}
