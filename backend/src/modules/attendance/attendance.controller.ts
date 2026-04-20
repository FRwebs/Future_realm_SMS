import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AttendanceService } from "./attendance.service";

@ApiTags("attendance")
@Controller("v1/attendance")
@UseGuards(SessionGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("summary")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async summary(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return {
      ok: true,
      data: await this.attendanceService.summarizeAttendance(session.schoolId, query)
    };
  }

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async list(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return {
      ok: true,
      data: await this.attendanceService.listAttendance(session.schoolId, query)
    };
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return {
      ok: true,
      data: await this.attendanceService.recordAttendance(session.schoolId, session.userId, body)
    };
  }
}
