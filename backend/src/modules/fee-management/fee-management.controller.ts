import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { CollectionsService } from "./collections.service";
import { HistoryService } from "./history.service";
import { ReviewService } from "./review.service";
import { StructuresService } from "./structures.service";

/**
 * Fee Management: what is owed, what came in, who still owes. Literal paths come before
 * parameters so `:id` never swallows a word.
 */
@ApiTags("fee-management")
@Controller("v1/fee-management")
@UseGuards(SessionGuard, PermissionsGuard)
export class FeeManagementController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly structures: StructuresService,
    private readonly review: ReviewService,
    private readonly history: HistoryService
  ) {}

  /* collections */

  @Get("collections")
  @RequirePermission("fee-management.collections.view")
  collectionsOverview(@CurrentSession() session: SessionPayload) {
    return this.collections.ok(this.collections.overview(session));
  }

  @Get("collections/form-class")
  @RequirePermission("fee-management.collections.view")
  formClass(@CurrentSession() session: SessionPayload) {
    return this.collections.ok(this.collections.formClass(session));
  }

  @Post("payments")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.create")
  recordPayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.recordPayment(session, body), "Payment recorded.");
  }

  @Get("payments/:id/receipt")
  @RequirePermission("fee-management.collections.view")
  receipt(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.collections.ok(this.collections.receipt(session, id));
  }

  @Post("reminders")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.create")
  remind(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.remind(session, body), "Reminders sent.");
  }

  @Post("meetings")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.create")
  meetings(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.meetingMany(session, body), "Meetings requested.");
  }

  @Get("families/:id")
  @RequirePermission("fee-management.collections.view")
  family(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.collections.ok(this.collections.family(session, id));
  }

  @Post("families/:id/meeting")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.create")
  meeting(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.meeting(session, id, body), "Meeting requested.");
  }

  @Post("families/:id/plan")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.create")
  plan(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.plan(session, id, body), "Payment plan agreed.");
  }

  @Post("families/:id/adjust")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.edit")
  adjust(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.adjust(session, id, body), "Adjustment recorded.");
  }

  @Post("families/:id/write-off")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.collections.approve")
  writeOff(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.collections.ok(this.collections.writeOff(session, id, body), "Balance written off.");
  }

  /* structures */

  @Get("structures")
  @RequirePermission("fee-management.structures.view")
  structuresOverview(@CurrentSession() session: SessionPayload) {
    return this.structures.ok(this.structures.overview(session));
  }

  @Get("structures/options")
  @RequirePermission("fee-management.structures.view")
  structureOptions(@CurrentSession() session: SessionPayload) {
    return this.structures.ok(this.structures.options(session));
  }

  @Post("structures")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.create")
  createStructure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.create(session, body), "Structure created.");
  }

  @Post("structures/duplicate")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.create")
  duplicateStructure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.duplicate(session, body), "Structure duplicated.");
  }

  @Post("structures/raise")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.edit")
  raiseFees(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.raise(session, body), "Increase applied.");
  }

  @Post("structures/rules")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.create")
  addRule(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.saveRule(session, null, body), "Adjustment rule added.");
  }

  @Put("structures/rules/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.edit")
  saveRule(@CurrentSession() session: SessionPayload, @Param("code") code: string, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.saveRule(session, code, body), "Adjustment rule saved.");
  }

  @Delete("structures/rules/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.delete")
  removeRule(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return this.structures.ok(this.structures.removeRule(session, code), "Adjustment rule removed.");
  }

  @Get("structures/:id")
  @RequirePermission("fee-management.structures.view")
  structure(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.structures.ok(this.structures.detail(session, id));
  }

  @Get("structures/:id/preview")
  @RequirePermission("fee-management.structures.view")
  previewPublish(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.structures.ok(this.structures.preview(session, id));
  }

  @Put("structures/:id/items")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.edit")
  saveItems(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.saveItems(session, id, body), "Fee items saved.");
  }

  @Post("structures/:id/levels")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.edit")
  mapLevels(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.mapLevels(session, id, body), "Classes mapped.");
  }

  @Post("structures/:id/levels/:levelId/unmap")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.edit")
  unmapLevel(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("levelId") levelId: string) {
    return this.structures.ok(this.structures.unmapLevel(session, id, levelId), "Class unmapped.");
  }

  @Post("structures/:id/publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.approve")
  publishStructure(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.publish(session, id, body), "Structure published.");
  }

  @Post("structures/:id/delete")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.structures.delete")
  deleteStructure(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.structures.ok(this.structures.remove(session, id, body), "Structure deleted.");
  }

  /* review */

  @Get("review")
  @RequirePermission("fee-management.review.view")
  reviewOverview(@CurrentSession() session: SessionPayload) {
    return this.review.ok(this.review.overview(session));
  }

  @Post("review/apply-unapplied")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.review.edit")
  applyUnapplied(@CurrentSession() session: SessionPayload) {
    return this.review.ok(this.review.applyUnapplied(session), "Payments applied.");
  }

  @Post("review/cash-up/:day/count")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.review.create")
  countDay(@CurrentSession() session: SessionPayload, @Param("day") day: string, @Body() body: Record<string, unknown>) {
    return this.review.ok(this.review.count(session, day, body), "Cash counted.");
  }

  @Post("review/cash-up/:day/close")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.review.approve")
  closeDay(@CurrentSession() session: SessionPayload, @Param("day") day: string, @Body() body: Record<string, unknown>) {
    return this.review.ok(this.review.close(session, day, body), "Day closed.");
  }

  @Post("review/waivers/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("fee-management.review.approve")
  decideWaiver(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.review.ok(this.review.decideWaiver(session, id, body), "Decision recorded.");
  }

  /* history */

  @Get("history")
  @RequirePermission("fee-management.history.view")
  historyOverview(@CurrentSession() session: SessionPayload) {
    return this.history.ok(this.history.overview(session));
  }

  @Get("history/statement")
  @RequirePermission("fee-management.history.export")
  statement(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string>) {
    return this.history.ok(this.history.statement(session, query));
  }
}
