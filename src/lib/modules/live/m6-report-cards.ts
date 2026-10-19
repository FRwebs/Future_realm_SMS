import { archiveTab, loadArchive } from "@/lib/modules/live/m6-archive";
import { completionTab, loadCompletion } from "@/lib/modules/live/m6-completion";
import { loadRemarks, remarksTab } from "@/lib/modules/live/m6-remarks";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M06 Report Cards, read from `/api/v1/report-cards`.
 *
 * Remarks is where the words are written, Completion is where the cards leave, and Archive is every
 * card that has ever left — each answers from the API, not from a shared list.
 */
export async function reportCardsLiveTab(tabSlug: string, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  if (tabSlug === "remarks") {
    const o = await loadRemarks({ level: query.level, arm: query.arm });
    return o ? remarksTab(o, o.school) : null;
  }
  if (tabSlug === "completion") {
    const o = await loadCompletion();
    return o ? completionTab(o, o.school) : null;
  }
  if (tabSlug === "archive") {
    const o = await loadArchive({ term: query.term, arm: query.arm });
    return o ? archiveTab(o) : null;
  }
  return undefined;
}
