import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { OutputsService } from "../attendance-management/outputs.service";
import { ok } from "../student-records/records.shared";
import { ScoreCorrectionsService } from "./corrections.service";
import { ResultsService } from "./results.service";
import { ReviewService } from "./review.service";
import { SESSION_RULES, sessionRuleFor, sessionStandings } from "./session";
import { SheetsService } from "./sheets.service";

/**
 * Score Entry & Results: every arm's submission, and every number explained. Literal paths come before
 * parameters so `:classId` never swallows a word.
 */
@ApiTags("score-results")
@Controller("v1/score-results")
@UseGuards(SessionGuard, PermissionsGuard)
export class ScoreResultsController {
  constructor(
    private readonly sheets: SheetsService,
    private readonly review: ReviewService,
    private readonly results: ResultsService,
    private readonly corrections: ScoreCorrectionsService,
    private readonly outputs: OutputsService
  ) {}

  /* session standings */

  @Get("session/:academicSessionId/:classId")
  @RequirePermission("score-entry-results.review.view")
  sessionStandings(
    @CurrentSession() session: SessionPayload,
    @Param("academicSessionId") academicSessionId: string,
    @Param("classId") classId: string
  ) {
    return ok(sessionStandings(session.schoolId, academicSessionId, classId));
  }

  @Get("session-rule")
  @RequirePermission("score-entry-results.review.view")
  async sessionRule(@CurrentSession() session: SessionPayload) {
    const current = await sessionRuleFor(session.schoolId);
    return ok(Promise.resolve({ ...current, options: SESSION_RULES }));
  }

  /* review */

  @Get("review")
  @RequirePermission("score-entry-results.review.view")
  reviewOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.review.overview(session));
  }

  @Post("review/approve-ready")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.review.approve")
  approveReady(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.review.approveReady(session, body), "Sheets approved.");
  }

  @Post("notify")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.review.create")
  notify(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.outputs.notify(session, body), "Notification sent.");
  }

  @Get("review/:classId")
  @RequirePermission("score-entry-results.review.view")
  armReview(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.review.armReview(session, classId));
  }

  @Get("review/:classId/:subjectId")
  @RequirePermission("score-entry-results.review.view")
  sheetPage(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string) {
    return ok(this.review.sheetPage(session, classId, subjectId));
  }

  @Post("review/:classId/:subjectId/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.review.approve")
  decide(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.review.decide(session, classId, subjectId, body), "Decision recorded.");
  }

  @Post("review/:classId/:subjectId/reverse")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.review.approve")
  reverse(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.review.reverse(session, classId, subjectId, body), "Approval taken back.");
  }

  @Post("review/:classId/:subjectId/flags")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.review.edit")
  flagOutcome(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.review.flagOutcome(session, classId, subjectId, body), "Outcome recorded.");
  }

  /* enter */

  @Get("enter")
  @RequirePermission("score-entry-results.enter.view")
  chooser(@CurrentSession() session: SessionPayload, @Query() query: { level?: string; arm?: string }) {
    return ok(this.sheets.chooser(session, query));
  }

  @Get("enter/:classId/broadsheet")
  @RequirePermission("score-entry-results.enter.view")
  broadsheet(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.sheets.broadsheet(session, classId));
  }

  @Get("enter/:classId/:subjectId")
  @RequirePermission("score-entry-results.enter.view")
  grid(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string) {
    return ok(this.sheets.grid(session, classId, subjectId));
  }

  @Post("enter/:classId/:subjectId/save")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.enter.create")
  save(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.sheets.save(session, classId, subjectId, body), "Draft saved.");
  }

  @Post("enter/:classId/:subjectId/submit")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.enter.create")
  submit(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.sheets.submit(session, classId, subjectId, body), "Submitted for approval.");
  }

  @Post("enter/:classId/:subjectId/delete")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.enter.create")
  remove(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Body() body: Record<string, unknown>) {
    return ok(this.sheets.remove(session, classId, subjectId, body), "Entry deleted.");
  }

  /* results */

  @Get("results")
  @RequirePermission("score-entry-results.results.view")
  resultsOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.results.overview(session));
  }

  @Get("corrections")
  @RequirePermission("score-entry-results.results.view")
  correctionList(@CurrentSession() session: SessionPayload, @Query("classId") classId?: string) {
    return ok(this.corrections.list(session, { classId }));
  }

  @Get("corrections/options")
  @RequirePermission("score-entry-results.results.view")
  correctionOptions(@CurrentSession() session: SessionPayload) {
    return ok(this.corrections.options(session));
  }

  @Post("corrections")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.results.create")
  requestCorrection(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.request(session, body), "Correction requested.");
  }

  @Post("corrections/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("score-entry-results.results.approve")
  decideCorrection(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.corrections.decide(session, id, body), "Decision recorded.");
  }

  @Get("results/:classId")
  @RequirePermission("score-entry-results.results.view")
  armBroadsheet(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.results.armBroadsheet(session, classId));
  }

  @Get("results/:classId/:studentId")
  @RequirePermission("score-entry-results.results.view")
  student(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("studentId") studentId: string) {
    return ok(this.results.studentPage(session, classId, studentId));
  }

  @Get("results/:classId/:studentId/explain")
  @RequirePermission("score-entry-results.results.view")
  explain(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("studentId") studentId: string, @Query("subject") subject?: string) {
    return ok(this.results.explain(session, classId, studentId, subject));
  }
}
