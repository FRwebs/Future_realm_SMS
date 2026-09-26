import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ApprovalsService } from "./approvals.service";

@ApiTags("approvals")
@Controller("v1/approvals")
@UseGuards(SessionGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * The queue. `?assignee=me` is what the Command Center's "My actions" reads;
   * without it, everything in flight across the school.
   */
  @Get("queue")
  @RequirePermission("approvals-workflow.queue.view")
  queue(
    @CurrentSession() session: SessionPayload,
    @Query() query: { assignee?: string; status?: string; kind?: string; take?: string },
  ) {
    return this.approvalsService.ok(this.approvalsService.listQueue(session, query));
  }

  /** The sidebar badge, without paying for the rows behind it. */
  @Get("queue/count")
  @RequirePermission("approvals-workflow.queue.view")
  count(@CurrentSession() session: SessionPayload) {
    return this.approvalsService.ok(this.approvalsService.countWaitingOnMe(session));
  }

  @Get(":id")
  @RequirePermission("approvals-workflow.queue.view")
  getOne(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.approvalsService.ok(this.approvalsService.getOne(session, id));
  }

  /** Raised by whichever service needs a decision, not usually by a person. */
  @Post()
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.queue.create")
  raise(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.approvalsService.ok(this.approvalsService.raise(session, body), "Decision raised.");
  }

  @Patch(":id/decision")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("approvals-workflow.queue.approve")
  decide(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.approvalsService.ok(this.approvalsService.decide(session, id, body), "Decision recorded.");
  }
}
