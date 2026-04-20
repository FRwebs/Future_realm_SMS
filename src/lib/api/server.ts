import { cookies, headers } from "next/headers";

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

export async function apiGetEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  const [baseUrl, cookieStore, headerStore] = await Promise.all([
    getAppBaseUrl(),
    cookies(),
    headers()
  ]);

  const authorization = headerStore.get("authorization");

  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Cookie: toCookieHeader(cookieStore.getAll()),
      ...(authorization ? { Authorization: authorization } : {})
    }
  });

  let body: ApiEnvelope<T> = {};

  try {
    body = await response.json();
  } catch {
    throw new Error(`Failed to parse JSON response from ${path} (status ${response.status})`);
  }

  if (!response.ok || body.ok === false || body.data === undefined) {
    const message = body.error ?? `Failed to fetch ${path}`;
    throw new Error(`${message} (status ${response.status})`);
  }

  return body;
}

export async function apiGet<T>(path: string): Promise<T> {
  const body = await apiGetEnvelope<T>(path);
  return body.data as T;
}
