import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import { ttlCached } from "@/lib/cache/ttl";

export const PW = "/api/v1/parent-portal/ws";

export type ParentRailData = {
  /** What this school shows parents, by page name. */
  sees: string[];
  /** What needs the parent, keyed by rail item id. */
  counts: Record<string, number>;
  tones: Record<string, "warning" | "danger" | undefined>;
  /** The child the rail should carry in its links, and whose name the profile page takes. */
  child?: string;
  firstName?: string;
};

/**
 * What a parent's rail needs before any page is built: which pages their school
 * shows, and how much of each is outstanding.
 *
 * The badges come from the same read the overview leads with, so the rail and
 * the page can never disagree about how much needs doing.
 */
export const getParentRail = cache(async (role: string): Promise<ParentRailData | null> => {
  if (role !== "PARENT") return null;
  try {
    const session = await getServerSession();
    if (!session) return null;
    return await ttlCached(`prail:${session.schoolId}:${session.userId}`, 30_000, async () => {
      const [me, needs] = await Promise.all([
        apiGet<{ sees: string[]; children: Array<{ id: string; first: string }> }>(`${PW}/me`),
        apiGet<{ items: Array<{ kind: string; tone: string }> }>(`${PW}/needs?child=all`).catch(() => ({ items: [] })),
      ]);
      const of = (...kinds: string[]) => needs.items.filter((item) => kinds.includes(item.kind));
      const fees = of("fee", "instalment");
      const counts: Record<string, number> = {
        p_fees: fees.length,
        p_attendance: of("absence").length,
        p_consents: of("consent").length,
        p_meetings: of("meeting").length,
      };
      const tones: Record<string, "warning" | "danger" | undefined> = {
        p_fees: fees.some((item) => item.tone === "negative") ? "danger" : fees.length ? "warning" : undefined,
        p_attendance: counts.p_attendance ? "warning" : undefined,
        p_consents: counts.p_consents ? "warning" : undefined,
        p_meetings: counts.p_meetings ? "warning" : undefined,
      };
      return { sees: me.sees, counts, tones };
    });
  } catch {
    return null;
  }
});
