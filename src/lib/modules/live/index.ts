import { getTabContent } from "@/lib/modules/content";
import type { TabContent } from "@/lib/modules/panels";
import { classTimetableLiveTab } from "@/lib/modules/live/m3-class-timetable";
import { reportCardsLiveTab } from "@/lib/modules/live/m6-report-cards";
import { staffAccessLiveTab } from "@/lib/modules/live/m7-staff-access";
import { schoolConfigurationLiveTab } from "@/lib/modules/live/m2-school-configuration";
import { feeManagementLiveTab } from "@/lib/modules/live/m10-fee-management";
import { studentRecordsLiveTab } from "@/lib/modules/live/m8-student-records";

/**
 * Where a module stops being written and starts being read.
 *
 * The sixteen modules are authored as data in `content/`, which is what made
 * them buildable before their endpoints existed. A module graduates by
 * registering a builder here; one with no builder keeps rendering exactly as it
 * did, so wiring the next module cannot disturb the other fifteen.
 */
export type LiveTabBuilder = (tabSlug: string) => Promise<TabContent | null | undefined>;

const liveModules: Record<string, LiveTabBuilder> = {
  m2: schoolConfigurationLiveTab,
  m3: classTimetableLiveTab,
  m6: reportCardsLiveTab,
  m7: staffAccessLiveTab,
  m8: studentRecordsLiveTab,
  m10: feeManagementLiveTab,
};

/** Which modules read from the API today — used by tests and by the module page. */
export const liveModuleCodes = Object.keys(liveModules);

/**
 * A tab that says, on the page, that its figures are the authored ones.
 *
 * Falling back silently is the one thing this must not do. Authored figures
 * look exactly like real ones — that is the point of them — so a page that
 * quietly swapped a live total for a written one would read as a working
 * integration reporting a wrong number.
 */
function withFallbackNote(authored: TabContent, reason: string): TabContent {
  return {
    ...authored,
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "attention",
            title: "Showing the written figures, not this school's",
            body: `The live figures could not be loaded, so every number below is the authored example rather than your data. ${reason}`,
          },
        ],
      },
      ...authored.rows,
    ],
  };
}

export async function getLiveTabContent(
  code: string,
  tabSlug: string,
): Promise<TabContent | undefined> {
  const builder = liveModules[code];
  if (!builder) return undefined;

  try {
    // A builder returning nothing means "this tab is not wired yet", which is
    // not a failure: the page falls back to the authored tab with no banner.
    return (await builder(tabSlug)) ?? undefined;
  } catch (error) {
    const authored = getTabContent(code, tabSlug);
    if (!authored) return undefined;
    const reason = error instanceof Error ? error.message : "The request failed.";
    return withFallbackNote(authored, reason);
  }
}
