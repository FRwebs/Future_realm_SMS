import { complianceTab, loadCompliance } from "@/lib/modules/live/m14-compliance";
import { earlyWarningRows } from "@/lib/modules/live/m14-early-warning";
import { insightsTab, loadInsights } from "@/lib/modules/live/m14-insights";
import { loadReports, reportsTab } from "@/lib/modules/live/m14-reports";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M14 Analytics & Reports, read from `/api/v1/analytics-reports`.
 *
 * Insights are the school's own records read as four segments; Reports are every document it can issue and every
 * dataset it can take out; Compliance is what it owes to whom, and whether it can be filed today.
 */
export async function analyticsReportsLiveTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug === "insights") {
    const [insights, warning] = await Promise.all([loadInsights(), earlyWarningRows()]);
    const content = insightsTab(insights);
    return warning.length ? { ...content, rows: [...content.rows, ...warning] } : content;
  }
  if (tabSlug === "reports") return reportsTab(await loadReports());
  if (tabSlug === "compliance") return complianceTab(await loadCompliance());
  return undefined;
}
