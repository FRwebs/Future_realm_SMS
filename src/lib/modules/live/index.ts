import type { TabContent } from "@/lib/modules/panels";
import { classTimetableLiveTab } from "@/lib/modules/live/m3-class-timetable";
import { reportCardsLiveTab } from "@/lib/modules/live/m6-report-cards";
import { staffAccessLiveTab } from "@/lib/modules/live/m7-staff-access";
import { parentsGuardiansLiveTab } from "@/lib/modules/live/m9-parents-guardians";
import { approvalsWorkflowLiveTab } from "@/lib/modules/live/m13-approvals-workflow";
import { communicationCenterLiveTab } from "@/lib/modules/live/m12-communication-center";
import { subscriptionBillingLiveTab } from "@/lib/modules/live/m11-subscription-billing";
import { syncSupportLiveTab } from "@/lib/modules/live/m16-sync-support";
import { analyticsReportsLiveTab } from "@/lib/modules/live/m14-analytics-reports";
import { auditSecurityLiveTab } from "@/lib/modules/live/m15-audit-security";
import { commandCenterLiveTab } from "@/lib/modules/live/m1-command-center";
import { schoolConfigurationLiveTab } from "@/lib/modules/live/m2-school-configuration";
import { attendanceLiveTab } from "@/lib/modules/live/m4-attendance";
import { scoreEntryResultsLiveTab } from "@/lib/modules/live/m5-score-entry-results";
import { feeManagementLiveTab } from "@/lib/modules/live/m10-fee-management";
import { studentRecordsLiveTab } from "@/lib/modules/live/m8-student-records";
import { teacherEmploymentTab } from "@/lib/modules/live/t18-employment";
import { teacherTrainingTab } from "@/lib/modules/live/t19-training";
import { teacherLessonNotesTab } from "@/lib/modules/live/t17-lesson-notes";
import { getTeacherTabContent } from "@/lib/modules/live/teacher-index";

/**
 * Where a module stops being written and starts being read.
 *
 * The sixteen modules are authored as data in `content/`, which is what made
 * them buildable before their endpoints existed. A module graduates by
 * registering a builder here; one with no builder keeps rendering exactly as it
 * did, so wiring the next module cannot disturb the other fifteen.
 */
export type LiveTabBuilder = (tabSlug: string, query?: Record<string, string | undefined>) => Promise<TabContent | null | undefined>;

const liveModules: Record<string, LiveTabBuilder> = {
  m1: commandCenterLiveTab,
  m2: schoolConfigurationLiveTab,
  m3: classTimetableLiveTab,
  m4: attendanceLiveTab,
  m5: scoreEntryResultsLiveTab,
  m6: reportCardsLiveTab,
  m7: staffAccessLiveTab,
  m8: studentRecordsLiveTab,
  m9: parentsGuardiansLiveTab,
  m10: feeManagementLiveTab,
  m11: subscriptionBillingLiveTab,
  m12: communicationCenterLiveTab,
  m13: approvalsWorkflowLiveTab,
  m14: analyticsReportsLiveTab,
  m15: auditSecurityLiveTab,
  m16: syncSupportLiveTab,
  // Leadership reads Lesson Notes through its Review and Coverage tabs only; they need nothing from the teacher workspace.
  m17: (tab, query) => teacherLessonNotesTab(tab, undefined, query ?? {}),
  // Leave, pay and learning belong to every employee. A member of staff who is not a teacher and has been given these reads them the same way.
  m18: (tab) => teacherEmploymentTab(tab, { persona: "subject-teacher" } as never, []),
  m19: (tab, query) => teacherTrainingTab(tab, query ?? {}),
};

/** Which modules read from the API today — used by tests and by the module page. */
export const liveModuleCodes = Object.keys(liveModules);

/**
 * A tab that could not read its own figures.
 *
 * It shows nothing rather than the authored example. Example figures look
 * exactly like real ones — that is the point of them — so a page that quietly
 * swapped a live total for a written one reads as a working integration
 * reporting a wrong number, and a school cannot tell the difference. Saying
 * "this did not load" is less useful than real data and far more useful than
 * plausible fiction.
 */
function couldNotLoad(reason: string): TabContent {
  return {
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "attention",
            title: "This page could not be loaded",
            body: `${reason} Nothing here has been replaced with example figures — try again, and if it keeps failing, raise it in Sync & Support.`,
          },
        ],
      },
    ],
  };
}

export async function getLiveTabContent(
  code: string,
  tabSlug: string,
  query?: Record<string, string | undefined>,
): Promise<TabContent | undefined> {
  // A teaching person's pages are their own, built from what they are assigned to.
  const own = await getTeacherTabContent(code, tabSlug, query);
  if (own) return own;

  const builder = liveModules[code];
  if (!builder) return undefined;

  try {
    // A builder returning nothing means "this tab is not wired yet", which is
    // not a failure: the page falls back to the authored tab with no banner.
    return (await builder(tabSlug, query)) ?? undefined;
  } catch (error) {
    return couldNotLoad(error instanceof Error ? error.message : "The request failed.");
  }
}
