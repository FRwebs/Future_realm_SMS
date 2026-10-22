import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { FamilyInboxService } from "./family-inbox.service";
import { ParentPortalService } from "./parent-portal.service";

@ApiTags("parent-portal")
@Controller("v1/parent-portal")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PARENT")
export class ParentPortalController {
  constructor(private readonly parentPortalService: ParentPortalService, private readonly inbox: FamilyInboxService) {}

  @Get("dashboard")
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentDashboard(session) };
  }

  @Get("children")
  async children(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.listLinkedChildren(session) };
  }

  @Get("children/:studentId")
  async childOverview(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildOverviewForParent(session, studentId) };
  }

  @Get("children/:studentId/attendance")
  async childAttendance(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildAttendanceForParent(session, studentId) };
  }

  @Get("children/:studentId/results")
  async childResults(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildResultsForParent(session, studentId) };
  }

  @Get("children/:studentId/fees")
  async childFees(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildFeesForParent(session, studentId) };
  }

  @Get("children/:studentId/timetable")
  async childTimetable(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildTimetableForParent(session, studentId) };
  }

  @Get("children/:studentId/subjects")
  async childSubjects(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return { ok: true, data: await this.parentPortalService.getChildSubjectsForParent(session, studentId) };
  }

  @Get("children/:studentId/subjects/:subjectId/scheme-of-work")
  async childSubjectSchemeOfWork(
    @CurrentSession() session: SessionPayload,
    @Param("studentId") studentId: string,
    @Param("subjectId") subjectId: string
  ) {
    return { ok: true, data: await this.parentPortalService.getChildSubjectSchemeOfWorkForParent(session, studentId, subjectId) };
  }

  @Get("announcements")
  async announcements(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentAnnouncements(session) };
  }

  @Get("notifications")
  async notifications(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentNotifications(session) };
  }

  @Get("profile")
  async profile(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.parentPortalService.getParentProfile(session) };
  }

  /** What the school has sent this family, newest first, with what has been read, acknowledged and answered. */
  @Get("messages")
  async messages(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.inbox.messages(session) };
  }

  @Post("messages/:id/read")
  @UseGuards(CsrfGuard)
  async readMessage(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.inbox.read(session, id) };
  }

  @Post("messages/:id/acknowledge")
  @UseGuards(CsrfGuard)
  async acknowledgeMessage(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.inbox.acknowledge(session, id), message: "Thank you — the school can see you have read it." };
  }

  @Post("messages/:id/reply")
  @UseGuards(CsrfGuard)
  async replyToMessage(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.inbox.reply(session, id, body), message: "Your reply has gone to the school office." };
  }

  /** What this family has sent the school, and where each stands. */
  @Get("submissions")
  async submissions(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.inbox.submissions(session) };
  }

  @Get("submissions/options")
  async submissionOptions(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.inbox.options(session) };
  }

  @Post("submissions")
  @UseGuards(CsrfGuard)
  async submit(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.inbox.submit(session, body), message: "Sent. The school has it and a person now owns it." };
  }
}
