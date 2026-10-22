import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { refuseTeaching } from "../../common/teaching-scope";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ClassStructureExtrasService } from "./class-structure-extras.service";
import { ClassStructureService } from "./class-structure.service";
import { TimetableVersionsService } from "./timetable-versions.service";

/**
 * Class & Timetable's reads and writes that cut across classes, arms and subjects.
 * Routes are declared literal-first so `:id` never swallows a word.
 */
@ApiTags("class-structure")
@Controller("v1/class-structure")
@UseGuards(SessionGuard, PermissionsGuard)
export class ClassStructureController {
  constructor(
    private readonly service: ClassStructureService,
    private readonly timetables: TimetableVersionsService,
    private readonly extras: ClassStructureExtrasService
  ) {}

  @Get("arms/:armId/students/:studentId")
  @RequirePermission("classes.view")
  studentInArm(
    @CurrentSession() session: SessionPayload,
    @Param("armId") armId: string,
    @Param("studentId") studentId: string
  ) {
    return this.extras.ok(this.extras.studentInArm(session, armId, studentId));
  }

  @Post("teaching/bulk-assign")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  bulkAssign(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.bulkAssign(session, body), "Teacher assigned.");
  }

  @Post("teaching/bulk-update")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  bulkUpdate(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.bulkUpdate(session, body), "Offering changed.");
  }

  @Post("teaching/offer")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  offerSubject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.offerSubject(session, body), "Subject registered.");
  }

  @Post("arms/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  bulkArms(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.bulkArms(session, body), "Arms updated.");
  }

  @Post("classes/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  bulkClasses(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.bulkClasses(session, body), "Classes updated.");
  }

  @Post("allocate/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  allocateBulk(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.extras.ok(this.extras.allocateBulk(session, body), "Students allocated.");
  }

  @Get("timetables")
  @RequirePermission("timetable.view")
  async timetableList(@CurrentSession() session: SessionPayload) {
    // The whole school's timetable versions are the administrator's; a teaching role reads its own (v1/teacher-workspace/timetable).
    await refuseTeaching(session, "your own timetable under Timetable");
    return this.timetables.ok(this.timetables.list(session));
  }

  @Get("timetables/:id")
  @RequirePermission("timetable.view")
  async timetableOne(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    await refuseTeaching(session, "your own timetable under Timetable");
    return this.timetables.ok(this.timetables.detail(session, id));
  }

  @Post("timetables")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.create")
  timetableCreate(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.timetables.ok(this.timetables.create(session, body), "Timetable started as a draft.");
  }

  @Patch("timetables/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.create")
  timetableSave(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.timetables.ok(this.timetables.save(session, id, body), "Timetable saved.");
  }

  @Post("timetables/publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.publish")
  timetablePublishChosen(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.timetables.ok(
      this.timetables.publish(session, String(body.timetableId ?? ""), body),
      "Timetable published."
    );
  }

  @Post("timetables/:id/publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.publish")
  timetablePublish(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.timetables.ok(this.timetables.publish(session, id, body), "Timetable published.");
  }

  @Post("timetables/:id/unschedule")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.publish")
  timetableUnschedule(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.timetables.ok(this.timetables.unschedule(session, id), "Taken off its schedule.");
  }

  @Delete("timetables/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("timetable.delete")
  timetableDelete(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.timetables.ok(this.timetables.remove(session, id), "Timetable deleted.");
  }

  @Get("overview")
  @RequirePermission("classes.view")
  overview(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.overview(session));
  }

  @Get("teaching")
  @RequirePermission("subjects.view")
  teaching(@CurrentSession() session: SessionPayload) {
    return this.service.ok(this.service.teaching(session));
  }

  @Get("coverage")
  @RequirePermission("classes.view")
  async coverage(@CurrentSession() session: SessionPayload) {
    await this.timetables.applyDue(session.schoolId);
    return this.service.ok(this.service.coverage(session));
  }

  @Get("arms/:armId")
  @RequirePermission("classes.view")
  arm(@CurrentSession() session: SessionPayload, @Param("armId") armId: string) {
    return this.service.ok(this.service.armDetail(session, armId));
  }

  @Post("classes")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.create")
  createClass(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.createClass(session, body), "Class created.");
  }

  @Patch("classes/:levelId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  updateClass(
    @CurrentSession() session: SessionPayload,
    @Param("levelId") levelId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.ok(this.service.updateClass(session, levelId, body), "Class saved.");
  }

  @Post("arms")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.create")
  createArm(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.createArm(session, body), "Arm created.");
  }

  @Patch("arms/:armId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  updateArm(
    @CurrentSession() session: SessionPayload,
    @Param("armId") armId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.ok(this.service.updateArm(session, armId, body), "Arm saved.");
  }

  @Delete("classes/:levelId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.delete")
  async deleteClass(@CurrentSession() session: SessionPayload, @Param("levelId") levelId: string) {
    const result = await this.service.deleteClass(session, levelId);
    return {
      ok: true,
      success: true,
      message: result.erased ? "Class deleted." : "Class closed — other records still refer to it, so it was not erased.",
      data: result
    };
  }

  @Delete("arms/:armId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.delete")
  deleteArm(@CurrentSession() session: SessionPayload, @Param("armId") armId: string) {
    return this.service.ok(this.service.deleteArm(session, armId), "Arm deleted.");
  }

  @Post("allocate")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("classes.edit")
  allocate(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.allocate(session, body), "Students allocated.");
  }

  @Post("teaching/map")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  map(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.mapSubject(session, body), "Subject mapped.");
  }

  @Post("teaching/ceiling")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  ceiling(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.setCeiling(session, body), "Ceiling raised.");
  }

  @Post("teaching/subject")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.create")
  addSubject(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.service.ok(this.service.addSubject(session, body), "Subject added.");
  }

  @Patch("teaching/:mappingId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  updateMapping(
    @CurrentSession() session: SessionPayload,
    @Param("mappingId") mappingId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.ok(this.service.updateMapping(session, mappingId, body), "Mapping saved.");
  }

  @Delete("teaching/:mappingId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("subjects.assign")
  removeMapping(@CurrentSession() session: SessionPayload, @Param("mappingId") mappingId: string) {
    return this.service.ok(this.service.removeMapping(session, mappingId), "Subject removed from that arm.");
  }
}
