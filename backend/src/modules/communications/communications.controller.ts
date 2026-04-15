import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { CommunicationsService } from "./communications.service";

@ApiTags("communications")
@Controller("v1/communications")
@UseGuards(SessionGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get("announcements")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT")
  async list(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.communicationsService.listAnnouncements(session.schoolId)
    };
  }

  @Post("announcements")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER")
  async create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return {
      ok: true,
      data: await this.communicationsService.createAnnouncement(session.schoolId, session.userId, body)
    };
  }
}
