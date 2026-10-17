import { getServerSession } from "@/lib/auth/session";
import { collectionsTab, formClassTab, loadCollections, loadFormClass } from "@/lib/modules/live/m10-collections";
import { historyTab, loadHistory } from "@/lib/modules/live/m10-history";
import { loadReview, reviewTab } from "@/lib/modules/live/m10-review";
import { loadStructureOptions, loadStructures, structuresTab } from "@/lib/modules/live/m10-structures";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M10 Fee Management, read from `/api/v1/fee-management`.
 *
 * Four readings of one ledger: Collections (who owes, and what came in), Structures (what each
 * group of classes is charged), Review (supervising the bursary) and History (every term and
 * every receipt). A family's balance, a structure's expected figure and a receipt are each
 * derived once on the server, so a screen never contradicts the one beside it.
 */

const FORM_MASTER_ROLES = new Set(["CLASS_TEACHER", "SUBJECT_TEACHER"]);

export async function feeManagementLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "collections") {
    const session = await getServerSession();
    if (session && FORM_MASTER_ROLES.has(session.role)) return formClassTab(await loadFormClass());
    return collectionsTab(await loadCollections());
  }
  if (tabSlug === "structures") {
    const [data, options] = await Promise.all([loadStructures(), loadStructureOptions()]);
    return structuresTab(data, options.terms);
  }
  if (tabSlug === "review") return reviewTab(await loadReview());
  if (tabSlug === "history") return historyTab(await loadHistory());
  return undefined;
}
