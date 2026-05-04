import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AcademicsService } from "./academics.service";

@ApiTags("academics")
@Controller("v1/academics")
@UseGuards(SessionGuard, RolesGuard)
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get("grades")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER")
  async list(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.academicsService.listGrades(session)
    };
  }

  @Post("grades")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return {
      ok: true,
      data: await this.academicsService.upsertGrade(session, body, true)
    };
  }

  @Post("grades/submit")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async saveAndSubmit(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.upsertGrade(session, body, false) };
  }

  @Get("grading-schemes")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async gradingSchemes(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listGradingSchemes(session) };
  }

  @Post("grading-schemes")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async createGradingScheme(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createGradingScheme(session, body) };
  }

  @Get("assessments")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async assessments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listAssessmentComponents(session) };
  }

  @Post("assessments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async createAssessment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createAssessmentComponent(session, body) };
  }

  @Get("subjects")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("subjects.view")
  async subjects(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return { ok: true, data: await this.academicsService.listSubjects(session, query) };
  }

  @Get("subjects/teacher-options")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  async subjectTeacherOptions(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return { ok: true, data: await this.academicsService.listSubjectTeacherOptions(session, query) };
  }

  @Get("subjects/:subjectId")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("subjects.view")
  async subject(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string) {
    return { ok: true, data: await this.academicsService.getSubject(session, subjectId) };
  }

  @Post("subjects")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.create")
  async createSubject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createSubject(session, body) };
  }

  @Patch("subjects/:subjectId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.edit")
  async updateSubject(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.updateSubject(session, subjectId, body) };
  }

  @Delete("subjects/:subjectId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.delete")
  async deleteSubject(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string) {
    return { ok: true, data: await this.academicsService.deleteSubject(session, subjectId) };
  }

  @Post("subjects/:subjectId/assign-teacher")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  async assignSubjectTeacher(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.assignSubjectTeacher(session, subjectId, body) };
  }

  @Get("section-assessment-components")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async sectionAssessmentComponents(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listSectionAssessmentComponents(session) };
  }

  @Post("section-assessment-components")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async createSectionAssessmentComponent(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createSectionAssessmentComponent(session, body) };
  }

  @Get("academic-assessments")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async academicAssessments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listAcademicAssessments(session) };
  }

  @Post("academic-assessments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT")
  async createAcademicAssessment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createAcademicAssessment(session, body) };
  }

  @Get("academic-assessments/:assessmentId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async academicAssessment(@CurrentSession() session: SessionPayload, @Param("assessmentId") assessmentId: string) {
    return { ok: true, data: await this.academicsService.getAcademicAssessment(session, assessmentId) };
  }

  @Post("academic-assessments/:assessmentId/candidates")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async generateCandidates(@CurrentSession() session: SessionPayload, @Param("assessmentId") assessmentId: string) {
    return { ok: true, data: await this.academicsService.generateAssessmentCandidates(session, assessmentId) };
  }

  @Post("academic-assessments/scores")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async recordAssessmentScores(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.recordAssessmentScores(session, body) };
  }

  @Get("broadsheets")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("results.view")
  async broadsheets(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return { ok: true, data: await this.academicsService.listBroadsheets(session, query) };
  }

  @Post("broadsheets/compile")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("results.compile")
  async compileBroadsheet(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.compileBroadsheet(session, body) };
  }

  @Get("broadsheets/:broadsheetId")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("results.view")
  async broadsheet(@CurrentSession() session: SessionPayload, @Param("broadsheetId") broadsheetId: string) {
    return { ok: true, data: await this.academicsService.getBroadsheet(session, broadsheetId) };
  }

  @Post("broadsheets/review")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("results.view")
  async reviewBroadsheet(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.reviewBroadsheet(session, body) };
  }

  @Get("report-cards")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("results.view")
  async reportCards(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listReportCards(session) };
  }

  @Get("approval-queue")
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermission("results.approve")
  async approvalQueue(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listApprovalQueue(session) };
  }

  @Post("score-sheets/submit")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async submit(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.submitScoreSheet(session, body) };
  }

  @Post("score-sheets/approve")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async approve(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.approveScoreSheet(session, body) };
  }

  @Post("score-sheets/reject")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async reject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.rejectScoreSheet(session, body) };
  }

  @Post("compile")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async compile(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.compileResults(session, body) };
  }

  @Post("publish")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async publish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.publishResults(session, body) };
  }

  @Post("unpublish")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async unpublish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.unpublishResults(session, body) };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER", "EXAMINATION_OFFICER")
  async analytics(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.getResultAnalytics(session) };
  }
}
