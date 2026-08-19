import Link from "next/link";
import type { Route } from "next";
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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              Content Overview
            </div>
            <h2 className="mt-4 font-[var(--font-heading)] text-[26px] font-black tracking-tight text-[var(--color-text-primary)]">
              Teacher content command center
            </h2>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This is the front door for planning. See all teaching lanes, today&apos;s instructional
              pressure points, and where lesson prep meets weekly curriculum coverage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Teaching lanes
              </p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{teachingLanes.length}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Active topics
              </p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{activeTopics}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Covered
              </p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{coveredTopics}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <article className="surface-card min-w-0 p-5">
          <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-eyebrow">
                Teaching lanes
              </p>
              <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
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
                className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      {lane.className}
                    </p>
                    <h3 className="mt-2 text-[16px] font-bold text-[var(--color-text-primary)]">{lane.subject}</h3>
                  </div>
                  <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    {lane.learners} learners
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Coverage</p>
                    <p className="mt-2 text-[17px] font-black text-[var(--color-text-primary)]">
                      {lane.coverage ?? 0}%
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Status</p>
                    <p className="mt-2 text-[13px] font-bold text-[var(--color-text-primary)]">
                      {lane.status ?? "Not started"}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Pending</p>
                    <p className="mt-2 text-[17px] font-black text-[var(--color-text-primary)]">{lane.pendingScores}</p>
                  </div>
                </div>

                <p className="mt-4 text-[13px] text-[var(--color-text-secondary)]">{lane.nextAction}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/portals/teacher/content/lesson-notes/planning?subjectId=${lane.subjectId}&classId=${lane.classId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
                  >
                    Lesson notes
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/portals/teacher/content/scheme-of-work/coverage?subjectId=${lane.subjectId}&classId=${lane.classId}` as Route}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
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
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--color-text-accent)]" />
              <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                Today&apos;s rhythm
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {todaysPeriods.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-center text-[13px] text-[var(--color-text-secondary)]">
                  No teaching periods scheduled for today.
                </div>
              ) : (
                todaysPeriods.slice(0, 5).map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4"
                  >
                    <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {entry.time}
                    </div>
                    <p className="mt-2 text-[13px] font-bold text-[var(--color-text-primary)]">{entry.subject}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {entry.className ?? "Assigned class"} · {entry.venue}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: "var(--color-success)" }} />
              <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                Due soon
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {assignmentsDueSoon.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-center text-[13px] text-[var(--color-text-secondary)]">
                  No urgent assignment deadlines right now.
                </div>
              ) : (
                assignmentsDueSoon.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4"
                  >
                    <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{assignment.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {assignment.className} · {assignment.subject}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-warning)" }}>
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

      <section className="surface-card p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-eyebrow">
              Coverage matrix
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
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
            <thead className="bg-[var(--color-bg-subtle)]">
              <tr>
                {["Class", "Subject", "Coverage", "Status", "Covered weeks", "Next week"].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)] bg-[var(--color-bg-surface)]">
              {summaries.map((summary) => (
                <tr key={summary.id}>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{summary.className}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{summary.subjectName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{summary.coveragePercent}%</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{summary.status}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {summary.coveredWeeks}/{summary.teachingWeeks}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{summary.nextWeek ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!summaries.length ? (
          <div className="mt-5 rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
            Scheme coverage data will appear here once lanes are initialized.
          </div>
        ) : null}
      </section>
    </div>
  );
}
