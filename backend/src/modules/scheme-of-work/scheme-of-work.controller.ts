import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { SchemeOfWorkService } from "./scheme-of-work.service";

@ApiTags("scheme-of-work")
@Controller("v1/scheme-of-work")
@UseGuards(SessionGuard, PermissionsGuard)
export class SchemeOfWorkController {
  constructor(private readonly schemeOfWorkService: SchemeOfWorkService) {}

  @Get()
  @RequirePermission("sow.view_all")
  list(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.list(session, query));
  }

  @Get("my")
  @RequirePermission("sow.view_own")
  mine(@CurrentSession() session: SessionPayload) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.listMy(session));
  }

  @Get(":sowId")
  @RequirePermission("sow.view")
  detail(@CurrentSession() session: SessionPayload, @Param("sowId") sowId: string) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.get(session, sowId));
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sow.create")
  create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.create(session, body), "Scheme of work initialized.");
  }

  @Patch(":sowId/topics/:topicId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sow.edit")
  updateTopic(
    @CurrentSession() session: SessionPayload,
    @Param("sowId") sowId: string,
    @Param("topicId") topicId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.updateTopic(session, sowId, topicId, body), "Scheme topic updated.");
  }

  @Patch(":sowId/topics/:topicId/cover")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sow.mark_covered")
  coverTopic(
    @CurrentSession() session: SessionPayload,
    @Param("sowId") sowId: string,
    @Param("topicId") topicId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.markCovered(session, sowId, topicId, body));
  }

  @Patch(":sowId/submit")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sow.submit")
  submit(@CurrentSession() session: SessionPayload, @Param("sowId") sowId: string) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.submit(session, sowId));
  }

  @Patch(":sowId/approve")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("sow.approve")
  approve(
    @CurrentSession() session: SessionPayload,
    @Param("sowId") sowId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.schemeOfWorkService.ok(this.schemeOfWorkService.approve(session, sowId, body));
  }
}
