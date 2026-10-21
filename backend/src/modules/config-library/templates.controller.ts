import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TemplatesService } from "./templates.service";

const editRoles = ["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-config-library")
@Controller("super-admin/config-library")
@UseGuards(SessionGuard, CsrfGuard, RolesGuard)
@Roles(...editRoles)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

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
