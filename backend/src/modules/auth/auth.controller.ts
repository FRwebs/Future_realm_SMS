import { createHash } from "crypto";

import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";

import {
  createSessionToken,
  CSRF_COOKIE_NAME,
  getCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE
} from "../../../../src/lib/auth/session-core";
import { verifySessionToken } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AuthService } from "./auth.service";

function clientIp(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return request.ip ?? request.socket.remoteAddress ?? undefined;
}

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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const payload = loginSchema.parse(body);
    const ipAddress = clientIp(request);
    const device = request.headers["user-agent"];
    const user = await this.authService.authenticateUser(payload.email, payload.password, { ipAddress, device });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const token = await createSessionToken(user);
    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unable to create session");
    }

    await prisma.platformSession.create({
      data: {
        userId: user.userId,
        schoolId: user.schoolId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        ipAddress,
        device,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000)
      }
    });

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
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (token) {
      await prisma.platformSession.updateMany({
        where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
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
