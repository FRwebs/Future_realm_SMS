import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { ttlCached } from "@/lib/cache/ttl";
import { getServerSession } from "@/lib/auth/session";
import type { PlatformSyncView } from "@/lib/domain/types";

/**
 * What the Back Office has decided for the signed-in school — read once per request, however many server components ask, so the
 * layout can show the notices and a page can leave out the modules that are switched off.
 */
export const getPlatformSync = cache(async (schoolId: string): Promise<PlatformSyncView | null> => {
  try {
    const session = await getServerSession();
    const read = () => apiGet<PlatformSyncView>("/api/v1/platform-sync");
    // Ten seconds: a module switched off or a maintenance window shows within moments, without every click asking again.
    return session ? await ttlCached(`sync:${schoolId}:${session.userId}`, 10_000, read) : await read();
  } catch {
    return null;
  }
});

/** The module slugs switched off for the signed-in school. */
export async function switchedOffSlugs(schoolId: string): Promise<Set<string>> {
  return new Set((await getPlatformSync(schoolId))?.switchedOff.map((module) => module.slug) ?? []);
}

/** Whether a link into a module should be offered: `/attendance/register` belongs to `attendance`. */
export const linkIsOpen = (off: Set<string>, href: string) => !off.has(href.split("/")[1] ?? "");
