import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TriggerRulesService } from "./trigger-rules.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"] as const;
const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-trigger-rules")
@Controller("super-admin/communications/trigger-rules")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class TriggerRulesController {
  constructor(private readonly rules: TriggerRulesService) {}

  @Get()
  list() {
    return ok(this.rules.list());
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  create(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.rules.create(session, body), "Rule created — switched off until someone enables it");
  }

  @Post(":id/enabled")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  setEnabled(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.rules.setEnabled(session, id, body), "Rule updated");
  }

  @Post(":id/test")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  async test(@Param("id") id: string) {
    const result = await this.rules.testFire(id);
    const first = result.examples[0];
    const message = result.total === 0 ? "Test fire — nothing matches today, so nothing would be sent." : `Test fire — ${result.total} would be sent, nothing was. First: ${first.school} → ${first.to}: “${first.subject}”.`;
    return { ok: true, success: true, message, data: result };
  }

  @Post(":id/delete")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  remove(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.rules.remove(session, id, body), "Rule removed");
  }
}
