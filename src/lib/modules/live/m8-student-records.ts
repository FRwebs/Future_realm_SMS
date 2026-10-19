import { admissionsTab, loadAdmissionOptions, loadBoard } from "@/lib/modules/live/m8-admissions";
import { changesTab, loadChanges } from "@/lib/modules/live/m8-changes";
import { loadMoveOptions, loadRegistry, registryTab } from "@/lib/modules/live/m8-registry";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M08 Student Records, read from `/api/v1/student-records`.
 *
 * Three readings of one register: the Registry (every child, and the record each one opens),
 * Admissions (who is trying to get in, and what moves them on) and Changes (what has been asked
 * of a record, what is pending and what is incomplete).
 */
export async function studentRecordsLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "registry") {
    const [data, rooms] = await Promise.all([loadRegistry(), loadMoveOptions()]);
    return registryTab(data, rooms);
  }
  if (tabSlug === "admissions") {
    const [board, options] = await Promise.all([loadBoard(), loadAdmissionOptions()]);
    return admissionsTab(board, options);
  }
  if (tabSlug === "changes") {
    const [data, registry] = await Promise.all([loadChanges(), loadRegistry().catch(() => null)]);
    return changesTab(data, registry);
  }
  return undefined;
}
