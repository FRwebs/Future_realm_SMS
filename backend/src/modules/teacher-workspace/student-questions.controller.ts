import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TeacherStudentQuestionsService } from "./student-questions.service";

@ApiTags("teacher-workspace")
@Controller("v1/teacher-workspace/student-questions")
@UseGuards(SessionGuard)
export class TeacherStudentQuestionsController {
  constructor(private readonly questions: TeacherStudentQuestionsService) {}

  @Get()
  list(@CurrentSession() session: SessionPayload) {
    return ok(this.questions.list(session));
  }

  @Post(":id/reply")
  @UseGuards(CsrfGuard)
  reply(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.questions.reply(session, id, body));
  }
}
