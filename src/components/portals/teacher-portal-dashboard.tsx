import Link from "next/link";
import type { Route } from "next";
import { BookOpen, CalendarDays, ClipboardCheck, Send, Sparkles } from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import { TeacherPortalView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export function TeacherPortalDashboard({ portal }: { portal: TeacherPortalView }) {
  const weekday = new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
  const todaysClasses = portal.weeklyTimetable.filter((item) => item.day.toLowerCase() === weekday.toLowerCase());

  return (
    <div className="grid gap-6 xl:gap-7">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-br from-primary-900 via-primary-700 to-teal-600 p-6 text-white shadow-panel md:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
              <Sparkles className="h-3.5 w-3.5" />
              Teacher command center
            </div>
            <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white md:text-5xl">{portal.headline}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
              {portal.teacherName} can track today’s lessons, assigned classes, attendance, scores, assignments, and classroom activity from one focused workspace.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">Today</p>
            <p className="mt-2 text-3xl font-black">{todaysClasses.length}</p>
            <p className="mt-1 text-sm text-white/72">{weekday} class period{todaysClasses.length === 1 ? "" : "s"} on your timetable.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {portal.stats.slice(0, 4).map((stat) => (
          <article key={stat.label} className="surface-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/90 p-4 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Mark attendance", href: "/portals/teacher/attendance", icon: ClipboardCheck },
            { label: "Enter scores", href: "/portals/teacher/scores", icon: Send },
            { label: "My subjects", href: "/my-subjects", icon: BookOpen },
            { label: "Timetable", href: "/portals/teacher/timetable", icon: CalendarDays }
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href as Route} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:border-primary-200 hover:bg-primary-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 group-hover:bg-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-slate-900 group-hover:text-primary-800">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {todaysClasses.length ? (
        <section className="rounded-[2rem] border border-white/65 bg-white/92 p-6 shadow-panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-700">Today's teaching timeline</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {todaysClasses.map((entry) => (
              <article key={entry.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{entry.time}</p>
                <p className="mt-2 text-base font-bold text-slate-950">{entry.subject}</p>
                <p className="mt-1 text-sm text-slate-600">{entry.className ?? "Assigned class"} · {entry.venue}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Weekly teaching timetable"
          description="All scheduled teaching slots for the current week."
          items={portal.weeklyTimetable}
          columns={[
            { key: "day", header: "Day", render: (item) => item.day },
            { key: "time", header: "Time", render: (item) => item.time },
            {
              key: "subject",
              header: "Subject",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.subject}</p>
                  <p className="text-xs text-ink/55">{item.className}</p>
                </div>
              )
            },
            { key: "venue", header: "Venue", render: (item) => item.venue }
          ]}
        />
        <TableCard
          title="Assigned classes"
          description="Operational overview for classes, pending scores, and next actions."
          items={portal.assignedClasses}
          columns={[
            {
              key: "className",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.className}</p>
                  <p className="text-xs text-ink/55">{item.subject}</p>
                </div>
              )
            },
            { key: "learners", header: "Learners", render: (item) => item.learners },
            { key: "pendingScores", header: "Pending", render: (item) => item.pendingScores },
            { key: "nextAction", header: "Next action", render: (item) => item.nextAction }
          ]}
        />
      </section>

      {(portal.assignments?.length ?? 0) > 0 || (portal.notifications?.length ?? 0) > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <TableCard
            title="Assignments"
            description="Recently created learning tasks and submission counts."
            items={portal.assignments ?? []}
            columns={[
              {
                key: "title",
                header: "Task",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="text-xs text-ink/55">{item.className} / {item.subject}</p>
                  </div>
                )
              },
              { key: "dueAt", header: "Due", render: (item) => formatDate(item.dueAt) },
              { key: "status", header: "Status", render: (item) => item.status },
              { key: "submissions", header: "Submissions", render: (item) => item.submissionsCount }
            ]}
          />
          <TableCard
            title="Notifications"
            description="Recent teaching-related alerts available to your account."
            items={portal.notifications ?? []}
            columns={[
              { key: "title", header: "Notification", render: (item) => item.title },
              { key: "channel", header: "Channel", render: (item) => item.channel },
              { key: "sentAt", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "-") }
            ]}
          />
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Recent activity</h2>
        <div className="mt-5 grid gap-4">
          {portal.recentActivity.map((item) => (
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
    </div>
  );
}
