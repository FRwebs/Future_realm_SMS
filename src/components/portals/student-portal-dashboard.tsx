import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { StudentPortalView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const quickLinks = [
  { href: "/portals/student/profile", label: "My profile" },
  { href: "/portals/student/attendance", label: "Attendance" },
  { href: "/portals/student/results", label: "Results" },
  { href: "/portals/student/curriculum", label: "Scheme of Work" },
  { href: "/portals/student/timetable", label: "Timetable" },
  { href: "/portals/student/assignments", label: "Assignments" },
  { href: "/portals/student/fees", label: "Fees" },
  { href: "/portals/student/services", label: "Services" },
  { href: "/portals/student/announcements", label: "Announcements" },
  { href: "/portals/student/notifications", label: "Notifications" },
] as const;

function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p>
      ) : null}
    </div>
  );
}

export function StudentPortalDashboard({
  portal,
}: {
  portal: StudentPortalView;
}) {
  const attendanceRate = portal.attendance?.summary.attendanceRate ?? 0;
  const lowAttendanceWarning =
    portal.attendance?.summary.lowAttendanceWarning ?? null;

  return (
    <div className="grid gap-6 xl:gap-7">
      <DashboardCard>
        <div className="border-b border-ink/5 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(255,255,255,0.92),rgba(250,245,235,0.95))] p-6 md:p-7">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
            Student Portal
          </p>

          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold tracking-tight text-ink">
            {portal.headline}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
            {portal.studentName} can see the school-week timetable, term-by-term
            result history, finance reminders, announcements, and personal
            profile context in one secure student-only view.
          </p>

          <div className="mt-6 grid gap-3 text-sm text-ink/70 md:grid-cols-2 xl:grid-cols-4">
            <p className="rounded-2xl border border-ink/8 bg-white/70 px-4 py-3 shadow-sm">
              <span className="font-semibold text-ink">Class:</span>{" "}
              {portal.className}
            </p>
            <p className="rounded-2xl border border-ink/8 bg-white/70 px-4 py-3 shadow-sm">
              <span className="font-semibold text-ink">Admission no:</span>{" "}
              {portal.admissionNumber ?? "Not recorded"}
            </p>
            <p className="rounded-2xl border border-ink/8 bg-white/70 px-4 py-3 shadow-sm">
              <span className="font-semibold text-ink">Session:</span>{" "}
              {portal.session ?? "Current"}
            </p>
            <p className="rounded-2xl border border-ink/8 bg-white/70 px-4 py-3 shadow-sm">
              <span className="font-semibold text-ink">Term:</span>{" "}
              {portal.term ?? "Current"}
            </p>
          </div>
        </div>

        <div className="p-6 md:p-7">
          <div className="grid gap-4 md:grid-cols-3">
            {portal.stats.map((stat) => (
              <article
                key={stat.label}
                className="group rounded-[1.5rem] border border-ink/6 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                  {stat.label}
                </p>
                <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-ink">
                  {stat.value}
                </p>
              </article>
            ))}
          </div>

        
        </div>
      </DashboardCard>

      <section className="grid gap-6 xl:grid-cols-3">
        <DashboardCard>
          <div className="p-6">
            <SectionHeader
              title="Attendance watch"
              description="Current summary across marked school days."
            />

            <p className="mt-5 font-[var(--font-heading)] text-4xl font-bold tracking-tight text-ink">
              {attendanceRate}%
            </p>

            {lowAttendanceWarning ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {lowAttendanceWarning}
              </p>
            ) : (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                Attendance is within the safe range.
              </p>
            )}
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="p-6">
            <SectionHeader title="Latest result" />

            {portal.latestResult ? (
              <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/72">
                <div className="rounded-2xl border border-ink/8 bg-sand/45 px-4 py-3">
                  <p className="font-semibold text-ink">
                    {portal.latestResult.session} · {portal.latestResult.term}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                      Average
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {portal.latestResult.average.toFixed(1)}%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                      Grade
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {portal.latestResult.grade}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                      Position
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {portal.latestResult.position ?? "Not published"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-ink/65">
                No published result is available yet.
              </p>
            )}
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="p-6">
            <SectionHeader title="Learning tasks" />

            <p className="mt-4 text-sm leading-6 text-ink/65">
              {portal.assignments?.length
                ? `${portal.assignments.length} assignment or study task item(s) available.`
                : "No assignment module items are currently assigned."}
            </p>

            <Link
              href="/portals/student/assignments"
              className="mt-5 inline-flex rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-sand/60"
            >
              View assignments
            </Link>
          </div>
        </DashboardCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="This week's timetable"
          description={`${portal.className} timetable for the current school week.`}
          items={
            portal.timetablePreview?.length
              ? portal.timetablePreview
              : portal.weeklyTimetable.slice(0, 5)
          }
          columns={[
            { key: "day", header: "Day", render: (item) => item.day },
            { key: "time", header: "Time", render: (item) => item.time },
            {
              key: "subject",
              header: "Subject",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.subject}</p>
                  <p className="text-xs text-ink/55">{item.teacherName}</p>
                </div>
              ),
            },
            { key: "venue", header: "Venue", render: (item) => item.venue },
          ]}
        />

        <TableCard
          title="Finance reminders"
          description="Current invoices and what is still outstanding."
          items={portal.finance.slice(0, 5)}
          columns={[
            { key: "title", header: "Invoice", render: (item) => item.title },
            {
              key: "amount",
              header: "Total",
              render: (item) => formatCurrency(item.amount),
            },
            {
              key: "balance",
              header: "Balance",
              render: (item) => formatCurrency(item.balance),
            },
            {
              key: "dueOn",
              header: "Due",
              render: (item) => formatDate(item.dueOn),
            },
          ]}
        />
      </section>

      <DashboardCard>
        <div className="p-6">
          <SectionHeader title="Result history" />

          <div className="mt-5 grid gap-4">
            {portal.resultHistory.slice(0, 3).map((result) => (
              <article
                key={result.id}
                className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-ink">
                      {result.session} · {result.term}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">
                      Published {formatDate(result.publishedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-ink/72">
                    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                      Average {result.average.toFixed(1)}%
                    </span>
                    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                      Grade {result.grade}
                    </span>
                    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                      Position {result.position ?? "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {result.subjects.slice(0, 6).map((subject) => (
                    <div
                      key={subject.subject}
                      className="rounded-2xl border border-ink/8 bg-white px-4 py-3 text-sm shadow-sm"
                    >
                      <p className="font-semibold text-ink">
                        {subject.subject}
                      </p>
                      <p className="mt-1 text-ink/65">
                        {subject.score}% · {subject.grade}
                      </p>
                    </div>
                  ))}
                </div>

                {result.reportCardUrl ? (
                  <a
                    href={result.reportCardUrl}
                    className="mt-4 inline-flex rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-sand/60"
                  >
                    Preview report card
                  </a>
                ) : null}
              </article>
            ))}

            {portal.resultHistory.length === 0 ? (
              <p className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5 text-sm text-ink/65">
                No published result history yet.
              </p>
            ) : null}
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="p-6">
          <SectionHeader title="School notices" />

          <div className="mt-5 grid gap-4">
            {portal.announcements.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-ink">{item.title}</p>
                  <span className="rounded-full bg-sand/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-ink/50">
                    {item.time}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}