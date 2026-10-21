import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { PARTNER_COOKIE, PartnerPortalService, partnerCookieValue } from "./partner-portal.service";

const writeRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "SUPER_ADMIN"] as const;

const cookieOf = (request: Request) => (request.headers.cookie ?? "").split("; ").find((item) => item.startsWith(`${PARTNER_COOKIE}=`))?.split("=")[1];
const setCookie = (response: Response, accountId: string) =>
  response.cookie(PARTNER_COOKIE, partnerCookieValue(accountId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 12 * 3_600_000, path: "/" });

/** The Back Office side: sending a partner their login. */
@ApiTags("super-admin-partner-invites")
@Controller("super-admin/partners")
export class PartnerInviteController {
  constructor(private readonly portal: PartnerPortalService) {}

  @Post(":id/invite")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...writeRoles)
  async invite(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    const result = await this.portal.invite(session, id, body);
    return { ok: true, success: true, message: `Invitation sent to ${result.invited.join(" and ")}`, data: result };
  }
}

/** The partner's own side. Nothing here uses the school or platform session. */
@ApiTags("partner-portal")
@Controller("partner-portal")
export class PartnerPortalController {
  constructor(private readonly portal: PartnerPortalService) {}

  @Post("accept")
  async accept(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const { accountId } = await this.portal.accept(body);
    setCookie(response, accountId);
    return { ok: true, success: true, message: "Password set — you are signed in" };
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const { accountId } = await this.portal.login(body);
    setCookie(response, accountId);
    return { ok: true, success: true, message: "Signed in" };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(PARTNER_COOKIE, { path: "/" });
    return { ok: true, success: true };
  }

  @Get("overview")
  async overview(@Req() request: Request) {
    const account = await this.portal.accountFromCookie(cookieOf(request));
    return { ok: true, success: true, data: await this.portal.overview(account.id) };
  }
}
