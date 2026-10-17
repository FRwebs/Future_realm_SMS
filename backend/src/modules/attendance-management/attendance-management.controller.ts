import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { CasesService } from "./cases.service";
import { ComplianceService } from "./compliance.service";
import { CorrectionsService } from "./corrections.service";
import { OutputsService } from "./outputs.service";
import { RegisterService } from "./register.service";

/**
 * Attendance: the school's day arm by arm, the act of taking a register, who is keeping to the
 * rule, and the children behind the numbers. Literal paths come before parameters.
 */
@ApiTags("attendance-management")
@Controller("v1/attendance-management")
@UseGuards(SessionGuard, PermissionsGuard)
export class AttendanceManagementController {
  constructor(
    private readonly register: RegisterService,
    private readonly cases: CasesService,
    private readonly corrections: CorrectionsService,
    private readonly compliance: ComplianceService,
    private readonly outputs: OutputsService
  ) {}

  /* register */

  @Get("register")
  @RequirePermission("attendance.register.view")
  overview(@CurrentSession() session: SessionPayload, @Query("date") date?: string) {
    return ok(this.register.overview(session, date));
  }

  @Get("register/:classId/day")
  @RequirePermission("attendance.register.view")
  day(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Query("date") date?: string) {
    return ok(this.register.day(session, classId, date));
  }

  @Get("register/:classId/week")
  @RequirePermission("attendance.log.view")
  week(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Query("start") start?: string) {
    return ok(this.register.week(session, classId, start));
  }

  @Get("register/:classId/trend")
  @RequirePermission("attendance.log.view")
  trend(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.register.trend(session, classId));
  }

  @Get("explanations/:id")
  @RequirePermission("attendance.register.view")
  explanation(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.cases.explanation(session, id));
  }

  @Post("explanations/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.register.approve")
  decideExplanation(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.cases.decideExplanation(session, id, body), "Decision recorded.");
  }

  /* mark */

  @Get("mark/:classId")
  @RequirePermission("attendance.mark.view")
  markState(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Query("date") date?: string) {
    return ok(this.register.markState(session, classId, date));
  }

  @Post("mark/:classId/draft")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.mark.create")
  saveDraft(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Body() body: Record<string, unknown>) {
    return ok(this.register.saveDraft(session, classId, body), "Draft saved.");
  }

  @Post("mark/:classId/submit")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.mark.create")
  submit(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Body() body: Record<string, unknown>) {
    return ok(this.register.submit(session, classId, body), "Register submitted.");
  }

  /* corrections and reasons */

  @Get("corrections/options")
  @RequirePermission("attendance.register.view")
  correctionOptions(@CurrentSession() session: SessionPayload) {
    return ok(this.corrections.options(session));
  }

  @Post("corrections")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.register.edit")
  requestCorrection(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.request(session, body), "Correction recorded.");
  }

  @Post("corrections/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.register.edit")
  bulkCorrection(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.bulk(session, body), "Corrections recorded.");
  }

  @Post("corrections/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.log.approve")
  decideCorrection(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.decide(session, id, body), "Decision recorded.");
  }

  @Post("reasons")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.register.edit")
  recordReason(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.recordReason(session, body), "Reason recorded.");
  }

  /* compliance */

  @Get("compliance")
  @RequirePermission("attendance.compliance.view")
  complianceOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.compliance.compliance(session));
  }

  @Get("teachers/:userId")
  @RequirePermission("attendance.compliance.view")
  teacher(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return ok(this.compliance.teacher(session, userId));
  }

  @Post("arms/reassign")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.compliance.edit")
  reassign(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.compliance.reassign(session, body), "Arms reassigned.");
  }

  @Post("notify")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.compliance.create")
  notify(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.outputs.notify(session, body), "Notification sent.");
  }

  /* log */

  @Get("options")
  @RequirePermission("attendance.register.view")
  options(@CurrentSession() session: SessionPayload) {
    return ok(this.compliance.options(session));
  }

  @Get("log")
  @RequirePermission("attendance.log.view")
  log(@CurrentSession() session: SessionPayload) {
    return ok(this.compliance.log(session));
  }

  @Get("students/:studentId")
  @RequirePermission("attendance.log.view")
  student(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return ok(this.cases.studentCase(session, studentId));
  }

  @Post("cases")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.log.edit")
  openCase(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.cases.openCase(session, body), "Case opened.");
  }

  @Post("cases/:id/close")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.log.edit")
  closeCase(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.cases.closeCase(session, id, body), "Case closed.");
  }

  @Post("send")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.log.edit")
  send(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.outputs.send(session, body), "Attendance record sent.");
  }

  @Get("spool")
  @RequirePermission("attendance.log.export")
  spool(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | string[] | undefined>) {
    return ok(this.outputs.spool(session, query));
  }

  @Post("spool")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("attendance.log.export")
  spoolRecord(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.outputs.spoolRecord(session, body), "Record spooled.");
  }
}
