import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { getServerSession } from "@/lib/auth/session";
import { periodMarkPage, loadPeriodState } from "@/lib/modules/live/t4-attendance";
import { scrubForTeacher } from "@/lib/modules/live/teacher-scrub";
import { loadTrend, loadWeek, trendPage, weekPage } from "@/lib/modules/live/m4-log";
import { loadMarkState, markPage } from "@/lib/modules/live/m4-mark";
import { dayPage, loadCorrectionOptions, loadDay, loadOptions } from "@/lib/modules/live/m4-register";
import type { TabContent } from "@/lib/modules/panels";

/**
 * The pages Attendance opens from its tabs. Each is a server view: it checks the module is open to the
 * person asking, reads the page from the API, and hands it to the workspace.
 */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M04"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Page = TabContent & { crumb: { label: string; href: string } };

/** A teacher reaches these pages from their own registers; what they link to is filtered to what a teacher holds. */
async function forWhoever(content: Page, back: { label: string; href: string }): Promise<Page> {
  const session = await getServerSession();
  const teacher = session ? await getTeacherWorkspace(session.role, session.schoolId) : null;
  return teacher ? scrubForTeacher(content, { back }) : content;
}

function Workspace({ content }: { content: Page }) {
  return <ModuleWorkspace eyebrow="Attendance" title={content.title ?? "Attendance"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}

export async function DayView({ classId, date }: { classId: string; date?: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [day, options, correction] = await Promise.all([loadDay(classId, date).catch(() => null), loadOptions(), loadCorrectionOptions()]);
  if (!day) notFound();
  return <Workspace content={await forWhoever(dayPage(day, options, correction).content, { label: "Back to the register", href: "/attendance/register" })} />;
}

export async function MarkView({ classId, date }: { classId: string; date?: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const state = await loadMarkState(classId, date).catch(() => null);
  if (!state) notFound();
  return <Workspace content={await forWhoever(markPage(state).content, { label: "Back to my registers", href: "/attendance/mark" })} />;
}

export async function TrendView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [trend, options] = await Promise.all([loadTrend(classId).catch(() => null), loadOptions()]);
  if (!trend) notFound();
  return <Workspace content={await forWhoever(trendPage(trend, options).content, { label: "Back to the register", href: "/attendance/register" })} />;
}

export async function WeekView({ classId, start }: { classId: string; start?: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [week, options] = await Promise.all([loadWeek(classId, start).catch(() => null), loadOptions()]);
  if (!week) notFound();
  return <Workspace content={await forWhoever(weekPage(week, options).content, { label: "Back to the register", href: "/attendance/register" })} />;
}

/** One period's register: the subordinate register a subject teacher takes against the daily one. */
export async function PeriodMarkView({ classId, subjectId, period, date }: { classId: string; subjectId: string; period: string; date?: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const state = await loadPeriodState(classId, subjectId, period, date).catch(() => null);
  if (!state) notFound();
  return <Workspace content={periodMarkPage(state)} />;
}
