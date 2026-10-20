import { Body, Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import {
  createSessionToken,
  CSRF_COOKIE_NAME,
  getCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "../../../../src/lib/auth/session-core";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { OnboardingService } from "./onboarding.service";

@ApiTags("onboarding")
@Controller("v1/onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("schools")
  async registerSchool(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const { sessionUser, school, account } = await this.onboardingService.registerSchool(body, request.ip);
    return this.establishSession(sessionUser, school, response, account);
  }

  @Post("teachers")
  async registerTeacher(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ) {
    const { sessionUser, school, account } = await this.onboardingService.registerTeacher(body);
    return this.establishSession(sessionUser, school, response, account);
  }

  @Get("slug-check")
  async checkSlug(@Query("slug") slug: string) {
    const evaluation = await this.onboardingService.checkSlugAvailability(slug || "");
    return { ok: true, data: evaluation };
  }

  @Get("school-search")
  async searchSchools(@Query("q") q: string) {
    const results = await this.onboardingService.searchSchoolsByName(q || "");
    return { ok: true, data: results };
  }

  @Get("plans")
  async listPlans() {
    const plans = await this.onboardingService.listPublicPlans();
    return { ok: true, data: plans };
  }

  @Post("verify")
  async verifyEmail(@Body() body: unknown) {
    const result = await this.onboardingService.verifyEmail(body);
    return { ok: true, data: result };
  }

  @Post("resend")
  async resendVerification(@Body() body: unknown) {
    const result = await this.onboardingService.resendVerification(body);
    return { ok: true, data: result };
  }

  private async establishSession(
    sessionUser: Parameters<typeof createSessionToken>[0],
    school: unknown,
    response: Response,
    account?: unknown
  ) {
    const token = await createSessionToken(sessionUser);
    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unable to create session");
    }

    response.cookie(SESSION_COOKIE_NAME, token, getCookieOptions(true));
    response.cookie(CSRF_COOKIE_NAME, session.csrfToken, getCookieOptions(false));

    return {
      ok: true,
      data: {
        user: session,
        school,
        account
      }
    };
  }

  @Get("trial")
  @UseGuards(SessionGuard)
  async trial(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.onboardingService.trialStatus(session) };
  }

  @Post("trial/start")
  @UseGuards(SessionGuard, CsrfGuard)
  async startTrial(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.onboardingService.startTrial(session) };
  }

  @Post("change-email")
  @UseGuards(SessionGuard, CsrfGuard)
  async changeEmail(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return { ok: true, data: await this.onboardingService.changeEmail(session, body) };
  }

  @Get("join-requests")
  @UseGuards(SessionGuard)
  async joinRequests(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.onboardingService.joinRequests(session) };
  }

  @Post("join-requests/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard)
  async decideJoinRequest(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: unknown) {
    return { ok: true, data: await this.onboardingService.decideJoinRequest(session, id, body) };
  }

  @Get("sample")
  @UseGuards(SessionGuard)
  async sample(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.onboardingService.sampleStatus(session) };
  }

  @Post("sample/clear")
  @UseGuards(SessionGuard, CsrfGuard)
  async clearSample(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.onboardingService.clearSample(session) };
  }
}
