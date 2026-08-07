import { createHash } from "crypto";

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "../../../src/lib/auth/session-core";
import { prisma } from "../../../src/lib/db/prisma";

type AuthenticatedRequest = Request & {
  user?: Awaited<ReturnType<typeof verifySessionToken>>;
};

function getBearerToken(authorization?: string) {
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] ?? getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Unauthorized");
    }

    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unauthorized");
    }

    request.user = session;
    // Fire-and-forget so request latency is unaffected; keeps "online now" widgets and
    // session-based suspicious-activity detection working off real activity data.
    prisma.platformSession
      .updateMany({
        where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
        data: { lastActivityAt: new Date() }
      })
      .catch(() => undefined);
    return true;
  }
}
