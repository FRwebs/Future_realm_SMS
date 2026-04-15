import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionToken,
  CSRF_COOKIE_NAME,
  getCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "@/lib/auth/session-core";

export function getSessionTokenFromCookies(cookieStore: {
  get(name: string): { value: string } | undefined;
}) {
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getServerSession() {
  const store = await cookies();
  const token = getSessionTokenFromCookies(store);
  if (!token) return null;
  return verifySessionToken(token);
}

export function attachSessionCookies(response: NextResponse, token: string, csrfToken: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions(true));
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, getCookieOptions(false));
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(CSRF_COOKIE_NAME);
}

export async function assertCsrf(request: Request) {
  const store = await cookies();
  const expected = store.get(CSRF_COOKIE_NAME)?.value;
  const incoming = request.headers.get("x-csrf-token");
  if (!expected || !incoming || expected !== incoming) {
    throw new Error("Invalid CSRF token");
  }
}

export { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, CSRF_COOKIE_NAME };
