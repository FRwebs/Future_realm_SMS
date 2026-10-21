import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
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

  @Get("contact-quality")
  contactQuality(@CurrentSession() session: SessionPayload) {
    return this.caseContextService.contactQuality(session);
  }

  @Get("repair-queue")
  repairQueue(@CurrentSession() session: SessionPayload) {
    return this.caseContextService.repairQueue(session).then((data) => ({ ok: true, data }));
  }

  @Post("contact-quality/route")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  routeMany(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.caseContextService.routeMany(session, body).then((data) => ({ ok: true, data }));
  }

  @Get("contact-quality/export")
  async exportContacts(@CurrentSession() session: SessionPayload, @Query("schoolIds") schoolIds: string, @Res() response: Response) {
    const csv = await this.caseContextService.exportContacts(session, (schoolIds ?? "").split(",").filter(Boolean));
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="unreachable-guardians.csv"');
    response.send(csv);
  }

  @Post("contact-quality/:schoolId/notify")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  askSchoolToFix(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string) {
    return this.caseContextService.askSchoolToFix(session, schoolId);
  }

  @Post("contacts")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  recordContact(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.caseContextService.recordContact(session, body);
  }
}
