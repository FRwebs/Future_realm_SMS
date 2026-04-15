import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { SessionPayload } from "../../../src/lib/auth/session-core";

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPayload | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.user as SessionPayload | undefined;
  }
);
