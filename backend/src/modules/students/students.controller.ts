import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { StudentsService } from "./students.service";

@ApiTags("students")
@Controller("v1/students")
@UseGuards(SessionGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER")
  async list(
    @CurrentSession() session: SessionPayload,
    @Query("className") className?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return {
      ok: true,
      data: await this.studentsService.listStudents(session.schoolId, { className, status, search })
    };
  }

  @Get(":studentId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "EXAM_OFFICER")
  async getProfile(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return {
      ok: true,
      data: await this.studentsService.getStudentProfile(session.schoolId, studentId)
    };
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return {
      ok: true,
      data: await this.studentsService.createStudent(session.schoolId, body)
    };
  }

  @Post(":studentId/behavior-logs")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async createBehaviorLog(
    @CurrentSession() session: SessionPayload,
    @Param("studentId") studentId: string,
    @Body() body: Record<string, unknown>
  ) {
    return {
      ok: true,
      data: await this.studentsService.createBehaviorLog(session.schoolId, studentId, body)
    };
  }

  @Post(":studentId/promotions")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async createPromotion(
    @CurrentSession() session: SessionPayload,
    @Param("studentId") studentId: string,
    @Body() body: Record<string, unknown>
  ) {
    return {
      ok: true,
      data: await this.studentsService.createPromotion(session.schoolId, studentId, body)
    };
  }
}
