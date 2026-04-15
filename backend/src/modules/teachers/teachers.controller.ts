import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { TeachersService } from "./teachers.service";

@ApiTags("teachers")
@Controller("v1/teachers")
@UseGuards(SessionGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async list(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.teachersService.listTeachers(session.schoolId)
    };
  }

  @Get("activities")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async listActivities(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.teachersService.listTeacherActivities(session.schoolId)
    };
  }

  @Get(":teacherId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async getProfile(@CurrentSession() session: SessionPayload, @Param("teacherId") teacherId: string) {
    return {
      ok: true,
      data: await this.teachersService.getTeacherProfile(session.schoolId, teacherId)
    };
  }
}
