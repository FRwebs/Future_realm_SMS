import { complianceTab } from "@/lib/modules/live/m4-compliance";
import { logTab } from "@/lib/modules/live/m4-log";
import { loadCompliance } from "@/lib/modules/live/m4-compliance";
import { loadLog } from "@/lib/modules/live/m4-log";
import { markTab } from "@/lib/modules/live/m4-mark";
import { loadOptions, loadOverview, registerTab } from "@/lib/modules/live/m4-register";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M04 Attendance, read from `/api/v1/attendance-management`.
 *
 * Register is the whole school's day, not one teacher's class; you drill into an arm, a week, a day
 * or a child from there. Mark is for the days an administrator has to take a register themselves, and
 * starts by choosing the arm. Compliance is about the adults; Log is the children over time.
 */
export async function attendanceLiveTab(tabSlug: string, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  if (tabSlug === "register") {
    const [overview, options] = await Promise.all([loadOverview(query.date), loadOptions()]);
    return registerTab(overview, options);
  }
  if (tabSlug === "mark") return markTab(await loadOverview(query.date));
  if (tabSlug === "compliance") {
    const [compliance, options] = await Promise.all([loadCompliance(), loadOptions()]);
    return complianceTab(compliance, options);
  }
  if (tabSlug === "log") {
    const [log, options] = await Promise.all([loadLog(), loadOptions()]);
    return logTab(log, options);
  }
  return undefined;
}
