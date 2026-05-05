import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarDays,
  Clock3,
  Sparkles,
  Target,
} from "lucide-react";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type {
  CurriculumTopicView,
  SchemeOfWorkSummaryView,
  TeacherPortalView,
} from "@/lib/domain/types";

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function todayName() {
  return new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
}

export default async function TeacherContentOverviewPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/content")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, topics, summaries] = await Promise.all([
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
    apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum").catch(() => []),
    apiGet<SchemeOfWorkSummaryView[]>("/api/v1/scheme-of-work/my").catch(() => []),
  ]);

  const todaysPeriods = portal.weeklyTimetable.filter(
    (entry) => normalizeDay(entry.day) === normalizeDay(todayName()),
  );
  const activeTopics = topics.filter(
    (topic) => topic.progressStatus === "IN_PROGRESS" || topic.progressStatus === "TAUGHT",
  ).length;
  const coveredTopics = topics.filter((topic) => topic.progressStatus === "COMPLETED").length;
  const teachingLanes = Array.from(
    new Map(
      portal.assignedClasses
        .filter((item): item is typeof item & { subjectId: string; classId: string } => Boolean(item.subjectId && item.classId))
        .map((item) => [
          `${item.subjectId}:${item.classId}`,
          {
            key: `${item.subjectId}:${item.classId}`,
            subjectId: item.subjectId,
            classId: item.classId,
            subject: item.subject,
            className: item.className,
            learners: item.learners,
            pendingScores: item.pendingScores,
            nextAction: item.nextAction,
            coverage: summaries.find(
              (summary) => summary.subjectId === item.subjectId && summary.classId === item.classId,
            )?.coveragePercent,
            status: summaries.find(
              (summary) => summary.subjectId === item.subjectId && summary.classId === item.classId,
            )?.status,
          },
        ]),
    ).values(),
  ).sort((left, right) =>
    `${left.subject} ${left.className}`.localeCompare(`${right.subject} ${right.className}`),
  );

  const assignmentsDueSoon = [...(portal.assignments ?? [])]
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(18,33,23,0.12)] bg-gradient-to-br from-[rgb(18,33,23)] via-[#17392d] to-[#1c6b5c] p-6 text-white shadow-panel">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85">
              <Sparkles className="h-3.5 w-3.5" />
              Content Overview
            </div>
            <h2 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white">
              Teacher content command center
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/92">
              This is the front door for planning. See all teaching lanes, today&apos;s instructional
              pressure points, and where lesson prep meets weekly curriculum coverage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Teaching lanes
              </p>
              <p className="mt-2 text-3xl font-black text-white">{teachingLanes.length}</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Active topics
              </p>
              <p className="mt-2 text-3xl font-black text-white">{activeTopics}</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Covered
              </p>
              <p className="mt-2 text-3xl font-black text-white">{coveredTopics}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <article className="min-w-0 rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                Teaching lanes
              </p>
              <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
                Every subject-class workflow in one surface
              </h2>
            </div>
          <Link href="/portals/teacher/content/lesson-notes/planning" className="btn-secondary px-4">
              <BookOpen className="h-4 w-4" />
              Open planning studio
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {teachingLanes.map((lane) => (
              <article
                key={lane.key}
                className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4 transition hover:border-primary-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {lane.className}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{lane.subject}</h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {lane.learners} learners
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Coverage</p>
                    <p className="mt-2 text-xl font-black text-slate-900">
                      {lane.coverage ?? 0}%
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Status</p>
                    <p className="mt-2 text-sm font-bold text-slate-900">
                      {lane.status ?? "Not started"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Pending</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{lane.pendingScores}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">{lane.nextAction}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/portals/teacher/content/lesson-notes/planning?subjectId=${lane.subjectId}&classId=${lane.classId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                  >
                    Lesson notes
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/portals/teacher/content/scheme-of-work/coverage?subjectId=${lane.subjectId}&classId=${lane.classId}` as Route}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                  >
                    Scheme workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-700" />
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">
                Today&apos;s rhythm
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {todaysPeriods.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  No teaching periods scheduled for today.
                </div>
              ) : (
                todaysPeriods.slice(0, 5).map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[1.35rem] border border-slate-100 bg-slate-50/80 px-4 py-4"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {entry.time}
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{entry.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.className ?? "Assigned class"} · {entry.venue}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">
                Due soon
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {assignmentsDueSoon.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  No urgent assignment deadlines right now.
                </div>
              ) : (
                assignmentsDueSoon.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="rounded-[1.35rem] border border-slate-100 bg-slate-50/80 px-4 py-4"
                  >
                    <p className="text-sm font-bold text-slate-900">{assignment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.className} · {assignment.subject}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                      Due {new Date(assignment.dueAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Coverage matrix
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
              Scheme and curriculum health at a glance
            </h2>
          </div>
          <Link href={"/portals/teacher/content/scheme-of-work/coverage" as Route} className="btn-secondary px-4">
            <BookMarked className="h-4 w-4" />
            Open coverage workspace
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Class", "Subject", "Coverage", "Status", "Covered weeks", "Next week"].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {summaries.map((summary) => (
                <tr key={summary.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{summary.className}</td>
                  <td className="px-4 py-3 text-slate-900">{summary.subjectName}</td>
                  <td className="px-4 py-3 text-slate-600">{summary.coveragePercent}%</td>
                  <td className="px-4 py-3 text-slate-600">{summary.status}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {summary.coveredWeeks}/{summary.teachingWeeks}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{summary.nextWeek ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!summaries.length ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
            Scheme coverage data will appear here once lanes are initialized.
          </div>
        ) : null}
      </section>
    </div>
  );
}
import type { Route } from "next";
