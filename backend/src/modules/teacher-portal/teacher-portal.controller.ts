import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { TeacherPortalService } from "./teacher-portal.service";

@ApiTags("teacher-portal")
@Controller("v1/teacher-portal")
@UseGuards(SessionGuard, RolesGuard)
@Roles("TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
export class TeacherPortalController {
  constructor(private readonly teacherPortalService: TeacherPortalService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.getTeacherDashboard(session) };
  }

  @Get("assignments")
  async assignments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.listTeacherAssignments(session) };
  }

  @Get("timetable")
  async timetable(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.getTeacherTimetable(session) };
  }

  @Get("attendance")
  async attendance(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.getAttendanceWorkspace(session) };
  }

  @Post("attendance")
  async markAttendance(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.teacherPortalService.markAttendance(session, body) };
  }

  @Post("attendance/register")
  async submitDailyRegister(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.teacherPortalService.submitDailyRegister(session, body) };
  }

  @Get("scores")
  async scores(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.listScores(session) };
  }

  @Post("scores")
  async enterScores(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.teacherPortalService.enterAssessmentScores(session, body) };
  }

  @Get("tasks")
  async tasks(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.listTeacherAssignmentTasks(session) };
  }

  @Post("tasks")
  async createTask(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.teacherPortalService.createAssignment(session, body) };
  }

  @Get("announcements")
  async announcements(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.listTeacherAnnouncements(session) };
  }

  @Get("notifications")
  async notifications(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.teacherPortalService.listTeacherNotifications(session) };
  }
}
