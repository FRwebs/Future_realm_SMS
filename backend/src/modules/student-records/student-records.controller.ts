import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { refuseTeaching } from "../../common/teaching-scope";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AdmissionsBoardService } from "./admissions-board.service";
import { ChangesService } from "./changes.service";
import { RecordService } from "./record.service";
import { SafeguardingService } from "./safeguarding.service";
import { SupportPlansService } from "./support-plans.service";
import { RegistryService } from "./registry.service";
import { ok } from "./records.shared";

/**
 * Student Records: the registry, one child in full, what has been asked of their record, and who
 * is trying to get in. Literal paths come before parameters so `:id` never swallows a word.
 */
@ApiTags("student-records")
@Controller("v1/student-records")
@UseGuards(SessionGuard, PermissionsGuard)
export class StudentRecordsController {
  constructor(
    private readonly registry: RegistryService,
    private readonly record: RecordService,
    private readonly changes: ChangesService,
    private readonly board: AdmissionsBoardService,
    private readonly supportPlans: SupportPlansService,
    private readonly safeguarding: SafeguardingService
  ) {}

  /* registry */

  @Get("registry")
  @RequirePermission("student-records.registry.view")
  registryOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.registry.overview(session));
  }

  @Get("registry/enrol-options")
  @RequirePermission("student-records.registry.view")
  async enrolOptions(@CurrentSession() session: SessionPayload) {
    await refuseTeaching(session, "My students");
    return ok(this.registry.enrolOptions(session));
  }

  @Get("registry/move-options")
  @RequirePermission("student-records.registry.view")
  async moveOptions(@CurrentSession() session: SessionPayload) {
    await refuseTeaching(session, "My students");
    return ok(this.registry.moveOptions(session));
  }

  @Post("registry/enrol")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.create")
  enrol(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.registry.enrol(session, body), "Student enrolled.");
  }

  @Post("registry/move")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.edit")
  move(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.registry.move(session, body), "Students moved.");
  }

  @Post("registry/resend")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.edit")
  resend(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.registry.resend(session, body), "Invitations resent.");
  }

  /* one child */

  @Get("students/:id")
  @RequirePermission("student-records.registry.view")
  dossier(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.record.dossier(session, id));
  }

  @Get("students/:id/results/:termId")
  @RequirePermission("student-records.registry.view")
  termResult(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("termId") termId: string) {
    return ok(this.record.termResult(session, id, termId));
  }

  @Post("students/:id/notes")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.create")
  addNote(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.addNote(session, id, body), "Note saved.");
  }

  @Post("students/:id/account")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.edit")
  account(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.account(session, id, body));
  }

  @Post("students/:id/reveal")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.view")
  reveal(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.reveal(session, id, body));
  }

  @Get("safeguarding")
  @RequirePermission("student-records.changes.view")
  safeguardingList(@CurrentSession() session: SessionPayload) {
    return ok(this.safeguarding.list(session));
  }

  @Post("safeguarding/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.changes.view")
  safeguardingDecide(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.safeguarding.decide(session, id, body), "Recorded.");
  }

  @Post("students/:id/support-plan")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.view")
  saveSupportPlan(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.supportPlans.save(session, id, body), "Plan saved.");
  }

  @Post("students/:id/support-plan/end")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.view")
  endSupportPlan(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.supportPlans.end(session, id, body), "Plan ended.");
  }

  @Post("students/:id/collectors")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.create")
  addCollector(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.addCollector(session, id, body), "Collector added.");
  }

  @Post("students/:id/documents")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.create")
  addDocument(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.addDocument(session, id, body), "Document recorded.");
  }

  @Post("students/:id/guardians")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.registry.edit")
  mapGuardian(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.record.mapGuardian(session, id, body), "Guardian mapped.");
  }

  /* changes */

  @Get("changes")
  @RequirePermission("student-records.changes.view")
  changesOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.changes.overview(session));
  }

  @Post("changes")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.changes.create")
  requestChange(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.changes.request(session, body), "Change requested.");
  }

  @Post("changes/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.changes.approve")
  decideChange(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.changes.decide(session, id, body), "Decision recorded.");
  }

  /* admissions */

  @Get("admissions")
  @RequirePermission("student-records.admissions.view")
  admissions(@CurrentSession() session: SessionPayload) {
    return ok(this.board.overview(session));
  }

  @Get("admissions/options")
  @RequirePermission("student-records.admissions.view")
  admissionOptions(@CurrentSession() session: SessionPayload) {
    return ok(this.board.options(session));
  }

  @Get("admissions/pipeline/:state")
  @RequirePermission("student-records.admissions.view")
  pipeline(@CurrentSession() session: SessionPayload, @Param("state") state: string) {
    return ok(this.board.pipeline(session, state));
  }

  @Post("admissions")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.create")
  createApplication(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.board.create(session, body), "Application created.");
  }

  @Post("admissions/sessions")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.create")
  addSession(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.board.addSession(session, body), "Session scheduled.");
  }

  @Post("admissions/schedule")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.edit")
  schedule(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.board.schedule(session, body), "Seats booked.");
  }

  @Post("admissions/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.approve")
  bulk(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.board.bulk(session, body), "Done.");
  }

  @Get("admissions/:id")
  @RequirePermission("student-records.admissions.view")
  applicant(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.board.applicant(session, id));
  }

  @Post("admissions/:id/advance")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.edit")
  advance(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.board.advance(session, id, body), "Application moved on.");
  }

  @Post("admissions/:id/decline")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.approve")
  decline(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.board.decline(session, id, body), "Application closed.");
  }

  @Post("admissions/:id/reopen")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.approve")
  reopen(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.board.reopen(session, id, body), "Application reopened.");
  }

  @Post("admissions/:id/contact")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.edit")
  editContact(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.board.editContact(session, id, body), "Contact updated.");
  }

  @Post("admissions/:id/documents")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("student-records.admissions.edit")
  requestDocuments(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.board.requestDocuments(session, id, body), "Documents requested.");
  }
}
