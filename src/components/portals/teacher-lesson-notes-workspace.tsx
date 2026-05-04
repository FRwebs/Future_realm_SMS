import Link from "next/link";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  FilePenLine,
  Layers3,
  Sparkles,
  Target,
} from "lucide-react";

import type { CurriculumTopicView, TeacherPortalView } from "@/lib/domain/types";

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

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function todayName() {
  return new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
}

function truncate(value: string | undefined, length = 120) {
  if (!value) return "No note has been added yet for this planning block.";
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

function progressTone(progress: CurriculumTopicView["progressStatus"]) {
  switch (progress) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "TAUGHT":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "IN_PROGRESS":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
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

export function TeacherLessonNotesWorkspace({
  portal,
  topics,
  selectedSubjectId,
  selectedClassId,
}: {
  portal: TeacherPortalView;
  topics: CurriculumTopicView[];
  selectedSubjectId?: string;
  selectedClassId?: string;
}) {
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
  const todayLessons = portal.weeklyTimetable.filter(
    (entry) =>
      normalizeDay(entry.day) === normalizeDay(todayName()) &&
      (!activeLane ||
        (entry.subjectId === activeLane.subjectId && entry.classId === activeLane.classId)),
  );
  const upcomingAssignments = [...(portal.assignments ?? [])]
    .filter(
      (assignment) =>
        !activeLane ||
        (assignment.subjectId === activeLane.subjectId && assignment.classId === activeLane.classId),
    )
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
    .slice(0, 4);

  const completedTopics = orderedTopics.filter((topic) => topic.progressStatus === "COMPLETED").length;
  const activeTopics = orderedTopics.filter((topic) =>
    topic.progressStatus === "IN_PROGRESS" || topic.progressStatus === "TAUGHT",
  ).length;
  const completionRate = orderedTopics.length
    ? Math.round((completedTopics / orderedTopics.length) * 100)
    : 0;

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(18,33,23,0.12)] bg-gradient-to-br from-[rgb(18,33,23)] via-[#183a2d] to-[#1e6d5e] p-6 text-white shadow-panel">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <Link
              href="/portals/teacher"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/92"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to teacher portal
            </Link>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85">
              <Sparkles className="h-3.5 w-3.5" />
              Teaching content studio
            </div>
            <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white">
              Lesson Notes
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/92">
              Build every lesson from a clean teaching lane. Today&apos;s periods, current curriculum
              coverage, assignment follow-through, and scheme progress are lined up in one premium
              planning workspace.
            </p>
            {activeLane ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/92">
                  {activeLane.subject}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/82">
                  {activeLane.className}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Coverage
              </p>
              <p className="mt-2 text-3xl font-black text-white">{completionRate}%</p>
              <p className="mt-1 text-xs text-white/90">Lesson track completed</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Active topics
              </p>
              <p className="mt-2 text-3xl font-black text-white">{activeTopics}</p>
              <p className="mt-1 text-xs text-white/90">Live planning lanes</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                Today
              </p>
              <p className="mt-2 text-3xl font-black text-white">{todayLessons.length}</p>
              <p className="mt-1 text-xs text-white/90">Periods in this lane</p>
            </article>
          </div>
        </div>
      </section>

      <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">
              Teaching lanes
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
              Move by subject and class, not by guesswork
            </h2>
          </div>
          <Link
            href={
              activeLane
                ? `/portals/teacher/content/scheme-of-work?subjectId=${activeLane.subjectId}&classId=${activeLane.classId}`
                : "/portals/teacher/content/scheme-of-work"
            }
            className="btn-secondary px-4"
          >
            <BookMarked className="h-4 w-4" />
            Open scheme of work
          </Link>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {lanes.map((lane) => {
            const active = activeLane?.key === lane.key;
            return (
              <Link
                key={lane.key}
                href={`/portals/teacher/content/lesson-notes?subjectId=${lane.subjectId}&classId=${lane.classId}`}
                className={
                  active
                    ? "min-w-[220px] rounded-[1.5rem] bg-[rgb(18,33,23)] px-4 py-4 text-white shadow-sm"
                    : "min-w-[220px] rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-slate-800 transition hover:border-primary-200 hover:bg-primary-50"
                }
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-inherit/70">
                  {lane.className}
                </p>
                <p className="mt-2 text-base font-bold">{lane.subject}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span>{lane.learners} learners</span>
                  <span>{lane.pendingScores} pending scores</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <article className="min-w-0 rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                Lesson notebook queue
              </p>
              <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
                What you are teaching next
              </h2>
              <p className="mt-2 text-sm text-ink/62">
                Structured around the lane you selected, with objectives, resources, and follow-up
                notes ready to scan before class.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {completedTopics} covered
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {orderedTopics.length - completedTopics} still in queue
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {orderedTopics.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-brand-500" />
                <p className="mt-4 text-lg font-semibold text-ink">No curriculum items yet</p>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  This lane does not have curriculum coverage data yet. Open the scheme workspace to
                  initialize or expand planning.
                </p>
              </div>
            ) : (
              orderedTopics.slice(0, 8).map((topic) => (
                <article
                  key={topic.id}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4 transition hover:border-primary-200 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Week {topic.weekNumber}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${progressTone(topic.progressStatus)}`}>
                          {progressLabel(topic.progressStatus)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-slate-950">{topic.topic}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {truncate(topic.learningObjectives ?? topic.teacherNotes)}
                      </p>
                    </div>
                    <Link
                      href={
                        activeLane
                          ? `/portals/teacher/content/scheme-of-work?subjectId=${activeLane.subjectId}&classId=${activeLane.classId}`
                          : "/portals/teacher/content/scheme-of-work"
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                    >
                      Deep dive
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Resources
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {truncate(topic.recommendedResources, 80)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Teacher note
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{truncate(topic.teacherNotes, 80)}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Homework cue
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {truncate(topic.assignmentNote, 80)}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-700" />
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">
                Today&apos;s lesson docket
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {todayLessons.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  No periods in this lane today.
                </div>
              ) : (
                todayLessons.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[1.4rem] border border-slate-100 bg-slate-50/70 px-4 py-4"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {entry.time || `${entry.startsAt ?? ""} - ${entry.endsAt ?? ""}`.trim()}
                    </div>
                    <p className="mt-3 text-base font-bold text-slate-950">{entry.subject}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.className ?? activeLane?.className ?? "Assigned class"} · {entry.venue}
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
                Planning signals
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <article className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Next action
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-900">
                  {activeLane?.nextAction ?? "Review your teaching queue."}
                </p>
              </article>

              {upcomingAssignments.map((assignment) => (
                <article
                  key={assignment.id}
                  className="rounded-[1.35rem] border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Assignment due
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{assignment.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {assignment.className} · {assignment.subject}
                  </p>
                </article>
              ))}

              {!upcomingAssignments.length ? (
                <article className="rounded-[1.35rem] border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Assignment pulse
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    No imminent assignment deadlines in this lane.
                  </p>
                </article>
              ) : null}
            </div>
          </section>
        </aside>
      </section>

      <section className="rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Coverage board
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
              Full planning map
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            <Layers3 className="h-4 w-4" />
            {orderedTopics.length} topic{orderedTopics.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Week", "Topic", "Progress", "Resources", "Assignment", "Actual date"].map((heading) => (
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
              {orderedTopics.map((topic) => (
                <tr key={topic.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{topic.weekNumber}</td>
                  <td className="px-4 py-3 text-slate-900">{topic.topic}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${progressTone(topic.progressStatus)}`}>
                      {progressLabel(topic.progressStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{truncate(topic.recommendedResources, 60)}</td>
                  <td className="px-4 py-3 text-slate-600">{truncate(topic.assignmentNote, 60)}</td>
                  <td className="px-4 py-3 text-slate-600">{topic.actualDateTaught ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[1.85rem] border border-dashed border-slate-200 bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Next move
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
              Turn planning into classroom action
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
              Move straight into the scheme editor to mark coverage, tighten weekly flow, and keep
              the lesson record aligned with what you actually teach.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={
                activeLane
                  ? `/portals/teacher/content/scheme-of-work?subjectId=${activeLane.subjectId}&classId=${activeLane.classId}`
                  : "/portals/teacher/content/scheme-of-work"
              }
              className="btn-primary px-5"
            >
              <FilePenLine className="h-4 w-4" />
              Open scheme workspace
            </Link>
            <Link href="/portals/teacher/timetable" className="btn-secondary px-5">
              <CalendarDays className="h-4 w-4" />
              Back to live timetable
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
