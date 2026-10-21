import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { InvitationOpsService } from "./invitation-ops.service";

const roles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-invitations")
@Controller("super-admin/migration/invitations")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...roles)
export class InvitationOpsController {
  constructor(private readonly ops: InvitationOpsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return ok(this.ops.list(query));
  }

  @Post("resend")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...roles)
  resend(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.ops.resend(session, body), "Invitations resent");
  }

  @Post("correct")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...roles)
  correct(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.ops.correctAndResend(session, body), "Address corrected and link sent");
  }

  @Post("delivered")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...roles)
  delivered(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.ops.markDelivered(session, body), "Marked as delivered");
  }

  @Post("cancel")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...roles)
  cancel(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.ops.cancel(session, body), "Invitations cancelled");
  }
}
