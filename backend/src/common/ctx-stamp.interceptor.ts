import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Response } from "express";
import { Observable, tap } from "rxjs";

import { CTX_HEADER, ctxVersion } from "../../../src/lib/cache/ctx-version";

/**
 * Puts the context stamp on every answer, read after the handler has run so a request that itself changed who someone is (a role, a class
 * assignment) already carries the new stamp. The web server keeps what it knows about a person for as long as the stamp stays the same.
 */
@Injectable()
export class CtxStampInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        if (response && typeof response.setHeader === "function" && !response.headersSent) response.setHeader(CTX_HEADER, ctxVersion());
      }),
    );
  }
}
