import { Body, Controller, Get, Param, Post, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { StudentWorkspaceService } from "./student-workspace.service";

@ApiTags("student-portal")
@Controller("v1/student-portal/ws")
@UseGuards(SessionGuard, RolesGuard)
@Roles("STUDENT")
export class StudentWorkspaceController {
  constructor(private readonly workspace: StudentWorkspaceService) {}

  @Get("me")
  async me(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.me(session) };
  }

  @Get("calendar-link")
  async calendarLink(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.calendarLink(session) };
  }

  @Post("calendar-link/reset")
  async resetCalendarLink(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.calendarLink(session, true) };
  }

  @Get("badges")
  async badges(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.badges(session) };
  }

  @Get("timetable")
  async timetable(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.timetable(session) };
  }

  @Get("subjects")
  async subjects(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.subjects(session) };
  }

  @Get("assignments")
  async assignments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.assignments(session) };
  }

  @Post("assignments/:id/hand-in")
  async handIn(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.handIn(session, id, body) };
  }

  @Get("attendance")
  async attendance(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.attendance(session) };
  }

  @Get("calendar")
  async calendar(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.calendar(session) };
  }

  @Get("messages")
  async messages(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.messages(session) };
  }

  @Post("messages/read-all")
  async readAll(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.markAllRead(session) };
  }

  @Post("messages/:id/read")
  async read(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.workspace.markRead(session, id) };
  }

  @Post("ask")
  async ask(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.ask(session, body) };
  }

  @Get("askable")
  async askable(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.askable(session) };
  }

  @Get("prefs")
  async prefs(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.prefs(session) };
  }

  @Put("prefs")
  async savePrefs(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.workspace.savePrefs(session, body) };
  }

  @Get("cards")
  async cards(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.workspace.cards(session) };
  }
}

/** The feed a phone's calendar reads. There is no sign-in: the address itself is the secret, and the student can replace it. */
@ApiTags("student-portal")
@Controller("v1/student-calendar")
export class StudentCalendarFeedController {
  constructor(private readonly workspace: StudentWorkspaceService) {}

  @Get(":file")
  async feed(@Param("file") file: string, @Res() response: Response) {
    const text = await this.workspace.feed(file.replace(/\.ics$/, ""));
    response.setHeader("Content-Type", "text/calendar; charset=utf-8");
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(text);
  }
}
