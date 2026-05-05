import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

function normalizePrismaRuntimeUrl(rawUrl?: string) {
  if (!rawUrl) return undefined;

  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler = parsed.hostname.includes("pooler.supabase.com");
    const isSessionPoolPort = parsed.port === "5432";

    if (isSupabasePooler && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (isSupabasePooler) {
      const existingLimit = parsed.searchParams.get("connection_limit");
      const normalizedLimit = existingLimit ? Number(existingLimit) : Number.NaN;

      if (!existingLimit || Number.isNaN(normalizedLimit) || normalizedLimit < 5) {
        parsed.searchParams.set("connection_limit", isSessionPoolPort ? "5" : "3");
      }

      if (!parsed.searchParams.has("pool_timeout")) {
        parsed.searchParams.set("pool_timeout", "30");
      }
    }

    if (!isSupabasePooler) {
      if (parsed.searchParams.get("connection_limit") === "1") {
        parsed.searchParams.delete("connection_limit");
      }

      if (parsed.searchParams.get("pgbouncer") === "true") {
        parsed.searchParams.delete("pgbouncer");
      }
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function isPreferredDirectUrl(rawUrl?: string) {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler = parsed.hostname.includes("pooler.supabase.com");

    if (isSupabasePooler) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function resolvePrismaRuntimeUrl() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const directUrl = process.env.DIRECT_URL?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (isDevelopment && isPreferredDirectUrl(directUrl)) {
    return normalizePrismaRuntimeUrl(directUrl);
  }

  return normalizePrismaRuntimeUrl(databaseUrl);
}

const runtimeUrl = resolvePrismaRuntimeUrl();

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    ...(runtimeUrl
      ? {
          datasources: {
            db: {
              url: runtimeUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
