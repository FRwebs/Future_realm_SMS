import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { SessionUser } from "@/lib/domain/types";
import { env } from "@/lib/utils/env";

export const SESSION_COOKIE_NAME = "fr_session";
export const CSRF_COOKIE_NAME = "fr_csrf";
export const SESSION_MAX_AGE = 60 * 60 * 8;

export interface SessionPayload extends SessionUser {
  exp: number;
  iat: number;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}

export function generateCsrfToken() {
  return randomBytes(24).toString("base64url");
}

export async function createSessionToken(
  user: Omit<SessionUser, "csrfToken">,
  options?: { maxAgeSeconds?: number }
) {
  const csrfToken = generateCsrfToken();
  const maxAgeSeconds = options?.maxAgeSeconds ?? SESSION_MAX_AGE;
  const payload: SessionPayload = {
    ...user,
    csrfToken,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export async function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) {
    return null;
  }
  const isValid = timingSafeEqual(provided, expected);
  if (!isValid) return null;

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export function getSessionTokenFromCookieValue(cookieValue?: string) {
  return cookieValue ?? null;
}

export function getCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE * 1000
  };
}
