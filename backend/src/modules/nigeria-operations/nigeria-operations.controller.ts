import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { NigeriaOperationsService } from "./nigeria-operations.service";

@ApiTags("nigeria-operations")
@Controller("v1/nigeria-operations")
@UseGuards(SessionGuard, RolesGuard)
export class NigeriaOperationsController {
  constructor(private readonly nigeriaOperationsService: NigeriaOperationsService) {}

  @Get("dashboard")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.getDashboard(session) };
  }

  @Get("curriculum")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "PARENT", "STUDENT")
  async curriculum(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.listCurriculum(session) };
  }

  @Post("curriculum")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async createCurriculum(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.nigeriaOperationsService.createCurriculumTopic(session, body) };
  }

  @Post("curriculum/:topicId/progress")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async curriculumProgress(
    @CurrentSession() session: SessionPayload,
    @Param("topicId") topicId: string,
    @Body() body: Record<string, unknown>
  ) {
    return { ok: true, data: await this.nigeriaOperationsService.updateCurriculumProgress(session, topicId, body) };
  }

  @Get("staff-attendance")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async staffAttendance(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.listStaffAttendance(session) };
  }

  @Put("staff-attendance/policy")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async policy(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.nigeriaOperationsService.updateAttendancePolicy(session, body) };
  }

  @Post("staff-attendance/clock-in")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("TEACHER")
  async clockIn(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.clockIn(session) };
  }

  @Post("staff-attendance/clock-out")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("TEACHER")
  async clockOut(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.clockOut(session) };
  }

  @Post("staff-attendance/manual")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async manualAttendance(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.nigeriaOperationsService.recordManualStaffAttendance(session, body) };
  }

  @Get("training")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async training(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.listTrainingPrograms(session) };
  }

  @Post("training")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async createTraining(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.nigeriaOperationsService.createTrainingProgram(session, body) };
  }

  @Post("training/:trainingProgramId/participants")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async assignParticipants(
    @CurrentSession() session: SessionPayload,
    @Param("trainingProgramId") trainingProgramId: string,
    @Body() body: Record<string, unknown>
  ) {
    return { ok: true, data: await this.nigeriaOperationsService.assignTrainingParticipants(session, trainingProgramId, body) };
  }

  @Get("training/participants")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async participants(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.nigeriaOperationsService.listTrainingParticipants(session) };
  }

  @Post("training/participants/:participantId/complete")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async completeParticipant(
    @CurrentSession() session: SessionPayload,
    @Param("participantId") participantId: string,
    @Body() body: Record<string, unknown>
  ) {
    return { ok: true, data: await this.nigeriaOperationsService.completeTrainingParticipant(session, participantId, body) };
  }
}
