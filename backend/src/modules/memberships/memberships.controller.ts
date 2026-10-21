import { createHash } from "crypto";

import { Body, Controller, Get, Param, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_MAX_AGE, createSessionToken, getCookieOptions, verifySessionToken, type SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { MembershipsService } from "./memberships.service";

@ApiTags("memberships")
@Controller("v1/memberships")
@UseGuards(SessionGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get("mine")
  async mine(@CurrentSession() session: SessionPayload) {
    const list = await this.memberships.listFor(session.userId);
    return { ok: true, data: list.map((entry) => ({ ...entry, current: entry.schoolId === session.schoolId })) };
  }

  /** Sign in as the same person at another school they belong to. The old session ends; a new one starts at once. */
  @Post("switch/:schoolId")
  @UseGuards(CsrfGuard)
  async switch(@CurrentSession() session: SessionPayload, @Param("schoolId") schoolId: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (session.impersonation) throw new UnauthorizedException("Stop acting as another person before switching school.");
    const next = await this.memberships.switchTo(session, schoolId);
    const old = request.cookies?.[SESSION_COOKIE_NAME];
    const token = await createSessionToken({ ...next, role: next.role as SessionPayload["role"] }, { maxAgeSeconds: SESSION_MAX_AGE });
    const fresh = await verifySessionToken(token);
    if (!fresh) throw new UnauthorizedException("Unable to switch school.");
    await prisma.platformSession.create({ data: { userId: next.userId, schoolId: next.schoolId, tokenHash: createHash("sha256").update(token).digest("hex"), ipAddress: request.ip ?? null, device: request.headers["user-agent"] ?? null, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) } });
    if (old) await prisma.platformSession.updateMany({ where: { tokenHash: createHash("sha256").update(old).digest("hex"), revokedAt: null }, data: { revokedAt: new Date() } });
    response.cookie(SESSION_COOKIE_NAME, token, getCookieOptions(true, SESSION_MAX_AGE));
    response.cookie(CSRF_COOKIE_NAME, fresh.csrfToken, getCookieOptions(false, SESSION_MAX_AGE));
    return { ok: true, data: { schoolId: next.schoolId, role: next.role } };
  }

  @Get("school")
  school(@CurrentSession() session: SessionPayload) {
    return ok(this.memberships.ofSchool(session.schoolId));
  }

  @Post()
  @UseGuards(CsrfGuard)
  grant(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.memberships.grant(session, body), "Added to the school");
  }

  @Post(":id/remove")
  @UseGuards(CsrfGuard)
  remove(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.memberships.revoke(session, id), "Removed from the school");
  }
}
