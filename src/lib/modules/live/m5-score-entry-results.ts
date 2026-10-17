import { enterTab, loadChooser } from "@/lib/modules/live/m5-enter";
import { loadCorrectionOptions, loadCorrections, loadResults, resultsTab } from "@/lib/modules/live/m5-results";
import { loadReview, reviewTab } from "@/lib/modules/live/m5-review";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M05 Score Entry & Results, read from `/api/v1/score-results`.
 *
 * Review is the administrator's first question — which arms are done, and who is holding the rest up.
 * Enter is for the days an administrator has to type a sheet themselves. Results begins at the school,
 * then an arm's broadsheet, then one child — every number explained.
 */
export async function scoreEntryResultsLiveTab(tabSlug: string, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  if (tabSlug === "review") return reviewTab(await loadReview());
  if (tabSlug === "enter") return enterTab(await loadChooser({ level: query.level, arm: query.arm }));
  if (tabSlug === "results") {
    const [results, corrections, options] = await Promise.all([loadResults(), loadCorrections(), loadCorrectionOptions()]);
    return resultsTab(results, corrections.rows, options);
  }
  return undefined;
}
