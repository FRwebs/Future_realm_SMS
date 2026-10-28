import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";

/**
 * What no answer from this API may ever carry: a password hash, a two-step secret, the hashes of its backup codes. A query that includes
 * a whole user row (`include: { createdBy: true }`) returns every column of it; the page asks for a name and gets a credential too. The
 * queries are the place to fix that, and are being; this is the net under them, so one that slips through cannot put a secret on the wire.
 */
const NEVER_SENT = new Set(["passwordHash", "mfaSecret", "mfaBackupCodeHashes"]);

export function withoutSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutSecrets) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !NEVER_SENT.has(key)).map(([key, inner]) => [key, withoutSecrets(inner)])) as T;
  }
  return value;
}

@Injectable()
export class SecretStripInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(withoutSecrets));
  }
}
