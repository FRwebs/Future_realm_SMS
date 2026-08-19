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
  if ((percent ?? 0) >= 80) return { color: "var(--color-success)" };
  if ((percent ?? 0) >= 50) return { color: "var(--color-warning)" };
  return { color: "var(--color-danger)" };
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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/teacher" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          Back to teacher portal
        </Link>
        <p className="mt-5 section-eyebrow">Teacher portal</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My Subjects</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This page is for your teaching workload. See every subject you handle, the classes attached to each subject, and move straight into score entry or assignment work without mixing it with form-class administration.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Subjects</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{subjects.length}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Assignments</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{totalAssignments}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Pending scores</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{totalPendingScores}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Learners</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{totalLearners}</p>
            </article>
          </div>
        </div>
      </section>

      {todaysClasses.length ? (
        <section className="surface-card p-5">
          <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Today's timetable</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{weekday} classes from your current schedule.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {todaysClasses.map((entry) => (
              <article key={entry.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{entry.time}</p>
                <p className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">{entry.subject}</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{entry.className ?? "Assigned class"}</p>
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
              className="surface-card flex h-full flex-col p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Teaching subject</p>
                  <h2 className="mt-2 text-[18px] font-bold text-[var(--color-text-primary)]">{subject.subjectName}</h2>
                  <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)]">
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
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Learners</p>
                  <p className="mt-2 text-[18px] font-black text-[var(--color-text-primary)]">
                    {subject.rows.reduce((sum, row) => sum + row.learners, 0)}
                  </p>
                </div>
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-warning)]">Pending scores</p>
                  <p className="mt-2 text-[18px] font-black text-[var(--color-text-primary)]">
                    {subject.rows.reduce((sum, row) => sum + row.pendingScores, 0)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex-1 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Classes taking this subject</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {subject.rows.map((row) => (
                    <div key={row.classId} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)]">{row.className}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{row.learners} learners</p>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-semibold"
                          style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
                        >
                          {row.pendingScores} pending
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text-primary)]">{row.nextAction}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Use score entry and assignments from this subject workspace.</p>
                        </div>
                        <Link
                          href={`/portals/teacher/scores?subjectId=${subject.subjectId}&classId=${row.classId}` as Route}
                          className="text-sm font-semibold text-[var(--color-text-accent)] hover:opacity-80"
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
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <Link href={"/my-subjects" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to my subjects</Link>
          <p className="mt-4 section-eyebrow">Student portal</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{selectedSow.subjectName}</h1>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {portal.className}
            {portal.departmentTrack ? ` · ${portal.departmentTrack}` : ""}
            {portal.term ? ` · ${portal.term}` : ""}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Coverage</p>
            <p className="mt-3 text-[22px] font-bold" style={progressTone(selectedSow.stats.coveragePercent)}>{selectedSow.stats.coveragePercent}%</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Covered weeks</p>
            <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{selectedSow.stats.coveredWeeks}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Teaching weeks</p>
            <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{selectedSow.stats.teachingWeeks}</p>
          </article>
        </section>

        <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-5">
          <p className="text-[13px] font-bold text-[var(--color-text-primary)]">What you are learning this term</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Use this outline to revise what has already been taught and prepare ahead for upcoming topics, tests, assignments, and examinations.
          </p>
        </section>

        <SchemeOfWorkTopicList topics={selectedSow.topics} mode="student" />
      </div>
    );
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Student portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My Subjects</h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {portal.className}
          {portal.departmentTrack ? ` · ${portal.departmentTrack}` : ""}
          {portal.term ? ` · ${portal.term}` : ""}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Subjects</p>
          <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{subjects.length}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Class</p>
          <p className="mt-3 text-lg font-bold text-[var(--color-text-primary)]">{portal.className}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Department / Track</p>
          <p className="mt-3 text-lg font-bold text-[var(--color-text-primary)]">{portal.departmentTrack ?? "General"}</p>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <article key={subject.id} className="surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">{subject.code ?? "Subject"}</p>
            <h2 className="mt-3 text-[18px] font-bold text-[var(--color-text-primary)]">{subject.name}</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Teacher: {subject.teacherName ?? "To be assigned"}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Track: {subject.track ?? subject.departmentName ?? "General"}</p>
            <div className="mt-4 flex items-center justify-between">
              <SchemeOfWorkStatusBadge status={subject.schemeStatus ?? "DRAFT"} size="sm" />
              <span className="text-sm font-bold" style={progressTone(subject.coveragePercent)}>{subject.coveragePercent ?? 0}%</span>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{subject.coveredWeeks ?? 0}/{subject.teachingWeeks ?? 0} teaching weeks covered</p>
            <Link
              href={`/my-subjects?subjectId=${subject.id}` as Route}
              className="btn-primary mt-5 w-full"
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
