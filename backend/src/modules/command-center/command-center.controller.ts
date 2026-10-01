import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { CommandCenterService } from "./command-center.service";

@ApiTags("command-center")
@Controller("v1/command-center")
@UseGuards(SessionGuard, PermissionsGuard)
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  /** Everything the Today tab paints, in one call. */
  @Get("today")
  @RequirePermission("command-center.today.view")
  today(@CurrentSession() session: SessionPayload) {
    return this.commandCenterService.ok(this.commandCenterService.today(session));
  }
}
