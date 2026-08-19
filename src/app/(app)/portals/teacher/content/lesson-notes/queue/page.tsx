import type { Route } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock3, FileStack, Target } from "lucide-react";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { CurriculumTopicView, TeacherPortalView } from "@/lib/domain/types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function todayName() {
  return new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
}

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

function progressTone(progress: CurriculumTopicView["progressStatus"]) {
  switch (progress) {
    case "COMPLETED":
      return { background: "var(--color-success-dim)", color: "var(--color-success)" };
    case "TAUGHT":
      return { background: "var(--color-info-dim)", color: "var(--color-info)" };
    case "IN_PROGRESS":
      return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
    default:
      return { background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" };
  }
}

function progressLabel(progress: CurriculumTopicView["progressStatus"]) {
  switch (progress) {
    case "COMPLETED":
      return "Covered";
    case "TAUGHT":
      return "Taught";
    case "IN_PROGRESS":
      return "In progress";
    default:
      return "Queued";
  }
}

function truncate(value: string | undefined, length = 90) {
  if (!value) return "No supporting note added yet.";
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

export default async function TeacherLessonNotesQueuePage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/content/lesson-notes/queue")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const selectedSubjectId = normalizeQueryValue(resolvedSearch.subjectId);
  const selectedClassId = normalizeQueryValue(resolvedSearch.classId);

  const [portal, topics] = await Promise.all([
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
    apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum").catch(() => []),
  ]);

  const lanes = buildTeachingLanes(portal);
  const activeLane =
    lanes.find((lane) => lane.subjectId === selectedSubjectId && lane.classId === selectedClassId) ??
    lanes[0] ??
    null;

  const filteredTopics = activeLane
    ? topics.filter(
        (topic) => topic.subjectId === activeLane.subjectId && topic.classId === activeLane.classId,
      )
    : topics;
  const orderedTopics = [...filteredTopics].sort((left, right) => left.weekNumber - right.weekNumber);
  const backlog = orderedTopics.filter((topic) => topic.progressStatus !== "COMPLETED");
  const todayPeriods = portal.weeklyTimetable.filter(
    (entry) =>
      normalizeDay(entry.day) === normalizeDay(todayName()) &&
      (!activeLane ||
        (entry.subjectId === activeLane.subjectId && entry.classId === activeLane.classId)),
  );

  return (
    <div className="portal-page">
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-eyebrow">
              Teaching queue
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Weekly lesson backlog and prep board
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This view is optimized for pacing. It tells you what is still queued, what is live,
              and which weeks need coverage attention next.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>
              {backlog.length} topics still in motion
            </span>
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              {todayPeriods.length} periods today
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {lanes.map((lane) => {
            const active = activeLane?.key === lane.key;
            return (
              <Link
                key={lane.key}
                href={`/portals/teacher/content/lesson-notes/queue?subjectId=${lane.subjectId}&classId=${lane.classId}`}
                className={
                  active
                    ? "min-w-[220px] rounded-[10px] bg-[var(--color-accent-primary)] px-4 py-4 text-[var(--color-text-inverse)]"
                    : "min-w-[220px] rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-4 text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">
                  {lane.className}
                </p>
                <p className="mt-2 text-[14px] font-bold">{lane.subject}</p>
                <p className="mt-3 text-xs">{lane.nextAction}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <article className="surface-card min-w-0 p-5">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-default)] pb-4">
            <FileStack className="h-4 w-4 text-[var(--color-text-accent)]" />
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Topic queue
            </h2>
          </div>

          <div className="mt-5 grid gap-4">
            {backlog.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-12 text-center text-[13px] text-[var(--color-text-secondary)]">
                This lane is fully covered for now.
              </div>
            ) : (
              backlog.map((topic) => (
                <article
                  key={topic.id}
                  className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                          Week {topic.weekNumber}
                        </span>
                        <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={progressTone(topic.progressStatus)}>
                          {progressLabel(topic.progressStatus)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-[16px] font-bold text-[var(--color-text-primary)]">{topic.topic}</h3>
                    </div>
                    <Link
                      href={
                        activeLane
                          ? `/portals/teacher/content/lesson-notes/planning?subjectId=${activeLane.subjectId}&classId=${activeLane.classId}`
                          : "/portals/teacher/content/lesson-notes/planning"
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
                    >
                      Open planning
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                        Learning focus
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                        {truncate(topic.learningObjectives ?? topic.teacherNotes)}
                      </p>
                    </div>
                    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                        Support resources
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                        {truncate(topic.recommendedResources)}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--color-text-accent)]" />
              <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                Today&apos;s lane
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {todayPeriods.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-center text-[13px] text-[var(--color-text-secondary)]">
                  No periods in this lane today.
                </div>
              ) : (
                todayPeriods.map((entry) => (
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
                Next best move
              </h2>
            </div>
            <div className="mt-4 rounded-[10px] px-4 py-4" style={{ background: "var(--color-success-dim)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--color-success)" }}>
                {activeLane?.nextAction ?? "Review the next live teaching lane."}
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              <Link href="/portals/teacher/content/lesson-notes/planning" className="btn-secondary px-4">
                <BookOpen className="h-4 w-4" />
                Open planning studio
              </Link>
              <Link href={"/portals/teacher/content/scheme-of-work/coverage" as Route} className="btn-secondary px-4">
                <Target className="h-4 w-4" />
                Review coverage
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
