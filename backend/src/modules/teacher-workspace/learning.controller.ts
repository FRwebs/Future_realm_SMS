import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Put, Delete, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { LearningService } from "./learning.service";

/** Anyone may check a certificate against its code — and is told only what a verifier needs. */
@ApiTags("learning")
@Controller("v1/learning")
export class LearningPublicController {
  constructor(private readonly learning: LearningService) {}

  @Get("verify/:code")
  verify(@Param("code") code: string) {
    return ok(this.learning.verify(code));
  }
}

/**
 * Courses that belong to no one school.
 *
 * The platform's own, and an accredited body's offered through it. They are written here and
 * every school is given them, which is why only the platform team may touch them.
 */
@ApiTags("learning")
@Controller("v1/learning/platform")
@UseGuards(SessionGuard)
export class LearningPlatformController {
  constructor(private readonly learning: LearningService) {}

  @Get("courses")
  courses(@CurrentSession() session: SessionPayload) {
    return ok(this.learning.platformCourses(session));
  }

  @Post("courses")
  @UseGuards(CsrfGuard)
  create(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.learning.createPlatformCourse(session, body));
  }

  @Post("courses/:id/:state")
  @UseGuards(CsrfGuard)
  setState(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("state") state: string) {
    const known = ["publish", "archive", "restore"] as const;
    const chosen = known.find((candidate) => candidate === state);
    if (!chosen) throw new BadRequestException("A course is published, archived or restored.");
    return ok(this.learning.setPlatformCourseState(session, id, chosen));
  }
}

/** What a school manages: its courses, what staff have filed from elsewhere, and what they have asked to learn. */
@ApiTags("learning")
@Controller("v1/learning/manage")
@UseGuards(SessionGuard, PermissionsGuard)
export class LearningManageController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  @RequirePermission("staff-access.learning.view")
  overview(@CurrentSession() session: SessionPayload) {
    return ok(this.learning.manage(session));
  }

  @Get("courses/:id")
  @RequirePermission("staff-access.learning.view")
  course(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.learning.manageCourse(session, id));
  }

  @Post("courses")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.create")
  create(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.learning.createCourse(session, body));
  }

  @Put("courses/:id")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.edit")
  update(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.learning.updateCourse(session, id, body));
  }

  @Post("courses/:id/lessons")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.edit")
  addLesson(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.learning.saveLesson(session, id, null, body));
  }

  @Put("courses/:id/lessons/:position")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.edit")
  editLesson(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("position", ParseIntPipe) position: number, @Body() body: unknown) {
    return ok(this.learning.saveLesson(session, id, position, body));
  }

  @Delete("courses/:id/lessons/:position")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.edit")
  removeLesson(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("position", ParseIntPipe) position: number) {
    return ok(this.learning.removeLesson(session, id, position));
  }

  @Post("courses/:id/state")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.approve")
  state(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: { state?: string }) {
    const state = body?.state === "archive" ? "archive" : body?.state === "restore" ? "restore" : "publish";
    return ok(this.learning.setPublished(session, id, state));
  }

  @Post("funding/:id/decide")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.approve")
  decideFunding(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.learning.decideFunding(session, id, body), "Decision recorded");
  }

  @Post("certificates/:id/decide")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.approve")
  decide(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.learning.decideCertificate(session, id, body));
  }

  @Post("policy")
  @UseGuards(CsrfGuard)
  @RequirePermission("staff-access.learning.edit")
  policy(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.learning.setPolicy(session, body));
  }
}
