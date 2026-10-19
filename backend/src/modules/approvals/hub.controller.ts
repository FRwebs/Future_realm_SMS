import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { HubService } from "./hub.service";

/**
 * Approvals & Workflow: every decision waiting on anyone, read where it lives and decided where it is held.
 */
@ApiTags("approvals")
@Controller("v1/approvals-hub")
@UseGuards(SessionGuard, PermissionsGuard)
export class HubController {
  constructor(private readonly hub: HubService) {}

  @Get("queue")
  @RequirePermission("approvals-workflow.queue.view")
  queue(@CurrentSession() session: SessionPayload, @Query() query: { scope?: string; type?: string; state?: string }) {
    return ok(this.hub.overview(session, query));
  }

  @Get("count")
  @RequirePermission("approvals-workflow.queue.view")
  count(@CurrentSession() session: SessionPayload) {
    return ok(this.hub.count(session));
  }

  @Get("item/:key")
  @RequirePermission("approvals-workflow.queue.view")
  item(@CurrentSession() session: SessionPayload, @Param("key") key: string) {
    return ok(this.hub.item(session, key));
  }

  @Post("item/:key/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.queue.approve")
  decide(@CurrentSession() session: SessionPayload, @Param("key") key: string, @Body() body: unknown) {
    return ok(this.hub.decide(session, key, body), "Decision recorded.");
  }

  @Post("item/:key/messages")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.queue.view")
  message(@CurrentSession() session: SessionPayload, @Param("key") key: string, @Body() body: unknown) {
    return ok(this.hub.message(session, key, body), "Message sent.");
  }

  @Post("bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.queue.approve")
  bulk(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.hub.bulk(session, body), "Decisions recorded.");
  }

  @Get("performance")
  @RequirePermission("approvals-workflow.performance.view")
  performance(@CurrentSession() session: SessionPayload) {
    return ok(this.hub.performance(session));
  }

  @Get("workflow")
  @RequirePermission("approvals-workflow.workflow.view")
  workflow(@CurrentSession() session: SessionPayload) {
    return ok(this.hub.workflow(session));
  }

  @Get("routes/:type")
  @RequirePermission("approvals-workflow.workflow.view")
  route(@CurrentSession() session: SessionPayload, @Param("type") type: string) {
    return ok(this.hub.route(session, type));
  }

  @Post("routes")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.create")
  createRoute(@CurrentSession() session: SessionPayload, @Body() body: { type?: string } & Record<string, unknown>) {
    return ok(this.hub.saveRoute(session, String(body.type ?? ""), body), "Route saved.");
  }

  @Post("routes/bulk")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.edit")
  bulkRoutes(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.hub.bulkRoutes(session, body), "Routes changed.");
  }

  @Put("routes/:type")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.edit")
  saveRoute(@CurrentSession() session: SessionPayload, @Param("type") type: string, @Body() body: unknown) {
    return ok(this.hub.saveRoute(session, type, body), "Route saved.");
  }

  @Delete("routes/:type")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.edit")
  resetRoute(@CurrentSession() session: SessionPayload, @Param("type") type: string) {
    return ok(this.hub.resetRoute(session, type), "Route reset.");
  }

  @Post("rules")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.create")
  createRule(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.hub.createRule(session, body), "Rule created.");
  }

  @Post("rules/:code/revoke")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.edit")
  revoke(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return ok(this.hub.setRuleState(session, code, "Revoked"), "Rule revoked.");
  }

  @Post("rules/:code/reinstate")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.workflow.edit")
  reinstate(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return ok(this.hub.setRuleState(session, code, "Active"), "Rule reinstated.");
  }
}
