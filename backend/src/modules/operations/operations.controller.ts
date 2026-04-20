import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LeaveStatus } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { OperationsService } from "./operations.service";

@ApiTags("operations")
@Controller("v1/operations")
@UseGuards(SessionGuard, PermissionsGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get("overview")
  @RequirePermission("reports.view")
  async overview(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.overview(session) };
  }

  @Get("discipline")
  @RequirePermission("discipline.view")
  async discipline(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listDiscipline(session) };
  }

  @Post("discipline")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("discipline.create")
  async createDiscipline(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createDiscipline(session, body) };
  }

  @Patch("discipline/:id/decision")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("discipline.approve")
  async disciplineDecision(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.operationsService.updateDisciplineDecision(session, id, body) };
  }

  @Get("counseling")
  @RequirePermission("counseling_records.view")
  async counseling(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listCounseling(session) };
  }

  @Post("counseling")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("counseling_records.create")
  async createCounseling(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createCounseling(session, body) };
  }

  @Get("health")
  @RequirePermission("health_records.view")
  async health(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listHealth(session) };
  }

  @Post("health")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("health_records.create")
  async createHealth(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createHealth(session, body) };
  }

  @Get("visitors")
  @RequirePermission("visitors.view")
  async visitors(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listVisitors(session) };
  }

  @Post("visitors")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("visitors.create")
  async createVisitor(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createVisitor(session, body) };
  }

  @Patch("visitors/:id/sign-out")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("visitors.edit")
  async signOutVisitor(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.operationsService.signOutVisitor(session, id) };
  }

  @Get("lesson-plans")
  @RequirePermission("lesson_plans.view")
  async lessonPlans(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listLessonPlans(session) };
  }

  @Post("lesson-plans")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("lesson_plans.create")
  async createLessonPlan(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createLessonPlan(session, body) };
  }

  @Patch("lesson-plans/:id/review")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("lesson_plans.approve")
  async reviewLessonPlan(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.operationsService.reviewLessonPlan(session, id, body) };
  }

  @Get("question-bank")
  @RequirePermission("question_bank.view")
  async questionBank(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listQuestionBank(session) };
  }

  @Post("question-bank")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("question_bank.create")
  async createQuestion(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createQuestion(session, body) };
  }

  @Patch("question-bank/:id/approve")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("question_bank.approve")
  async approveQuestion(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.operationsService.approveQuestion(session, id, body) };
  }

  @Get("learning-materials")
  @RequirePermission("learning_materials.view")
  async learningMaterials(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listLearningMaterials(session) };
  }

  @Post("learning-materials")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("learning_materials.create")
  async createLearningMaterial(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createLearningMaterial(session, body) };
  }

  @Get("result-entry-windows")
  @RequirePermission("results.view")
  async resultWindows(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listResultWindows(session) };
  }

  @Post("result-entry-windows")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("results.approve")
  async createResultWindow(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createResultWindow(session, body) };
  }

  @Get("staff-leave")
  @RequirePermission("staff_leave.view")
  async staffLeave(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listStaffLeave(session) };
  }

  @Post("staff-leave")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff_leave.create")
  async createStaffLeave(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createStaffLeave(session, body) };
  }

  @Patch("staff-leave/:id/approve")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff_leave.approve")
  async approveStaffLeave(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.operationsService.reviewStaffLeave(session, id, LeaveStatus.APPROVED) };
  }

  @Patch("staff-leave/:id/reject")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff_leave.reject")
  async rejectStaffLeave(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.operationsService.reviewStaffLeave(session, id, LeaveStatus.REJECTED) };
  }

  @Get("inventory")
  @RequirePermission("inventory.view")
  async inventory(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listInventory(session) };
  }

  @Post("inventory")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("inventory.create")
  async createInventory(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createInventory(session, body) };
  }

  @Get("facilities")
  @RequirePermission("facilities.view")
  async facilities(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listFacilities(session) };
  }

  @Post("facilities")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("facilities.create")
  async createFacilityLog(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createFacilityLog(session, body) };
  }

  @Get("external-exams")
  @RequirePermission("external_exams.view")
  async externalExams(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listExternalExams(session) };
  }

  @Post("external-exams")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("external_exams.create")
  async createExternalExam(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createExternalExam(session, body) };
  }

  @Get("parent-meetings")
  @RequirePermission("parent_meetings.view")
  async parentMeetings(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listParentMeetings(session) };
  }

  @Post("parent-meetings")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parent_meetings.create")
  async createParentMeeting(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createParentMeeting(session, body) };
  }

  @Get("transport-vehicles")
  @RequirePermission("transport.view")
  async transportVehicles(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.operationsService.listTransportVehicles(session) };
  }

  @Post("transport-vehicles")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("transport.create")
  async createTransportVehicle(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.operationsService.createTransportVehicle(session, body) };
  }
}
