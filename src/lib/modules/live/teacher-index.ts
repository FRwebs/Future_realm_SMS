import { getTeacherWorkspace, type TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { teacherMyDayTab } from "@/lib/modules/live/t1-my-day";
import { teacherCalendarTab } from "@/lib/modules/live/t2-calendar";
import { teacherAttendanceTab } from "@/lib/modules/live/t4-attendance";
import { teacherReportCardsTab } from "@/lib/modules/live/t6-report-cards";
import { teacherScoresTab } from "@/lib/modules/live/t5-scores";
import { teacherStudentsTab } from "@/lib/modules/live/t8-students";
import { teacherGuardiansTab } from "@/lib/modules/live/t9-guardians";
import { teacherMessagesTab } from "@/lib/modules/live/t12-messages";
import { teacherApprovalsTab } from "@/lib/modules/live/t13-approvals";
import { teacherSyncSupportTab } from "@/lib/modules/live/t16-sync-support";
import { teacherTrainingTab } from "@/lib/modules/live/t19-training";
import { teacherEmploymentTab } from "@/lib/modules/live/t18-employment";
import { teacherLessonNotesTab } from "@/lib/modules/live/t17-lesson-notes";
import { teacherTimetableTab } from "@/lib/modules/live/t3-timetable";
import type { TabContent } from "@/lib/modules/panels";

/**
 * Where a teaching person's modules are built.
 *
 * A teacher opens the same modules an administrator does, but each page is read through what they are assigned to — their arms,
 * their sheets, their own pay — so the content is its own, not the administrator's with rows taken away. A module with a builder
 * here is rendered for teachers by it; one without keeps the module's own page, which already scopes by who is signed in.
 *
 * A failure is shown as a failure. The administrator's pages fall back to written example figures so they can still be
 * demonstrated; a teacher must never be shown another school's example as if it were their own.
 */
export type TeacherTabBuilder = (tabSlug: string, me: TeacherWorkspaceView, permissions: string[], query: Record<string, string | undefined>) => Promise<TabContent | null | undefined>;

const builders: Record<string, TeacherTabBuilder> = {
  m1: (tab, me, permissions) => teacherMyDayTab(tab, me, permissions),
  m2: (tab) => teacherCalendarTab(tab),
  m3: (tab, me, permissions) => teacherTimetableTab(tab, me, permissions),
  m4: (tab, me, permissions, query) => teacherAttendanceTab(tab, me, permissions, query),
  m5: (tab, me, permissions) => teacherScoresTab(tab, me, permissions),
  m6: (tab, me) => teacherReportCardsTab(tab, me),
  m8: (tab, me, permissions) => teacherStudentsTab(tab, me, permissions),
  m9: (tab, me, permissions) => teacherGuardiansTab(tab, me, permissions),
  m12: (tab, me, _permissions, query) => teacherMessagesTab(tab, me, query),
  m13: (tab, me) => teacherApprovalsTab(tab, me),
  m16: (tab, me) => teacherSyncSupportTab(tab, me),
  m17: (tab, me, _permissions, query) => teacherLessonNotesTab(tab, me, query),
  m18: (tab, me, permissions) => teacherEmploymentTab(tab, me, permissions),
  m19: (tab, _me, _permissions, query) => teacherTrainingTab(tab, query),
};

export async function getTeacherTabContent(code: string, tabSlug: string, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  const builder = builders[code];
  if (!builder) return undefined;
  const session = await getServerSession();
  if (!session) return undefined;
  const me = await getTeacherWorkspace(session.role, session.schoolId);
  if (!me) return undefined;
  try {
    return await builder(tabSlug, me, await getServerPermissions(session), query);
  } catch (error) {
    return {
      rows: [{ cols: "1fr", panels: [{ type: "note", tone: "attention", title: "This page could not be loaded", body: `${error instanceof Error ? error.message : "The request failed."} Nothing here has been replaced with example figures — try again, and if it keeps failing, raise it in Sync & Support.` }] }],
    };
  }
}
