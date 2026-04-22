import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { ParentPortalView } from "@/lib/domain/types";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

export function ParentPortalDashboard({ portal }: { portal: ParentPortalView }) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Parent Portal</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{portal.headline}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          {portal.parentName} can review each child's weekly timetable, term results, attendance, balances, and family-wide notices from one screen.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {portal.familyStats.map((stat) => (
            <article key={stat.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{stat.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{stat.value}</p>
            </article>
          ))}
        </div>
     
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Child switcher</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">Choose a child before viewing child-specific records.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {portal.children.map((child) => (
            <Link
              key={child.studentId}
              href={`/portals/parent/children/${child.studentId}` as Route}
              className="rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-900"
            >
              {child.studentName} · {child.className}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Family notices</h2>
        <div className="mt-5 grid gap-4">
          {portal.announcements.map((item) => (
            <article key={item.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-ink">{item.title}</p>
                <span className="text-xs uppercase tracking-[0.24em] text-ink/35">{item.time}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/68">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {portal.children.map((child) => (
        <section key={child.studentId} className="grid gap-6">
          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Child profile</p>
                <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{child.studentName}</h2>
                <p className="mt-2 text-sm text-ink/68">{child.className} · {child.admissionNumber ?? "No admission number"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-brand-50 px-4 py-3 text-sm text-brand-900">
                <p className="font-semibold">Next class</p>
                <p className="mt-1">{child.nextClass}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <article className="rounded-[1.5rem] bg-sand/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Attendance</p>
                <p className="mt-2 text-2xl font-bold text-ink">{formatPercentage(child.attendanceRate)}</p>
              </article>
              <article className="rounded-[1.5rem] bg-sand/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Average</p>
                <p className="mt-2 text-2xl font-bold text-ink">{child.averageScore.toFixed(1)}%</p>
              </article>
              <article className="rounded-[1.5rem] bg-sand/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Balance</p>
                <p className="mt-2 text-2xl font-bold text-ink">{formatCurrency(child.outstandingBalance)}</p>
              </article>
              <article className="rounded-[1.5rem] bg-sand/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Notes</p>
                <p className="mt-2 text-sm font-semibold text-ink">{child.notes.join(" · ")}</p>
              </article>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/portals/parent/children/${child.studentId}` as Route} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                View overview
              </Link>
              <Link href={`/portals/parent/children/${child.studentId}/results` as Route} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                Results
              </Link>
              <Link href={`/portals/parent/children/${child.studentId}/fees` as Route} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                Fees
              </Link>
              <Link href={`/portals/parent/children/${child.studentId}/attendance` as Route} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                Attendance
              </Link>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Weekly timetable"
              description="See the current school-week plan for this child."
              items={child.weeklyTimetable}
              columns={[
                { key: "day", header: "Day", render: (item) => item.day },
                { key: "time", header: "Time", render: (item) => item.time },
                {
                  key: "subject",
                  header: "Class",
                  render: (item) => (
                    <div>
                      <p className="font-semibold text-ink">{item.subject}</p>
                      <p className="text-xs text-ink/55">{item.teacherName}</p>
                    </div>
                  )
                },
                { key: "venue", header: "Venue", render: (item) => item.venue }
              ]}
            />
            <TableCard
              title="Finance status"
              description="Track invoices, balances, and due dates for this child."
              items={child.finance}
              columns={[
                { key: "title", header: "Invoice", render: (item) => item.title },
                { key: "amount", header: "Total", render: (item) => formatCurrency(item.amount) },
                { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
                { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) }
              ]}
            />
          </section>

          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Result history</h3>
            <div className="mt-5 grid gap-4">
              {child.resultHistory.map((result) => (
                <article key={result.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-ink">
                        {result.session} · {result.term}
                      </p>
                      <p className="mt-1 text-sm text-ink/60">Published {formatDate(result.publishedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-ink/72">
                      <span className="rounded-full bg-white px-3 py-1 font-semibold">Average {result.average.toFixed(1)}%</span>
                      <span className="rounded-full bg-white px-3 py-1 font-semibold">Grade {result.grade}</span>
                      <span className="rounded-full bg-white px-3 py-1 font-semibold">Position {result.position ?? "-"}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {result.subjects.map((subject) => (
                      <div key={subject.subject} className="rounded-2xl bg-white px-4 py-3 text-sm">
                        <p className="font-semibold text-ink">{subject.subject}</p>
                        <p className="mt-1 text-ink/65">
                          {subject.score}% · {subject.grade}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ))}
    </div>
  );
}
