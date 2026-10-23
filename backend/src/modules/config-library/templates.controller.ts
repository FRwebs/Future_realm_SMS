import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { CARD_SECTIONS, LibraryService } from "./library.service";
import { TemplatesService } from "./templates.service";

const editRoles = ["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-config-library")
@Controller("super-admin/config-library")
@UseGuards(SessionGuard, CsrfGuard, RolesGuard)
@Roles(...editRoles)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService, private readonly library: LibraryService) {}

  @Get("curricula/:id/history")
  history(@Param("id") id: string) {
    return ok(this.library.history(id), "Version history loaded");
  }

  @Post("curricula/:id/layers")
  saveLayers(@CurrentSession() s: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.library.saveLayers(s, id, body), "Layers saved");
  }

  @Post("portability/run-all")
  portabilityAll(@CurrentSession() s: SessionPayload) {
    return ok(this.library.runAllPortability(s), "Portability tests run");
  }

  @Post("curricula/:id/portability")
  portability(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.runPortability(s, "CURRICULUM", id), "Portability tests run");
  }

  @Post("grading-scales/:id/default")
  makeDefault(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.makeDefault(s, id), "Default grading scale changed");
  }

  @Post("grading-scales/:id/duplicate")
  duplicateGrading(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.duplicateGrading(s, id), "Copied as a custom draft");
  }

  @Get("grading-scales/:id/schools")
  async schoolsOnScale(@Param("id") id: string) {
    const scale = await this.templates.gradingName(id);
    return ok(this.library.schoolsOnScale(scale), "Schools on this scale");
  }

  @Post("assessment-frameworks")
  saveFramework(@CurrentSession() s: SessionPayload, @Body() body: unknown) {
    return ok(this.library.saveFramework(s, body), "Framework saved");
  }

  @Post("assessment-frameworks/:id/toggle")
  toggleFramework(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.archiveFramework(s, id), "Framework updated");
  }

  @Post("report-card-layouts")
  saveCard(@CurrentSession() s: SessionPayload, @Body() body: unknown) {
    return ok(this.library.saveCard(s, body), "Layout saved as a draft");
  }

  @Post("report-card-layouts/:id/duplicate")
  duplicateCard(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.duplicateCard(s, id), "Copied as a new draft");
  }

  @Post("report-card-layouts/:id/submit")
  submitCard(@CurrentSession() s: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.library.submitCard(s, id, body), "Sent for review");
  }

  @Post("report-card-layouts/:id/return")
  returnCard(@CurrentSession() s: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.library.returnCard(s, id, body), "Sent back to its author");
  }

  @Post("report-card-layouts/:id/approve")
  approveCard(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.library.approveCard(s, id), "Layout published");
  }

  @Get("report-card-layouts/:id/preview")
  previewCard(@Param("id") id: string) {
    return ok(this.library.previewCard(id), "Sample card built");
  }

  @Get("report-card-layouts/:id/schools")
  schoolsUsingCard(@Param("id") id: string) {
    return ok(this.library.schoolsUsingCard(id), "Schools using this layout");
  }

  @Get("sections")
  sections() {
    return ok(Promise.resolve(CARD_SECTIONS), "Sections loaded");
  }

  @Post("curricula/:id/version")
  version(@CurrentSession() s: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.templates.newVersion(s, id, body), "New version created as a draft");
  }

  @Post("curricula/:id/validate")
  validate(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.validateCurriculum(s, id), "Template validated");
  }

  @Post("curricula/:id/publish")
  publish(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.publishCurriculum(s, id), "Template published");
  }

  @Post("curricula/:id/archive")
  archive(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.archiveCurriculum(s, id), "Template archived");
  }

  @Post("grading-scales/:id/validate")
  validateGrading(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.validateGrading(s, id), "Scale validated");
  }

  @Post("grading-scales/:id/publish")
  publishGrading(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.publishGrading(s, id), "Scale published");
  }

  @Post("grading-scales/:id/archive")
  archiveGrading(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.archiveGrading(s, id), "Scale archived");
  }

  @Post("mappings")
  addMapping(@CurrentSession() s: SessionPayload, @Body() body: unknown) {
    return ok(this.templates.addMapping(s, body), "Mapping saved");
  }

  @Delete("mappings/:id")
  removeMapping(@CurrentSession() s: SessionPayload, @Param("id") id: string) {
    return ok(this.templates.removeMapping(s, id), "Mapping removed");
  }

  @Get("class-assignments")
  classAssignments(@Query("schoolId") schoolId?: string) {
    return ok(this.templates.classAssignments(schoolId), "Class assignments loaded");
  }

  @Get("class-options")
  classOptions() {
    return ok(this.templates.classOptions(), "Classes loaded");
  }

  @Post("class-assignments")
  assignClass(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.templates.assignClass(session, body), "Class assigned to a template version");
  }

  @Post("class-assignments/:classId/clear")
  clearClassAssignment(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.templates.clearClassAssignment(session, classId), "Class put back on the school's own version");
  }

  @Get("templates/:id/schools")
  schoolsUsing(@Param("id") id: string) {
    return ok(this.templates.schoolsUsing(id), "Schools using this template");
  }

  @Post("country-profiles")
  saveProfile(@CurrentSession() s: SessionPayload, @Body() body: unknown) {
    return ok(this.templates.saveProfile(s, body), "Country profile saved");
  }

  @Patch("country-profiles")
  patchProfile(@CurrentSession() s: SessionPayload, @Body() body: unknown) {
    return ok(this.templates.saveProfile(s, body), "Country profile saved");
  }
}
