import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ExamOfficerService } from "./exam-officer.service";

@ApiTags("exam-officer")
@Controller("v1/exam-officer")
@UseGuards(SessionGuard, RolesGuard)
@Roles("EXAM_OFFICER", "EXAMINATION_OFFICER")
export class ExamOfficerController {
  constructor(private readonly examOfficerService: ExamOfficerService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.examOfficerService.getDashboard(session) };
  }

  @Get("exams")
  async exams(
    @CurrentSession() session: SessionPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    return { ok: true, data: await this.examOfficerService.listExams(session, query) };
  }

  @Get("score-entry-status")
  async scoreEntryStatus(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.examOfficerService.scoreEntryStatus(session) };
  }

  @Get("timetable")
  async timetable(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.examOfficerService.listTimetable(session) };
  }

  @Post("timetable")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  async createTimetable(
    @CurrentSession() session: SessionPayload,
    @Body() body: unknown,
  ) {
    return { ok: true, data: await this.examOfficerService.createTimetableEntry(session, body) };
  }

  @Patch("timetable/:timetableId")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  async updateTimetable(
    @CurrentSession() session: SessionPayload,
    @Param("timetableId") timetableId: string,
    @Body() body: unknown,
  ) {
    return { ok: true, data: await this.examOfficerService.updateTimetableEntry(session, timetableId, body) };
  }

  @Delete("timetable/:timetableId")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  async deleteTimetable(
    @CurrentSession() session: SessionPayload,
    @Param("timetableId") timetableId: string,
  ) {
    return { ok: true, data: await this.examOfficerService.deleteTimetableEntry(session, timetableId) };
  }

  @Get("publications")
  async publications(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.examOfficerService.listPublicationStatus(session) };
  }

  @Get("question-bank")
  async questionBank(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.examOfficerService.listQuestionBank(session) };
  }
}
