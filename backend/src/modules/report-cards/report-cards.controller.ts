import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { OutputsService } from "../attendance-management/outputs.service";
import { ok } from "../student-records/records.shared";
import { ArchiveService } from "./archive.service";
import { CardService } from "./card.service";
import { CompletionService } from "./completion.service";
import { RemarksService } from "./remarks.service";

/** Report Cards: what has been written, which arms can go out, and everything that ever has. Literal paths come first. */
@ApiTags("report-cards")
@Controller("v1/report-cards")
@UseGuards(SessionGuard, PermissionsGuard)
export class ReportCardsController {
  constructor(
    private readonly remarks: RemarksService,
    private readonly completion: CompletionService,
    private readonly archive: ArchiveService,
    private readonly card: CardService,
    private readonly outputs: OutputsService
  ) {}

  /* remarks */

  @Get("remarks")
  @RequirePermission("report-cards.remarks.view")
  remarksOverview(@CurrentSession() session: SessionPayload, @Query() query: { level?: string; arm?: string }) {
    return ok(this.remarks.overview(session, query));
  }

  @Post("remarks")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.remarks.create")
  saveRemark(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.remarks.save(session, body), "Remark saved.");
  }

  @Post("remarks/band")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.remarks.approve")
  applyBand(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.remarks.applyBand(session, body), "Band review applied.");
  }

  @Post("notify")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.remarks.create")
  notify(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.outputs.notify(session, body), "Notification sent.");
  }

  @Get("remarks/:classId/:studentId")
  @RequirePermission("report-cards.remarks.view")
  remarkPage(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("studentId") studentId: string) {
    return ok(this.remarks.student(session, classId, studentId));
  }

  /* completion */

  @Get("completion")
  @RequirePermission("report-cards.completion.view")
  completionOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.completion.overview(session));
  }

  @Post("publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.approve")
  publish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.completion.publish(session, body), "Cards published.");
  }

  @Post("unpublish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.approve")
  unpublish(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.completion.unpublish(session, body), "Publish taken back.");
  }

  @Post("withhold")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.approve")
  withhold(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.completion.withhold(session, body), "Card withheld.");
  }

  @Post("release/:studentId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.approve")
  release(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return ok(this.completion.release(session, studentId), "Card released.");
  }

  @Post("print")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.export")
  printRecord(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.completion.printRecord(session, body), "Print run recorded.");
  }

  @Get("print")
  @RequirePermission("report-cards.completion.export")
  printSet(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | string[] | undefined>) {
    return ok(this.completion.printSet(session, query));
  }

  @Post("send")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.completion.edit")
  send(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.completion.send(session, body), "Cards sent.");
  }

  @Get("completion/:classId")
  @RequirePermission("report-cards.completion.view")
  armPage(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.completion.arm(session, classId));
  }

  /* the card, and the archive */

  @Get("card/:studentId")
  @RequirePermission("report-cards.completion.view")
  cardView(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string, @Query("term") term?: string) {
    return ok(this.card.view(session, studentId, term));
  }

  @Get("archive")
  @RequirePermission("report-cards.archive.view")
  archiveOverview(@CurrentSession() session: SessionPayload, @Query() query: { term?: string; arm?: string }) {
    return ok(this.archive.overview(session, query));
  }

  @Post("archive/reissue")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("report-cards.archive.edit")
  reissue(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.archive.reissue(session, body), "Card reissued.");
  }
}
