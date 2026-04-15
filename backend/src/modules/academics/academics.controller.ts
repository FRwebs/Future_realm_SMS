import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
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
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
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
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async gradingSchemes(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listGradingSchemes(session) };
  }

  @Post("grading-schemes")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async createGradingScheme(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createGradingScheme(session, body) };
  }

  @Get("assessments")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async assessments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listAssessmentComponents(session) };
  }

  @Post("assessments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async createAssessment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createAssessmentComponent(session, body) };
  }

  @Get("subjects")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async subjects(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listSubjects(session) };
  }

  @Post("subjects")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER")
  async createSubject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createSubject(session, body) };
  }

  @Get("section-assessment-components")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async sectionAssessmentComponents(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listSectionAssessmentComponents(session) };
  }

  @Post("section-assessment-components")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER")
  async createSectionAssessmentComponent(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createSectionAssessmentComponent(session, body) };
  }

  @Get("academic-assessments")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async academicAssessments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listAcademicAssessments(session) };
  }

  @Post("academic-assessments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER")
  async createAcademicAssessment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.createAcademicAssessment(session, body) };
  }

  @Get("academic-assessments/:assessmentId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async academicAssessment(@CurrentSession() session: SessionPayload, @Param("assessmentId") assessmentId: string) {
    return { ok: true, data: await this.academicsService.getAcademicAssessment(session, assessmentId) };
  }

  @Post("academic-assessments/:assessmentId/candidates")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER")
  async generateCandidates(@CurrentSession() session: SessionPayload, @Param("assessmentId") assessmentId: string) {
    return { ok: true, data: await this.academicsService.generateAssessmentCandidates(session, assessmentId) };
  }

  @Post("academic-assessments/scores")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER")
  async recordAssessmentScores(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.recordAssessmentScores(session, body) };
  }

  @Get("broadsheets")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "CLASS_TEACHER")
  async broadsheets(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listBroadsheets(session) };
  }

  @Post("broadsheets/compile")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER")
  async compileBroadsheet(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.compileBroadsheet(session, body) };
  }

  @Get("broadsheets/:broadsheetId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "CLASS_TEACHER")
  async broadsheet(@CurrentSession() session: SessionPayload, @Param("broadsheetId") broadsheetId: string) {
    return { ok: true, data: await this.academicsService.getBroadsheet(session, broadsheetId) };
  }

  @Post("broadsheets/review")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "CLASS_TEACHER")
  async reviewBroadsheet(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.reviewBroadsheet(session, body) };
  }

  @Get("report-cards")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMIN_OFFICER", "EXAM_OFFICER", "HEAD_OF_DEPARTMENT", "CLASS_TEACHER")
  async reportCards(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listReportCards(session) };
  }

  @Get("approval-queue")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async approvalQueue(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.listApprovalQueue(session) };
  }

  @Post("score-sheets/submit")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async submit(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.submitScoreSheet(session, body) };
  }

  @Post("score-sheets/approve")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async approve(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.approveScoreSheet(session, body) };
  }

  @Post("score-sheets/reject")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async reject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.rejectScoreSheet(session, body) };
  }

  @Post("compile")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async compile(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.compileResults(session, body) };
  }

  @Post("publish")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async publish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.publishResults(session, body) };
  }

  @Post("unpublish")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async unpublish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return { ok: true, data: await this.academicsService.unpublishResults(session, body) };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async analytics(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.academicsService.getResultAnalytics(session) };
  }
}
