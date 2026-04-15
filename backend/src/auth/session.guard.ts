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

type AuthenticatedRequest = Request & {
  user?: Awaited<ReturnType<typeof verifySessionToken>>;
};

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException("Unauthorized");
    }

    const session = await verifySessionToken(token);
    if (!session) {
      throw new UnauthorizedException("Unauthorized");
    }

    request.user = session;
    return true;
  }
}
