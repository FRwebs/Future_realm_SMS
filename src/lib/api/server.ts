import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { resolveDirectApiGet } from "@/lib/api/direct";
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

  return cachedApiEnvelopeRequest<T>(
    baseUrl,
    path,
    toCookieHeader(cookieStore.getAll()),
    headerStore.get("authorization") ?? "",
  );
}

export async function apiGet<T>(path: string): Promise<T> {
  const body = await apiGetEnvelope<T>(path);
  return body.data as T;
}
