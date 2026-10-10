import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { SupportService } from "./support.service";

@ApiTags("support")
@Controller("v1/support")
@UseGuards(SessionGuard, PermissionsGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get("tickets")
  @RequirePermission("sync-support.help-support.view")
  tickets(@CurrentSession() session: SessionPayload) {
    return this.supportService.ok(this.supportService.tickets(session));
  }

  @Post("tickets")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sync-support.help-support.create")
  raise(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.supportService.ok(this.supportService.raise(session, body), "Ticket raised.");
  }

  @Post("tickets/:ticketId/reply")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sync-support.help-support.create")
  reply(
    @CurrentSession() session: SessionPayload,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.supportService.ok(this.supportService.reply(session, ticketId, body), "Reply sent.");
  }
}
