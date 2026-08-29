import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { OwnershipTransferService } from "./ownership-transfer.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-ownership-transfer")
@Controller("super-admin/ownership-transfers")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class OwnershipTransferController {
  constructor(private readonly transferService: OwnershipTransferService) {}

  @Get()
  listTransfers(@CurrentSession() session: SessionPayload) {
    return this.transferService.listTransfers(session);
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  initiate(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.transferService.initiate(session, body);
  }

  @Post(":id/incoming-owner")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  setIncomingOwner(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.transferService.setIncomingOwner(session, id, body);
  }

  @Post(":id/send-notice")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  sendNotice(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.transferService.sendNotice(session, id);
  }

  @Post(":id/objection")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  raiseObjection(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return this.transferService.raiseObjection(session, id, body);
  }

  @Post(":id/approve")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  approve(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.transferService.approve(session, id);
  }

  @Post(":id/execute")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...readRoles)
  execute(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.transferService.execute(session, id);
  }
}
