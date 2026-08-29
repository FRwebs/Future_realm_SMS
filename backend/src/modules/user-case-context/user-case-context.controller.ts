import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { UserCaseContextService } from "./user-case-context.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-user-case-context")
@Controller("super-admin/user-case-review-context")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class UserCaseContextController {
  constructor(private readonly caseContextService: UserCaseContextService) {}

  // Deliberately NOT nested under "super-admin/users/*" — that prefix already has a
  // dynamic "users/:userId" route in SuperAdminController, and Nest/Express resolve
  // routes in controller-registration order (which tracks module-import order in
  // app.module.ts). Since other agents are concurrently editing app.module.ts, relying
  // on import order to keep a static "users/..." segment from being swallowed by
  // ":userId" would be fragile. A sibling top-level path sidesteps that entirely.
  @Get()
  getCaseReviewContext(@CurrentSession() session: SessionPayload) {
    return this.caseContextService.getCaseReviewContext(session);
  }
}
