import Link from "next/link";
import type { Route } from "next";
import { Bell, CreditCard, GraduationCap, Megaphone, Sparkles, Users } from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { ParentPortalView } from "@/lib/domain/types";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

export function ParentPortalDashboard({ portal }: { portal: ParentPortalView }) {
  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-br from-primary-900 via-primary-700 to-teal-600 p-6 text-white shadow-panel md:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
            <Sparkles className="h-3.5 w-3.5" />
            Parent family command center
          </div>
          <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white md:text-5xl">{portal.headline}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/74">
            {portal.parentName} can review each child's timetable, attendance, results, fee balance, payments, and school notices from one secure family workspace.
          </p>
        </div>
        <div className="relative mt-6 grid gap-4 md:grid-cols-3">
          {portal.familyStats.map((stat) => (
            <article key={stat.label} className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{stat.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-white">{stat.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/90 p-4 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Children", href: "/portals/parent/children", icon: Users },
            { label: "Announcements", href: "/portals/parent/announcements", icon: Megaphone },
            { label: "Fees", href: portal.children[0] ? `/portals/parent/children/${portal.children[0].studentId}/fees` : "/portals/parent/children", icon: CreditCard },
            { label: "Results", href: portal.children[0] ? `/portals/parent/children/${portal.children[0].studentId}/results` : "/portals/parent/children", icon: GraduationCap }
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href as Route} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:border-primary-200 hover:bg-primary-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 group-hover:bg-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-slate-900 group-hover:text-primary-800">{action.label}</span>
              </Link>
            );
          })}
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Family notices</h2>
        </div>
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
            <div className="mt-5">
              <ActionMenu triggerLabel={`Actions for ${child.studentName}`}>
                <ActionMenuLink href={`/portals/parent/children/${child.studentId}`}>View overview</ActionMenuLink>
                <ActionMenuLink href={`/portals/parent/children/${child.studentId}/results`}>Results</ActionMenuLink>
                <ActionMenuLink href={`/portals/parent/children/${child.studentId}/fees`}>Fees</ActionMenuLink>
                <ActionMenuLink href={`/portals/parent/children/${child.studentId}/attendance`}>Attendance</ActionMenuLink>
              </ActionMenu>
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
