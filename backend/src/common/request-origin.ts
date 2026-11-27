import { AsyncLocalStorage } from "node:async_hooks";

import type { NextFunction, Request, Response } from "express";

/**
 * Where the request being served came from — the address and the device — held for as long as it is being answered, so that anything it
 * writes to the audit log can say where it was done without every writer being handed the request.
 */
export type RequestOrigin = { ip?: string; device?: string; /** The address names the sample class, so this request sees it. */ aboutSample?: boolean };

const origin = new AsyncLocalStorage<RequestOrigin>();

declare global {
  var __auditOrigin__: (() => { ip?: string; device?: string } | undefined) | undefined;
}

// The shared database client reads it through this hook, so it needs no knowledge of the web framework.
globalThis.__auditOrigin__ = () => origin.getStore();
// A request whose address names the sample class — its own page, its own roster — is allowed to see it (see lib/db/sample-filter).
globalThis.__includeSample__ = () => origin.getStore()?.aboutSample === true;

export function addressOf(request: Pick<Request, "headers" | "ip" | "socket">): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return request.ip ?? request.socket?.remoteAddress ?? undefined;
}

export function requestOrigin(request: Request, _response: Response, next: NextFunction) {
  const device = request.headers["user-agent"];
  const address = request.originalUrl ?? request.url ?? "";
  const aboutSample = (globalThis.__sampleIds__?.() ?? []).some((id) => address.includes(id));
  origin.run({ ip: addressOf(request), device: typeof device === "string" ? device.slice(0, 200) : undefined, aboutSample }, next);
}
