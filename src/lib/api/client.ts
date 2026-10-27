import type { z } from "zod";

import type { ApiPath } from "./api-routes";

/**
 * Reading from the API in the browser. One place knows how a failure is worded, so every query shows the same message the server gave.
 * Writes keep using their own `fetch` because each needs the CSRF header and its own wording.
 */
type Query = Record<string, string | number | boolean | null | undefined>;
type PathParams<P extends string> = P extends `${string}{${infer Key}}${infer Rest}` ? { [K in Key]: string | number } & PathParams<Rest> : Record<never, never>;
type UrlArgs<P extends string> = keyof PathParams<P> extends never ? [query?: Query] : [params: PathParams<P>, query?: Query];

/**
 * The address of an endpoint the API really has. The template is checked against the API's own route list (generated from its OpenAPI
 * document), so a misspelt or removed endpoint is a type error, and the `{placeholders}` must be filled in with the right names:
 *
 *   getUrl("/api/super-admin/internal-team/devices/{userId}", { userId: member.id })
 *   getUrl("/api/v1/onboarding/slug-check", { slug })
 */
export function getUrl<P extends ApiPath<"GET">>(template: P, ...args: UrlArgs<P>): string {
  const hasParams = /\{[^}]+\}/.test(template);
  const params = (hasParams ? args[0] : {}) as Record<string, string | number>;
  const query = (hasParams ? args[1] : args[0]) as Query | undefined;
  const path = template.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(params[key])));
  const search = new URLSearchParams(Object.entries(query ?? {}).flatMap(([key, value]) => (value === null || value === undefined ? [] : [[key, String(value)] as [string, string]]))).toString();
  return search ? `${path}?${search}` : path;
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiJson<T>(path: string, signal?: AbortSignal, contract?: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" }, signal });
  let body: { ok?: boolean; success?: boolean; data?: T; error?: string; message?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || body?.ok === false || body?.success === false) {
    throw new ApiRequestError(body?.error ?? body?.message ?? "The request did not go through.", response.status);
  }
  const data = body?.data ?? null;
  if (!contract) return data as T;
  const checked = contract.safeParse(data);
  if (!checked.success) {
    // The page would otherwise carry on with a value shaped wrongly; say so once, here, with the path and what differed.
    console.error(`${path} answered in a shape the page does not expect`, checked.error.issues);
    throw new ApiRequestError("The server answered in a way this page could not read. Please try again in a moment.", 502);
  }
  return checked.data;
}

/** For the few endpoints that answer with the record itself rather than `{ ok, data }` — a drawer's content, for one. */
export async function apiRaw<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" }, signal });
  const body = (await response.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!response.ok || !body) throw new ApiRequestError(body?.error ?? body?.message ?? "That record could not be read.", response.status);
  return body;
}
