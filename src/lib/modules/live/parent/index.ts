import { feesPage } from "@/lib/modules/live/parent/fees";
import { overviewPage } from "@/lib/modules/live/parent/overview";
import type { ParentContent } from "@/lib/modules/live/parent/shared";
import { parentPages } from "@/lib/modules/parent-workspace";

/**
 * Which builder answers which page.
 *
 * A page with no builder yet is not a 404 — the rail offers it, so it has to
 * say something. `buildParentPage` returns undefined for those and the view
 * renders an honest "not built yet" rather than a broken page or a page of
 * invented data.
 */
const BUILDERS: Partial<Record<string, (child: string, query: Record<string, string | undefined>) => Promise<ParentContent>>> = {
  overview: (child) => overviewPage(child),
  fees: (child, query) => feesPage(child, query),
};

export const parentPageSlugs = (): string[] => parentPages.map((page) => page.slug);

export function buildParentPage(page: string, child: string, query: Record<string, string | undefined>) {
  const builder = BUILDERS[page];
  return builder ? builder(child, query) : undefined;
}

/** Which Back Office module switches a parent page off. */
export const PAGE_MODULE: Record<string, string> = {
  attendance: "attendance",
  results: "score-entry-results",
  learning: "class-timetable",
  fees: "fee-management",
  messages: "communication-center",
  consents: "parents-guardians",
  requests: "parents-guardians",
  meetings: "parents-guardians",
};
