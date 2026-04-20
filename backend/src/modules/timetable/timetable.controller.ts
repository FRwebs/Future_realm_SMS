import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { TimetableService } from "./timetable.service";

@ApiTags("timetable")
@Controller("v1/timetable")
@UseGuards(SessionGuard, PermissionsGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get("classes")
  @RequirePermission("timetable.view")
  classes(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.timetableService.ok(this.timetableService.listClasses(session, query));
  }

  @Get("teacher/my")
  @RequirePermission("timetable.view")
  myTimetable(@CurrentSession() session: SessionPayload) {
    return this.timetableService.ok(this.timetableService.getTeacherTimetable(session));
  }

  @Get("teacher-options")
  @RequirePermission("timetable.create")
  teacherOptions(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.timetableService.ok(this.timetableService.listTeacherOptions(session, query));
  }

  @Get("conflicts/check")
  @RequirePermission("timetable.view_all")
  conflicts(@CurrentSession() session: SessionPayload) {
    return this.timetableService.ok(this.timetableService.checkConflicts(session));
  }

  @Post("publish-all")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.publish")
  publishAll(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.timetableService.ok(this.timetableService.publishAll(session, body));
  }

  @Get(":classId")
  @RequirePermission("timetable.view")
  detail(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.timetableService.ok(this.timetableService.getClassTimetable(session, classId, query));
  }

  @Get(":classId/subjects")
  @RequirePermission("timetable.view")
  subjects(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return this.timetableService.ok(this.timetableService.listClassSubjects(session, classId));
  }

  @Post(":classId/slot")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.create")
  saveSlot(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.timetableService.ok(this.timetableService.saveSlot(session, classId, body));
  }

  @Delete(":classId/slot/:slotId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.delete")
  deleteSlot(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Param("slotId") slotId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.timetableService.ok(this.timetableService.deleteSlot(session, classId, slotId, query));
  }

  @Patch(":classId/publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.publish")
  publishClass(
    @CurrentSession() session: SessionPayload,
    @Param("classId") classId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.timetableService.ok(this.timetableService.publishClass(session, classId, body));
  }
}
