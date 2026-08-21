import Link from "next/link";
import {
  ArrowLeft,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Layers3,
  Sparkles,
  Target,
} from "lucide-react";

import { InitializeSchemeButton } from "@/components/scheme-of-work/initialize-button";
import { SchemeOfWorkDetailClient } from "@/components/scheme-of-work/scheme-of-work-detail-client";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import type {
  SchemeOfWorkDetailView,
  SchemeOfWorkSummaryView,
  TeacherPortalView,
} from "@/lib/domain/types";

type TeachingLane = {
  key: string;
  subjectId: string;
  classId: string;
  subject: string;
  className: string;
  learners: number;
  pendingScores: number;
  nextAction: string;
};

function buildTeachingLanes(portal: TeacherPortalView): TeachingLane[] {
  return Array.from(
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
          },
        ]),
    ).values(),
  ).sort((left, right) =>
    `${left.subject} ${left.className}`.localeCompare(`${right.subject} ${right.className}`),
  );
}

function coverageTone(percent: number) {
  if (percent >= 80) return "text-[var(--color-success)]";
  if (percent >= 50) return "text-[var(--color-warning)]";
  return "text-[var(--color-danger)]";
}

export function TeacherSchemeOfWorkWorkspace({
  portal,
  summaries,
  activeSummary,
  detail,
  requestedSubjectId,
  requestedClassId,
}: {
  portal: TeacherPortalView;
  summaries: SchemeOfWorkSummaryView[];
  activeSummary: SchemeOfWorkSummaryView | null;
  detail: SchemeOfWorkDetailView | null;
  requestedSubjectId?: string;
  requestedClassId?: string;
}) {
  const lanes = buildTeachingLanes(portal);
  const existingLaneKeys = new Set(summaries.map((item) => `${item.subjectId}:${item.classId}`));
  const missingLanes = lanes.filter((lane) => !existingLaneKeys.has(lane.key));
  const requestedLane =
    lanes.find((lane) => lane.subjectId === requestedSubjectId && lane.classId === requestedClassId) ??
    null;

  const approvedCount = summaries.filter((item) => item.status === "APPROVED").length;
  const submittedCount = summaries.filter((item) => item.status === "SUBMITTED").length;
  const averageCoverage = summaries.length
    ? Math.round(summaries.reduce((sum, item) => sum + item.coveragePercent, 0) / summaries.length)
    : 0;

  return (
    <div className="portal-page">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[rgba(18,33,23,0.12)] bg-gradient-to-br from-[rgb(18,33,23)] via-[#183a2d] to-[#18695a] p-6 md:p-7 text-white">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
          <div>
            <Link
              href="/portals/teacher"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[rgba(255,255,255,0.92)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to teacher portal
            </Link>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.15)] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,255,255,0.85)]">
              <Sparkles className="h-3.5 w-3.5" />
              Coverage command center
            </div>
            <h1 className="mt-4 font-[var(--font-heading)] text-[26px] font-black tracking-tight text-white">
              Scheme of Work
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.92)]">
              Review term coverage lane by lane, mark taught weeks, submit for approval, and keep
              curriculum delivery anchored to the real classroom workload.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <article className="rounded-[1.5rem] border border-[rgba(255,255,255,0.15)] bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Active schemes
              </p>
              <p className="mt-2 text-3xl font-black text-white">{summaries.length}</p>
              <p className="mt-1 text-xs text-white/90">Live subject-class lanes</p>
            </article>
            <article className="rounded-[1.5rem] border border-[rgba(255,255,255,0.15)] bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Avg coverage
              </p>
              <p className="mt-2 text-3xl font-black text-white">{averageCoverage}%</p>
              <p className="mt-1 text-xs text-white/90">Across all teaching lanes</p>
            </article>
            <article className="rounded-[1.5rem] border border-[rgba(255,255,255,0.15)] bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Approved
              </p>
              <p className="mt-2 text-3xl font-black text-white">{approvedCount}</p>
              <p className="mt-1 text-xs text-white/90">Submitted lanes cleared</p>
            </article>
          </div>
        </div>
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">
              Scheme lanes
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Every subject-class track in one board
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-warning)]">
              {submittedCount} awaiting review
            </span>
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              {missingLanes.length} not initialized
            </span>
          </div>
        </div>

        {summaries.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {summaries.map((summary) => {
              const active = activeSummary?.id === summary.id;
              return (
                <Link
                  key={summary.id}
                  href={`/portals/teacher/content/scheme-of-work?sow=${summary.id}`}
                  className={
                    active
                      ? "min-w-0 overflow-hidden rounded-[10px] bg-[rgb(18,33,23)] p-4 text-white"
                      : "min-w-0 overflow-hidden rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-inherit/70">
                        {summary.className}
                      </p>
                      <h3 className="mt-2 break-words text-lg font-bold">{summary.subjectName}</h3>
                    </div>
                    <SchemeOfWorkStatusBadge status={summary.status} size="sm" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-inherit/60">
                        Coverage
                      </p>
                      <p className="mt-2 text-xl font-black">{summary.coveragePercent}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-inherit/60">
                        Weeks
                      </p>
                      <p className="mt-2 text-xl font-black">{summary.coveredWeeks}/{summary.teachingWeeks}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-inherit/60">
                        Next
                      </p>
                      <p className="mt-2 text-xl font-black">{summary.nextWeek ?? "-"}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[14px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-12 text-center">
            <BookMarked className="mx-auto h-10 w-10 text-[var(--color-accent-primary)]" />
            <p className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">No scheme has been initialized yet</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Start one from any teaching lane below to turn your timetable into a properly tracked
              weekly teaching plan.
            </p>
          </div>
        )}
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid min-w-0 gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--color-success)]" />
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                Coverage snapshot
              </h2>
            </div>
            {activeSummary ? (
              <div className="mt-4 grid gap-3">
                <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Current lane
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                    {activeSummary.subjectName} · {activeSummary.className}
                  </p>
                </article>
                <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-success)]">
                    Coverage pace
                  </p>
                  <p className={`mt-2 text-[22px] font-bold ${coverageTone(activeSummary.coveragePercent)}`}>
                    {activeSummary.coveragePercent}%
                  </p>
                </article>
                <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Next action
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                    {lanes.find((lane) => lane.subjectId === activeSummary.subjectId && lane.classId === activeSummary.classId)?.nextAction ??
                      "Keep weekly coverage moving."}
                  </p>
                </article>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                Pick a lane to view its detailed weekly scheme, coverage log, and approval state.
              </p>
            )}
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--color-text-accent)]" />
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                Uninitialized lanes
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {requestedLane && !existingLaneKeys.has(requestedLane.key) ? (
                <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    {requestedLane.subject} · {requestedLane.className}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    This teaching lane has not been initialized yet. Start the scheme shell and it
                    will appear in your main coverage board immediately.
                  </p>
                  <div className="mt-4">
                    <InitializeSchemeButton
                      subjectId={requestedLane.subjectId}
                      classId={requestedLane.classId}
                      label="Initialize this lane"
                    />
                  </div>
                </article>
              ) : null}

              {missingLanes.length === 0 && !requestedLane ? (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  Every teaching lane already has a live scheme.
                </div>
              ) : null}

              {missingLanes
                .filter((lane) => lane.key !== requestedLane?.key)
                .slice(0, 4)
                .map((lane) => (
                  <article
                    key={lane.key}
                    className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {lane.subject} · {lane.className}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{lane.learners} learners</p>
                    <div className="mt-4">
                      <InitializeSchemeButton
                        subjectId={lane.subjectId}
                        classId={lane.classId}
                        label="Initialize"
                      />
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--color-warning)]" />
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                Teaching links
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <Link
                href="/portals/teacher/content/lesson-notes"
                className="flex items-center justify-between rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
              >
                Open lesson notes
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              </Link>
              <Link
                href="/portals/teacher/timetable"
                className="flex items-center justify-between rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
              >
                Return to timetable
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              </Link>
            </div>
          </section>
        </aside>

        <article className="min-w-0 overflow-hidden">
          {detail ? (
            <SchemeOfWorkDetailClient
              initialSow={detail}
              isAssignedTeacher={Boolean(portal.teacherId) && detail.teacherId === portal.teacherId}
            />
          ) : (
            <section className="surface-card p-8">
              <div className="mx-auto max-w-2xl text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--color-success)]" />
                <h2 className="mt-4 font-[var(--font-heading)] text-[26px] font-bold text-[var(--color-text-primary)]">
                  Pick a scheme lane to continue
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Once you choose a lane above, this panel turns into your live weekly scheme editor
                  with topic coverage, submission, and approval controls.
                </p>
              </div>
            </section>
          )}
        </article>
      </section>
    </div>
  );
}
