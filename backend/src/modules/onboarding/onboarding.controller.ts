import { Body, Controller, Get, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import {
  createSessionToken,
  CSRF_COOKIE_NAME,
  getCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "../../../../src/lib/auth/session-core";
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
    const { sessionUser, school } = await this.onboardingService.registerSchool(body, request.ip);
    return this.establishSession(sessionUser, school, response);
  }

  @Post("teachers")
  async registerTeacher(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ) {
    const { sessionUser, school } = await this.onboardingService.registerTeacher(body);
    return this.establishSession(sessionUser, school, response);
  }

  @Get("slug-check")
  async checkSlug(@Query("slug") slug: string) {
    const evaluation = await this.onboardingService.checkSlugAvailability(slug || "");
    return { ok: true, data: evaluation };
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
    response: Response
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
        school
      }
    };
  }
}
