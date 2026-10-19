import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { SyncReplayService } from "./replay.service";
import { SyncService } from "./sync.service";

@ApiTags("sync")
@Controller("v1/sync")
@UseGuards(SessionGuard, PermissionsGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService, private readonly replay: SyncReplayService) {}

  @Get("overview")
  @RequirePermission("sync-support.sync.view")
  overview(@CurrentSession() session: SessionPayload) {
    return this.syncService.ok(this.syncService.overview(session));
  }

  @Get("drafts")
  @RequirePermission("sync-support.sync.view")
  drafts(@CurrentSession() session: SessionPayload) {
    return this.syncService.ok(this.syncService.drafts(session));
  }

  /** Work captured with no connection, arriving. Each entry is judged by the module that owns the record. */
  @Post("replay")
  @UseGuards(SessionGuard, CsrfGuard)
  replayDrafts(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.replay.replay(session, body));
  }

  @Post("conflicts/:id/resolve")
  @UseGuards(SessionGuard, CsrfGuard)
  resolve(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.replay.resolve(session, id, body), "Conflict resolved.");
  }
}
