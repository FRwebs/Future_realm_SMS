import type { ErrorEvent } from "@sentry/nextjs";

/**
 * What error reporting is allowed to carry. This product holds children's records, so nothing a person typed or was shown leaves the
 * building: no cookies, no request bodies, no query strings, no user email or address. What remains is enough to find the bug — the
 * message, the stack, the route and the release.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

export const sentryOptions = {
  // Reporting is off until a DSN is configured, so development and tests never send anything.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
} as const;
