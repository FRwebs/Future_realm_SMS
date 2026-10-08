import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { SyncService } from "./sync.service";

@ApiTags("sync")
@Controller("v1/sync")
@UseGuards(SessionGuard, PermissionsGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get("drafts")
  @RequirePermission("sync-support.sync.view")
  drafts(@CurrentSession() session: SessionPayload) {
    return this.syncService.ok(this.syncService.drafts(session));
  }
}
