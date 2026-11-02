import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
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

  /** Every mark the school has made. `child` is a child's id, or "all". */
  @Get("attendance")
  async attendance(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.attendance(session, child?.trim() || "all") };
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

  /** What is coming for this family, from every source. `child` is a child's id, or "all". */
  @Get("calendar")
  async calendar(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.calendar(session, child?.trim() || "all") };
  }

  /** The family's private calendar-feed address, made on first ask. */
  @Get("calendar-link")
  async calendarLink(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.calendarLink(session) };
  }

  /** Replace the address, so the old one stops working. */
  @Post("calendar-link/reset")
  async resetCalendarLink(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.calendarLink(session, true) };
  }

  /** Meetings with the school, and what was agreed. */
  @Get("meetings")
  async meetings(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.meetings(session, child?.trim() || "all") };
  }

  @Post("meetings/:id/respond")
  async respondMeeting(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.respondMeeting(session, id, body) };
  }

  /** Every message the school has sent this family, tagged with the children it concerns. */
  @Get("messages")
  async messages(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.messages(session, child?.trim() || "all") };
  }

  /** The forms the school has sent this family, and what they have answered. */
  @Get("forms")
  async forms(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.forms(session) };
  }

  @Post("forms/:id/answer")
  async answerForm(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.answerForm(session, id, body) };
  }

  /** Every consent the school holds from this family. */
  @Get("consents")
  async consents(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.consents(session) };
  }

  /** Give, decline or withdraw one consent. */
  @Post("consents")
  async setConsent(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.setConsent(session, body) };
  }

  /** Everything this family has sent the school. `child` is a child's id, or "all". */
  @Get("requests")
  async requests(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.requests(session, child?.trim() || "all") };
  }

  @Post("requests/:id/withdraw")
  async withdrawRequest(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.workspace.withdrawRequest(session, id) };
  }

  /** Each child's published report cards and what has been released since. `child` is a child's id, or "all". */
  @Get("results")
  async results(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.results(session, child?.trim() || "all") };
  }

  /** Each child's timetable, this week's topics and the tests ahead. `child` is a child's id, or "all". */
  @Get("learning")
  async learning(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.learning(session, child?.trim() || "all") };
  }

  /** What each school holds about each child. `child` is a child's id, or "all". */
  @Get("profile")
  async profile(@CurrentSession() session: SessionPayload, @Query("child") child?: string) {
    return { ok: true, data: await this.workspace.profile(session, child?.trim() || "all") };
  }

  /** The file a family attached to a child's document. */
  @Get("profile/documents/:id/file")
  async documentFile(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Res() response: Response) {
    const file = await this.workspace.documentFile(session, id);
    response.setHeader("Content-Type", file.mime);
    response.setHeader("Content-Disposition", `inline; filename="${file.name.replace(/[^\w.\- ]/g, "_")}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.send(file.bytes);
  }

  /** A request to correct what the school holds, or to add a person to those who may collect. */
  @Post("profile/requests")
  async requestChange(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.requestChange(session, body) };
  }

  /** A document the family adds to a child's record; it shows as being checked until the school has seen it. */
  @Post("profile/documents")
  async addDocument(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.addDocument(session, body) };
  }

  /** Who this parent is on the school's books. */
  @Get("account")
  async account(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.account(session) };
  }

  @Get("security")
  async security(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.security(session) };
  }

  /** The devices this account is signed in on. */
  @Get("sessions")
  async sessions(@CurrentSession() session: SessionPayload, @Req() request: Request & { sessionTokenHash?: string }) {
    return { ok: true, data: await this.workspace.sessions(session, request.sessionTokenHash) };
  }

  @Post("sessions/:id/revoke")
  async revokeSession(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Req() request: Request & { sessionTokenHash?: string }) {
    return { ok: true, data: await this.workspace.revokeSession(session, id, request.sessionTokenHash) };
  }

  /** A request to change contact details, or for a copy of what the school holds. */
  @Post("account/requests")
  async requestAccount(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.requestAccount(session, body) };
  }

  /** Which kinds of school message reach this parent, and when they would rather not be disturbed. */
  @Get("prefs")
  async prefs(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.notifications(session) };
  }

  @Put("prefs")
  async savePrefs(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.saveNotifications(session, body) };
  }
}

/** The feed a phone's calendar reads. There is no sign-in: the address itself is the secret, and the parent can replace it. */
@ApiTags("parent-portal")
@Controller("v1/parent-calendar")
export class ParentCalendarFeedController {
  constructor(private readonly workspace: ParentWorkspaceService) {}

  @Get(":file")
  async feed(@Param("file") file: string, @Res() response: Response) {
    const text = await this.workspace.calendarFeed(file.replace(/\.ics$/, ""));
    response.setHeader("Content-Type", "text/calendar; charset=utf-8");
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(text);
  }
}
