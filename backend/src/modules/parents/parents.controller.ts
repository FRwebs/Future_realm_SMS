import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ParentsService } from "./parents.service";

@ApiTags("parents")
@Controller("v1/parents")
@UseGuards(SessionGuard, PermissionsGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get()
  @RequirePermission("parents.view")
  async list(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentsService.listParents(session) };
  }
}
