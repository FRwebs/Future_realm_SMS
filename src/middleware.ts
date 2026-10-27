import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canAccessPath, getDefaultPathForRole, isPlatformRole, normalizeRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/domain/types";

const protectedPrefixes = ["/super-admin", "/dashboard", "/admissions", "/students", "/parents", "/teachers", "/attendance", "/academics", "/finance", "/communications", "/analytics", "/operations", "/settings", "/school", "/portals"];

function base64UrlToString(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function verifySession(token?: string) {
  try {
    if (!token) return null;
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = arrayBufferToBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)));
    if (expected !== signature) return null;

    const payload = JSON.parse(base64UrlToString(encodedPayload)) as { role?: Role; exp?: number };
    const role = normalizeRole(payload.role);
    if (!role || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { role, exp: payload.exp };
  } catch {
    return null;
  }
}

function redirectWithNotice(request: NextRequest, role: Role, pathname: string): NextResponse | null {
  const targetPath = getDefaultPathForRole(role);
  if (pathname === targetPath) {
    return null;
  }

  const target = new URL(targetPath, request.url);
  target.searchParams.set("notice", "not-authorized");
  target.searchParams.set("from", pathname);
  return NextResponse.redirect(target);
}

/**
 * The Content-Security-Policy for one page view. Scripts run only if they carry this request's nonce (Next.js attaches it to its own
 * scripts when it sees it in the policy), and `'strict-dynamic'` lets those scripts load their own chunks — so an injected script, which has
 * no nonce, never runs. Styles stay `'unsafe-inline'` because React writes style attributes; a style cannot run code.
 */
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  const api = process.env.NEST_API_URL?.trim();
  const sentry = process.env.NEXT_PUBLIC_SENTRY_DSN ? "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io" : "";
  const analytics = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${["'self'", api, sentry, analytics, dev ? "ws://localhost:3000 ws://127.0.0.1:3000" : ""].filter(Boolean).join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const decide = await decideAccess(request);
  const response = decide ?? NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/** Sends a person somewhere else when they may not see this page; `null` lets the request through. */
async function decideAccess(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const session = await verifySession(request.cookies.get("fr_session")?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isParentPortal = pathname.startsWith("/portals/parent");
  const isStudentPortal = pathname.startsWith("/portals/student");
  const isTeacherPortal = pathname.startsWith("/portals/teacher");
  const isSuperAdmin = pathname.startsWith("/super-admin");
  const platformUser = isPlatformRole(session.role);

  if (isSuperAdmin && !platformUser) {
    return redirectWithNotice(request, session.role, pathname);
  }

  if (!isSuperAdmin && platformUser) {
    return redirectWithNotice(request, session.role, pathname);
  }

  if (isParentPortal && session.role !== "PARENT") {
    return redirectWithNotice(request, session.role, pathname);
  }

  if (isStudentPortal && session.role !== "STUDENT") {
    return redirectWithNotice(request, session.role, pathname);
  }

  if (isTeacherPortal && !["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role)) {
    return redirectWithNotice(request, session.role, pathname);
  }

  if (!canAccessPath(session.role, pathname)) {
    return redirectWithNotice(request, session.role, pathname);
  }

  return null;
}

export const config = {
  // Every page, so every page gets a nonce — but not the API, the framework's own files, or static assets, which are not pages.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|pwa-icon/|images/).*)"],
};
