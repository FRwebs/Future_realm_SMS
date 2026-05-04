import Link from "next/link";
import type { Route } from "next";
import { BookOpen, ClipboardCheck, FileStack, GraduationCap, UploadCloud } from "lucide-react";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { AccessDenied } from "@/components/feedback/access-denied";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { SchemeOfWorkTopicList } from "@/components/scheme-of-work/topic-list";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type {
  PortalSubjectOffering,
  SchemeOfWorkDetailView,
  StudentPortalView,
  TeacherPortalView,
} from "@/lib/domain/types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function progressTone(percent?: number) {
  if ((percent ?? 0) >= 80) return "text-emerald-700";
  if ((percent ?? 0) >= 50) return "text-amber-700";
  return "text-rose-700";
}

function TeacherMySubjectsPage({
  portal,
}: {
  portal: TeacherPortalView;
}) {
  const timetable = portal.weeklyTimetable;
  const weekday = new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
  const todaysClasses = timetable.filter((entry) => entry.day.toLowerCase() === weekday.toLowerCase());
  const grouped = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      rows: Array<{
        classId: string;
        className: string;
        learners: number;
        pendingScores: number;
        nextAction: string;
      }>;
    }
  >();

  for (const row of portal.assignedClasses.filter((item) => item.subjectId && item.classId)) {
    const existing = grouped.get(row.subjectId as string);
    if (existing) {
      existing.rows.push({
        classId: row.classId as string,
        className: row.className,
        learners: row.learners,
        pendingScores: row.pendingScores,
        nextAction: row.nextAction,
      });
      continue;
    }
    grouped.set(row.subjectId as string, {
      subjectId: row.subjectId as string,
      subjectName: row.subject,
      rows: [
        {
          classId: row.classId as string,
          className: row.className,
          learners: row.learners,
          pendingScores: row.pendingScores,
          nextAction: row.nextAction,
        },
      ],
    });
  }

  const subjects = Array.from(grouped.values()).sort((left, right) => left.subjectName.localeCompare(right.subjectName));
  const totalAssignments = subjects.reduce((sum, subject) => sum + subject.rows.length, 0);
  const totalLearners = subjects.reduce(
    (sum, subject) => sum + subject.rows.reduce((subjectSum, row) => subjectSum + row.learners, 0),
    0,
  );
  const totalPendingScores = subjects.reduce(
    (sum, subject) =>
      sum + subject.rows.reduce((subjectSum, row) => subjectSum + row.pendingScores, 0),
    0,
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={"/portals/teacher" as Route} className="text-sm font-semibold text-brand-700">
          Back to teacher portal
        </Link>
        <p className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Teacher portal</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">My Subjects</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              This page is for your teaching workload. See every subject you handle, the classes attached to each subject, and move straight into score entry or assignment work without mixing it with form-class administration.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <article className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">Subjects</p>
              <p className="mt-2 text-2xl font-black text-ink">{subjects.length}</p>
            </article>
            <article className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Assignments</p>
              <p className="mt-2 text-2xl font-black text-ink">{totalAssignments}</p>
            </article>
            <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Pending scores</p>
              <p className="mt-2 text-2xl font-black text-ink">{totalPendingScores}</p>
            </article>
            <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Learners</p>
              <p className="mt-2 text-2xl font-black text-ink">{totalLearners}</p>
            </article>
          </div>
        </div>
      </section>

      {todaysClasses.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/88 p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]">
          <p className="text-sm font-bold text-ink">Today's timetable</p>
          <p className="mt-1 text-sm text-ink/58">{weekday} classes from your current schedule.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {todaysClasses.map((entry) => (
              <article key={entry.id} className="rounded-[1.4rem] border border-ink/8 bg-sand/55 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{entry.time}</p>
                <p className="mt-2 text-base font-bold text-ink">{entry.subject}</p>
                <p className="mt-1 text-sm text-ink/58">{entry.className ?? "Assigned class"}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {subjects.map((subject) => {
          const leadingClass = subject.rows[0];
          return (
            <article
              key={subject.subjectId}
              className="flex h-full flex-col rounded-[1.8rem] border border-white/70 bg-white/95 p-5 shadow-panel"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Teaching subject</p>
                  <h2 className="mt-2 text-xl font-bold text-ink">{subject.subjectName}</h2>
                  <p className="mt-2 text-sm text-ink/58">
                    {subject.rows.length} class assignment{subject.rows.length === 1 ? "" : "s"} this term.
                  </p>
                </div>
                <ActionMenu triggerLabel={`Quick actions for ${subject.subjectName}`}>
                  <ActionMenuLink href="/portals/teacher/assignments">
                    <span className="inline-flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" />
                      Create assignment
                    </span>
                  </ActionMenuLink>
                  <ActionMenuLink href="/portals/teacher/classes">
                    <span className="inline-flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      View class groups
                    </span>
                  </ActionMenuLink>
                  <ActionMenuLink href={`/portals/teacher/scores?subjectId=${subject.subjectId}${leadingClass?.classId ? `&classId=${leadingClass.classId}` : ""}`}>
                    <span className="inline-flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Record assessment
                    </span>
                  </ActionMenuLink>
                </ActionMenu>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[1.3rem] border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Learners</p>
                  <p className="mt-2 text-2xl font-black text-ink">
                    {subject.rows.reduce((sum, row) => sum + row.learners, 0)}
                  </p>
                </div>
                <div className="rounded-[1.3rem] border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pending scores</p>
                  <p className="mt-2 text-2xl font-black text-ink">
                    {subject.rows.reduce((sum, row) => sum + row.pendingScores, 0)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex-1 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold text-ink">Classes taking this subject</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {subject.rows.map((row) => (
                    <div key={row.classId} className="rounded-[1.2rem] border border-white bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{row.className}</p>
                          <p className="mt-1 text-xs text-ink/52">{row.learners} learners</p>
                        </div>
                        <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                          {row.pendingScores} pending
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{row.nextAction}</p>
                          <p className="text-xs text-ink/52">Use score entry and assignments from this subject workspace.</p>
                        </div>
                        <Link
                          href={`/portals/teacher/scores?subjectId=${subject.subjectId}&classId=${row.classId}` as Route}
                          className="text-sm font-semibold text-brand-700 hover:text-brand-900"
                        >
                          Open scores
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function StudentMySubjectsPage({
  portal,
  subjects,
  selectedSubject,
  selectedSow,
}: {
  portal: StudentPortalView;
  subjects: PortalSubjectOffering[];
  selectedSubject?: PortalSubjectOffering;
  selectedSow?: SchemeOfWorkDetailView;
}) {
  if (selectedSubject && selectedSow) {
    return (
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
          <Link href={"/my-subjects" as Route} className="text-sm font-semibold text-brand-700">Back to my subjects</Link>
          <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Student portal</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{selectedSow.subjectName}</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            {portal.className}
            {portal.departmentTrack ? ` · ${portal.departmentTrack}` : ""}
            {portal.term ? ` · ${portal.term}` : ""}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Coverage</p>
            <p className={`mt-3 text-3xl font-bold ${progressTone(selectedSow.stats.coveragePercent)}`}>{selectedSow.stats.coveragePercent}%</p>
          </article>
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Covered weeks</p>
            <p className="mt-3 text-3xl font-bold text-ink">{selectedSow.stats.coveredWeeks}</p>
          </article>
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Teaching weeks</p>
            <p className="mt-3 text-3xl font-bold text-ink">{selectedSow.stats.teachingWeeks}</p>
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-brand-100 bg-brand-50/70 p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]">
          <p className="text-sm font-bold text-ink">What you are learning this term</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Use this outline to revise what has already been taught and prepare ahead for upcoming topics, tests, assignments, and examinations.
          </p>
        </section>

        <SchemeOfWorkTopicList topics={selectedSow.topics} mode="student" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Student portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">My Subjects</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          {portal.className}
          {portal.departmentTrack ? ` · ${portal.departmentTrack}` : ""}
          {portal.term ? ` · ${portal.term}` : ""}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Subjects</p>
          <p className="mt-3 text-3xl font-bold text-ink">{subjects.length}</p>
        </article>
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Class</p>
          <p className="mt-3 text-lg font-bold text-ink">{portal.className}</p>
        </article>
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Department / Track</p>
          <p className="mt-3 text-lg font-bold text-ink">{portal.departmentTrack ?? "General"}</p>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <article key={subject.id} className="rounded-[1.6rem] border border-white/70 bg-white/92 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{subject.code ?? "Subject"}</p>
            <h2 className="mt-3 text-xl font-bold text-ink">{subject.name}</h2>
            <p className="mt-2 text-sm text-ink/58">Teacher: {subject.teacherName ?? "To be assigned"}</p>
            <p className="mt-1 text-sm text-ink/52">Track: {subject.track ?? subject.departmentName ?? "General"}</p>
            <div className="mt-4 flex items-center justify-between">
              <SchemeOfWorkStatusBadge status={subject.schemeStatus ?? "DRAFT"} size="sm" />
              <span className={`text-sm font-bold ${progressTone(subject.coveragePercent)}`}>{subject.coveragePercent ?? 0}%</span>
            </div>
            <p className="mt-2 text-xs text-ink/52">{subject.coveredWeeks ?? 0}/{subject.teachingWeeks ?? 0} teaching weeks covered</p>
            <Link
              href={`/my-subjects?subjectId=${subject.id}` as Route}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              View SOW
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export default async function MySubjectsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/my-subjects"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const subjectId = normalizeSearchValue(resolvedSearch.subjectId);

  if (session.role === "STUDENT") {
    const [portal, subjects] = await Promise.all([
      apiGet<StudentPortalView>("/api/v1/student-portal/dashboard"),
      apiGet<PortalSubjectOffering[]>("/api/v1/student-portal/subjects"),
    ]);
    const selectedSubject = subjects.find((subject) => subject.id === subjectId);
    const selectedSow = selectedSubject
      ? await apiGet<SchemeOfWorkDetailView>(`/api/v1/student-portal/subjects/${selectedSubject.id}/scheme-of-work`).catch(() => undefined)
      : undefined;

    return (
      <StudentMySubjectsPage
        portal={portal}
        subjects={subjects}
        selectedSubject={selectedSubject}
        selectedSow={selectedSow}
      />
    );
  }

  const portal = await apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard");
  return <TeacherMySubjectsPage portal={portal} />;
}
