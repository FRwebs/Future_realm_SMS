import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ClassesService } from "./classes.service";

@ApiTags("classes")
@Controller("v1/classes")
@UseGuards(SessionGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @RequirePermission("classes.view")
  list(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.classesService.ok(this.classesService.listClasses(session, query));
  }

  @Get("teacher-options")
  @RequirePermission("classes.assign_teacher")
  teacherOptions(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.classesService.ok(this.classesService.listTeacherOptions(session, query));
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.create")
  create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.classesService.ok(this.classesService.createClass(session, body), "Class created successfully.");
  }

  @Get(":classId")
  @RequirePermission("classes.view")
  detail(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return this.classesService.ok(this.classesService.getClassDetail(session, classId));
  }

  @Get(":classId/members")
  @RequirePermission("classes.view")
  members(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.classesService.ok(this.classesService.listClassMembers(session, classId, query));
  }

  @Get(":classId/results")
  @RequirePermission("results.view")
  results(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.classesService.ok(this.classesService.getClassResults(session, classId, query));
  }

  @Get(":classId/attendance")
  @RequirePermission("attendance.view")
  attendance(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.classesService.ok(this.classesService.getClassAttendance(session, classId, query));
  }

  @Get(":classId/skills")
  @RequirePermission("results.view")
  skills(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.classesService.ok(this.classesService.getClassSkills(session, classId, query));
  }

  @Patch(":classId/assign-teacher")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.assign_teacher")
  assignTeacher(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.classesService.ok(this.classesService.assignTeacher(session, classId, body), "Teacher assignment saved.");
  }

  @Patch(":classId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  update(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.classesService.ok(this.classesService.updateClass(session, classId, body), "Class updated successfully.");
  }

  @Delete(":classId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.delete")
  remove(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return this.classesService.ok(this.classesService.deleteClass(session, classId), "Class archived successfully.");
  }
}
