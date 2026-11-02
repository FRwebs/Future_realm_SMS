import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import { ttlCached } from "@/lib/cache/ttl";

export const PW = "/api/v1/parent-portal/ws";

export type ParentChromeChild = {
  id: string; first: string; initials: string; arm: string; photoUrl: string | null;
  stat: string; statTone?: "negative" | "attention"; needs: number; urgent: boolean;
};

export type ParentChrome = {
  /** The chips in the top bar: the whole family, then each child. */
  children: ParentChromeChild[];
  family: { stat: string; needs: number; urgent: boolean };
  /** Shown instead of the chips on the pages that are about the parent, not a child. */
  account: { title: string; sub: string };
  /** The block at the foot of the rail: how to reach the school. */
  office: { name: string; term: string; line: string };
};

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


/**
 * The parent portal's own chrome.
 *
 * The mockup puts the child switcher in the top bar rather than above the
 * page, which is right: "which child" is a property of the whole session, not
 * of one screen, and a parent who picks a child keeps that choice as they move
 * around. The foot of the rail carries the school office instead of the
 * parent's own name — the parent knows who they are; what they reach for is the
 * school's phone number.
 */
export const getParentChrome = cache(async (role: string): Promise<ParentChrome | null> => {
  if (role !== "PARENT") return null;
  try {
    const session = await getServerSession();
    if (!session) return null;
    return await ttlCached(`pchrome:${session.schoolId}:${session.userId}`, 30_000, async () => {
      const [me, needs] = await Promise.all([
        apiGet<{
          name: string; children: Array<{ id: string; first: string; initials: string; arm: string; photoUrl: string | null }>;
          term: { name: string; week: number } | null;
          office: { name: string; phone: string | null; website: string | null; where: string | null };
        }>(`${PW}/me`),
        apiGet<{ items: Array<{ childId: string | null; tone: string }> }>(`${PW}/needs?child=all`).catch(() => ({ items: [] })),
      ]);
      const count = needs.items.length;
      const kids = me.children.length;
      return {
        children: me.children.map((child) => {
          const mine = needs.items.filter((need) => need.childId === child.id);
          return {
            ...child,
            stat: mine.length ? `${mine.length} to do` : child.arm,
            statTone: mine.some((need) => need.tone === "negative") ? ("negative" as const) : mine.length ? ("attention" as const) : undefined,
            needs: mine.length,
            urgent: mine.some((need) => need.tone === "negative"),
          };
        }),
        family: {
          stat: count ? `${count} ${count === 1 ? "thing needs" : "things need"} you` : "Nothing to do",
          needs: count,
          urgent: needs.items.some((need) => need.tone === "negative"),
        },
        account: {
          title: "Your account",
          sub: `${me.name}${kids ? ` · these settings cover ${kids === 1 ? "your child" : `all ${kids} children`}` : ""}`,
        },
        office: {
          name: me.office.name,
          term: me.term ? `${me.term.name} · Week ${me.term.week}` : "No term is running",
          // Only what the school has actually given us, so the line never
          // promises a way to reach them that does not exist.
          line: [me.office.phone, me.office.website, me.office.where].filter(Boolean).join(" · ") || "No contact details on record",
        },
      };
    });
  } catch {
    return null;
  }
});
