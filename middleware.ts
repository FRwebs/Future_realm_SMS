import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/domain/types";

const protectedPrefixes = ["/dashboard", "/admissions", "/students", "/teachers", "/attendance", "/academics", "/finance", "/communications", "/analytics", "/settings", "/portals"];
const validRoles: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PRINCIPAL",
  "ADMIN_OFFICER",
  "ADMISSIONS_OFFICER",
  "ACCOUNTANT",
  "TEACHER",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "HOSTEL_MANAGER",
  "PARENT",
  "STUDENT"
];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && validRoles.includes(value as Role);
}

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
    if (!isRole(payload.role) || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get("fr_session")?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL(getDefaultPathForRole(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admissions/:path*", "/students/:path*", "/teachers/:path*", "/attendance/:path*", "/academics/:path*", "/finance/:path*", "/communications/:path*", "/analytics/:path*", "/settings/:path*", "/portals/:path*"]
};
