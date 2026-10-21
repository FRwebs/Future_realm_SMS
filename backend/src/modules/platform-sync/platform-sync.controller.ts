import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { PlatformSyncService } from "./platform-sync.service";

@ApiTags("platform-sync")
@Controller("v1/platform-sync")
@UseGuards(SessionGuard)
export class PlatformSyncController {
  constructor(private readonly service: PlatformSyncService) {}

  /** What the Back Office has decided that this school's app must show and obey. Open to every signed-in member of the school. */
  @Get()
  current(@CurrentSession() session: SessionPayload) {
    return ok(this.service.forSchool(session));
  }

  @Post("announcements/:id/dismiss")
  @UseGuards(CsrfGuard)
  dismiss(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.service.dismiss(session, id));
  }
}
