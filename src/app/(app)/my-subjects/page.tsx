import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { SchemeOfWorkTopicList } from "@/components/scheme-of-work/topic-list";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type {
  PortalSubjectOffering,
  PortalTimetableEntry,
  SchemeOfWorkDetailView,
  SchemeOfWorkSummaryView,
  StudentPortalView,
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
  sows,
  timetable,
}: {
  sows: SchemeOfWorkSummaryView[];
  timetable: PortalTimetableEntry[];
}) {
  const weekday = new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
  const todaysClasses = timetable.filter((entry) => entry.day.toLowerCase() === weekday.toLowerCase());
  const grouped = new Map<
    string,
    { subjectId: string; subjectName: string; subjectCode?: string; rows: SchemeOfWorkSummaryView[] }
  >();

  for (const row of sows) {
    const existing = grouped.get(row.subjectId);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    grouped.set(row.subjectId, {
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
      rows: [row],
    });
  }

  const subjects = Array.from(grouped.values());

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Teacher portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">My Subjects</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          Review your current class assignments, follow scheme-of-work coverage, and jump straight into weekly plans for each subject-class combination.
        </p>
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

      {subjects.map((subject) => {
        const averageCoverage =
          subject.rows.length === 0
            ? 0
            : Math.round(subject.rows.reduce((sum, row) => sum + row.coveragePercent, 0) / subject.rows.length);
        return (
          <section key={subject.subjectId} className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/92 shadow-panel">
            <div className="flex flex-col gap-4 border-b border-ink/8 bg-sand/50 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Subject</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">
                  {subject.subjectName}
                  {subject.subjectCode ? <span className="ml-2 text-sm font-semibold text-ink/45">{subject.subjectCode}</span> : null}
                </h2>
                <p className="mt-2 text-sm text-ink/58">{subject.rows.length} class assignment{subject.rows.length === 1 ? "" : "s"} this term.</p>
              </div>
              <div className="text-right">
                <p className={`font-[var(--font-heading)] text-3xl font-black ${progressTone(averageCoverage)}`}>{averageCoverage}%</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/42">average coverage</p>
              </div>
            </div>

            <TableCard
              title="Class schemes"
              description="Each class opens into the detailed weekly scheme-of-work workspace."
              items={subject.rows}
              columns={[
                {
                  key: "class",
                  header: "Class",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-ink">{row.className}</p>
                      <p className="text-xs text-ink/52">{row.level ?? "Class"}{row.arm ? ` · ${row.arm}` : ""}</p>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <SchemeOfWorkStatusBadge status={row.status} size="sm" />,
                },
                {
                  key: "coverage",
                  header: "Coverage",
                  render: (row) => (
                    <div>
                      <p className={`text-sm font-bold ${progressTone(row.coveragePercent)}`}>{row.coveragePercent}%</p>
                      <p className="text-xs text-ink/52">{row.coveredWeeks}/{row.teachingWeeks} teaching weeks</p>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <Link
                      href={`/my-subjects/${subject.subjectId}/classes/${row.classId}/scheme-of-work` as Route}
                      className="text-sm font-semibold text-brand-700 hover:text-brand-900"
                    >
                      Open SOW
                    </Link>
                  ),
                },
              ]}
            />
          </section>
        );
      })}
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

  const [sows, timetable] = await Promise.all([
    apiGet<SchemeOfWorkSummaryView[]>("/api/v1/scheme-of-work/my").catch(() => []),
    apiGet<PortalTimetableEntry[]>("/api/v1/teacher-portal/timetable").catch(() => []),
  ]);

  return <TeacherMySubjectsPage sows={sows} timetable={timetable} />;
}
