import { loadPerformance, performanceTab } from "@/lib/modules/live/m13-performance";
import { loadQueue, queueTab } from "@/lib/modules/live/m13-queue";
import { loadWorkflow, workflowTab } from "@/lib/modules/live/m13-workflow";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M13 Approvals & Workflow, read from `/api/v1/approvals-hub`.
 *
 * The queue is every decision the school has waiting, read from the module that holds each one and decided
 * there. Workflow is how those decisions are routed; Performance is whether they are being made.
 */
export async function approvalsWorkflowLiveTab(tabSlug: string, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  if (tabSlug === "queue") return queueTab(await loadQueue({ scope: query.scope, type: query.type, state: query.state }));
  if (tabSlug === "workflow") return workflowTab(await loadWorkflow());
  if (tabSlug === "performance") return performanceTab(await loadPerformance());
  return undefined;
}
