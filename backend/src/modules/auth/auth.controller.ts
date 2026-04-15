import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";

import {
  createSessionToken,
  CSRF_COOKIE_NAME,
  getCookieOptions,
  SESSION_COOKIE_NAME
} from "../../../../src/lib/auth/session-core";
import { verifySessionToken } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AuthService } from "./auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response
  ) {
    const payload = loginSchema.parse(body);
    const user = await this.authService.authenticateUser(payload.email, payload.password);

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const token = await createSessionToken(user);
    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unable to create session");
    }

    response.cookie(SESSION_COOKIE_NAME, token, getCookieOptions(true));
    response.cookie(CSRF_COOKIE_NAME, session.csrfToken, getCookieOptions(false));

    return {
      ok: true,
      data: {
        user: session
      }
    };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    response.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  @Get("session")
  @UseGuards(SessionGuard)
  session(@CurrentSession() session: unknown) {
    return {
      ok: true,
      data: {
        user: session
      }
    };
  }
}
