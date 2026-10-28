import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { cache } from "react";

import { resolveDirectApiGet } from "@/lib/api/direct";
import { CTX_HEADER } from "@/lib/cache/ctx-version";
import { noteCtx } from "@/lib/cache/ttl";
import { noteRequestDateFormat } from "@/lib/date-format";
import { PREFS_COOKIE, decodeDevicePreferences } from "@/lib/preferences";
import { env } from "@/lib/utils/env";

async function getAppBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : env.APP_URL;
}

function toCookieHeader(entries: Array<{ name: string; value: string }>) {
  return entries.map((item) => `${item.name}=${item.value}`).join("; ");
}

export interface ApiEnvelope<T> {
  ok?: boolean;
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** `PERF_LOG=1` prints every server-side call to the API with how long it took, so a slow page can be traced to the call that made it slow. */
const perfLog = process.env.PERF_LOG === "1";

const cachedApiEnvelopeRequest = cache(
  async <T>(baseUrl: string, path: string, cookieHeader: string, authorization: string) => {
  const directData = await resolveDirectApiGet<T>(path);
  if (directData !== null) {
    return {
      ok: true,
      data: directData,
    } satisfies ApiEnvelope<T>;
  }

  const startedAt = perfLog ? performance.now() : 0;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Cookie: cookieHeader,
      ...(authorization ? { Authorization: authorization } : {}),
    }
  });

  // Every answer says whether who-people-are has changed since the last one; what the web server remembers about people is believed accordingly.
  noteCtx(response.headers.get(CTX_HEADER));
  let body: ApiEnvelope<T> = {};
  if (perfLog) console.info(`[api] ${path.split("?")[0]} ${response.status} ${Math.round(performance.now() - startedAt)}ms (started +${Math.round(startedAt)}ms)`);

  try {
    body = await response.json();
  } catch {
    throw new Error(`Failed to parse JSON response from ${path} (status ${response.status})`);
  }

  // A signed-out session (idle, revoked, switched off) sends the person to sign in rather than showing a failed page.
  if (response.status === 401) redirect("/login");

  if (!response.ok || body.ok === false || body.data === undefined) {
    const message = body.error ?? `Failed to fetch ${path}`;
    throw new Error(`${message} (status ${response.status})`);
  }

    return body;
  },
);

export async function apiGetEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  const [baseUrl, cookieStore, headerStore] = await Promise.all([
    getAppBaseUrl(),
    cookies(),
    headers()
  ]);

  // The page's data is built after this call, so this is the earliest the person's date format can be known and the last it is needed.
  noteRequestDateFormat(decodeDevicePreferences(cookieStore.get(PREFS_COOKIE)?.value).dateFormat);

  return cachedApiEnvelopeRequest<T>(
    baseUrl,
    path,
    toCookieHeader(cookieStore.getAll()),
    headerStore.get("authorization") ?? "",
  );
}

/**
 * A read that is checked but never refused. The shape is compared with what the API answered, a difference is reported once (in the
 * server log, where it is noticed) and the page still gets the answer: for the many reads that have no hand-written contract, noticing a
 * change is worth having and a page that stops working over a stray field is not.
 */
export type Observed<T> = { observed: z.ZodType<unknown>; type?: T };
export const observe = <T,>(schema: z.ZodType<unknown>): Observed<T> => ({ observed: schema });
const reported = new Set<string>();

/**
 * Reads from the API for a page. Given a contract, the answer is checked against it before the page uses it, so an API that changes
 * shape fails here, naming the path, instead of as an `undefined` somewhere in the page. Given an observation (`observe(Schema)`), the
 * same check is made and a difference is reported without stopping the page.
 */
export async function apiGet<T>(path: string, contract?: z.ZodType<T> | Observed<T>): Promise<T> {
  const body = await apiGetEnvelope<T>(path);
  if (!contract) return body.data as T;
  if ("observed" in contract) {
    const seen = contract.observed.safeParse(body.data);
    if (!seen.success) {
      const issue = seen.error.issues[0];
      // In a test run the difference stops the page, so a walk across the screens fails on the page whose read has drifted.
      if (process.env.CONTRACT_MODE === "strict") throw new Error(`${path.split("?")[0]} differs from its type — ${issue?.path.join(".") || "(root)"}: ${issue?.message}`);
      const key = `${path.split("?")[0]}|${issue?.path.join(".")}|${issue?.code}`;
      if (!reported.has(key)) {
        reported.add(key);
        console.warn(`[contract] ${path.split("?")[0]} differs from its type — ${issue?.path.join(".") || "(root)"}: ${issue?.message}${seen.error.issues.length > 1 ? ` (+${seen.error.issues.length - 1} more)` : ""}`);
      }
    }
    return body.data as T;
  }
  const checked = contract.safeParse(body.data);
  if (!checked.success) {
    console.error(`${path} answered in a shape the page does not expect`, checked.error.issues);
    throw new Error(`${path} answered in a shape the page does not expect`);
  }
  return checked.data;
}
