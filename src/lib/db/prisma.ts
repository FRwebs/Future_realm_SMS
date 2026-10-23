import { PrismaClient } from "@prisma/client";

import { bumpCtxVersion, changesWhoSomeoneIs } from "../cache/ctx-version";

declare global {
  var __prisma__: PrismaClient | undefined;
  var __prismaPlatformFilter__: boolean | undefined;
  var __prismaCtxStamp__: boolean | undefined;
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

/**
 * The platform is the owner of this product, not one of its schools. Its back-office logins sit on a school row only because a user must
 * belong to one, so every question asked of the list of schools — which, how many, how much — is answered without it. Reading it by id (to
 * sign a platform user in, for instance) is not a list and is left alone.
 */
const SCHOOL_LISTS = new Set(["findMany", "count", "groupBy", "aggregate"]);
if (!global.__prismaPlatformFilter__) {
  global.__prismaPlatformFilter__ = true;
  prisma.$use(async (params, next) => {
    if (params.model === "School" && SCHOOL_LISTS.has(params.action)) {
      const args = (params.args ?? {}) as { where?: Record<string, unknown> };
      params.args = { ...args, where: args.where ? { AND: [args.where, { isPlatform: false }] } : { isPlatform: false } };
    }
    return next(params);
  });
}

/**
 * Anything written that can change who a person is allowed to be moves the context stamp the API puts on every answer (see
 * lib/cache/ctx-version), so what the web server remembers about people is dropped the moment it could be wrong.
 */
if (!global.__prismaCtxStamp__) {
  global.__prismaCtxStamp__ = true;
  prisma.$use(async (params, next) => {
    const result = await next(params);
    if (changesWhoSomeoneIs(params.model, params.action, params.args)) bumpCtxVersion();
    return result;
  });
}

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
