import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TeacherStudentWorkService } from "./student-work.service";

@ApiTags("teacher-workspace")
@Controller("v1/teacher-workspace/student-work")
@UseGuards(SessionGuard)
export class TeacherStudentWorkController {
  constructor(private readonly work: TeacherStudentWorkService) {}

  @Get()
  overview(@CurrentSession() session: SessionPayload) {
    return ok(this.work.overview(session));
  }

  @Post("homework")
  @UseGuards(CsrfGuard)
  set(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.work.setHomework(session, body));
  }

  @Post("submissions/:id/mark")
  @UseGuards(CsrfGuard)
  mark(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.work.mark(session, id, body));
  }
}
