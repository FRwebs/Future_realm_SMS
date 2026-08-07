import { Body, Controller, Post, Res, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

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
    @Res({ passthrough: true }) response: Response
  ) {
    const { sessionUser, school } = await this.onboardingService.registerSchool(body);

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
