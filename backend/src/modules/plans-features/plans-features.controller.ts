import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { PlansFeaturesService } from "./plans-features.service";

const readRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const technicalRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"] as const;
const planRoles = ["PLATFORM_OWNER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin-plans-features")
@Controller("super-admin/plans-features")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...readRoles)
export class PlansFeaturesController {
  constructor(private readonly service: PlansFeaturesService) {}

  @Get("flags")
  flags() {
    return ok(this.service.listFlags());
  }

  @Get("stage-history")
  history() {
    return ok(this.service.stageHistory());
  }

  @Get("matrix")
  matrix() {
    return ok(this.service.matrix());
  }

  @Get("plans")
  plans() {
    return ok(this.service.plansOverview());
  }

  @Post("flags")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...technicalRoles)
  createFlag(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.createFlag(session, body), "Feature flag created");
  }

  @Patch("flags/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...technicalRoles)
  editFlag(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.service.editFlag(session, id, body), "Flag updated");
  }

  @Post("flags/:id/advance")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...technicalRoles)
  advance(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.service.advanceFlag(session, id, body), "Rollout updated");
  }

  @Post("flags/:id/rollback")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...technicalRoles)
  rollback(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.service.rollbackFlag(session, id, body), "Feature disabled platform-wide");
  }

  @Post("matrix")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...technicalRoles)
  saveFeature(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.saveFeature(session, body), "Tier-feature matrix updated");
  }

  @Post("plans/:id/lifecycle")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...planRoles)
  lifecycle(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.service.setLifecycle(session, id, body), "Plan lifecycle updated");
  }

  @Post("plans/:id/price")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...planRoles)
  price(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return ok(this.service.schedulePrice(session, id, body), "Price change scheduled");
  }

  @Post("price-changes/:id/cancel")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...planRoles)
  cancelPrice(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.service.cancelPrice(session, id), "Price change cancelled");
  }
}

/** What the signed-in school may use — read by the school's own app. */
@ApiTags("entitlements")
@Controller("v1/entitlements")
@UseGuards(SessionGuard)
export class EntitlementsController {
  constructor(private readonly service: PlansFeaturesService) {}

  @Get()
  mine(@CurrentSession() session: SessionPayload) {
    return ok(this.service.forSchool(session.schoolId));
  }
}
