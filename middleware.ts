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

function redirectWithNotice(request: NextRequest, role: Role, pathname: string) {
  const targetPath = getDefaultPathForRole(role);
  if (pathname === targetPath) {
    return NextResponse.next();
  }

  const target = new URL(targetPath, request.url);
  target.searchParams.set("notice", "not-authorized");
  target.searchParams.set("from", pathname);
  return NextResponse.redirect(target);
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/super-admin/:path*", "/dashboard/:path*", "/admissions/:path*", "/students/:path*", "/parents/:path*", "/teachers/:path*", "/attendance/:path*", "/academics/:path*", "/finance/:path*", "/communications/:path*", "/analytics/:path*", "/operations/:path*", "/settings/:path*", "/school/:path*", "/portals/:path*"]
};
