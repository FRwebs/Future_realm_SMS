import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ParentWorkspaceService } from "./parent-workspace.service";

/**
 * A parent's own workspace, read one family at a time.
 *
 * Separate from the older `parent-portal` controller because these are the
 * reads the rebuilt portal makes: shaped around the family and the child
 * switcher rather than around a single child's page.
 */
@ApiTags("parent-portal")
@Controller("v1/parent-portal/ws")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PARENT")
export class ParentWorkspaceController {
  constructor(private readonly workspace: ParentWorkspaceService) {}

  @Get("me")
  async me(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.me(session) };
  }

  /** What to say under each child's name in the top bar, page by page. */
  @Get("switcher")
  async switcher(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.switcher(session) };
  }

  /** What the family owes and has paid. `child` is a child's id, or "all". */
  @Get("fees")
  async fees(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.fees(session, child?.trim() || "all") };
  }

  /** What the family has to act on. `child` is a child's id, or "all". */
  @Get("needs")
  async needs(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.needs(session, child?.trim() || "all") };
  }
}
