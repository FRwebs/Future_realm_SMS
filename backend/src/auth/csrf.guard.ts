import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";

import { CSRF_COOKIE_NAME } from "../../../src/lib/auth/session-core";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = request.cookies?.[CSRF_COOKIE_NAME];
    const incoming = request.header("x-csrf-token");

    if (!expected || !incoming || expected !== incoming) {
      throw new UnauthorizedException("Invalid CSRF token");
    }

    return true;
  }
}
