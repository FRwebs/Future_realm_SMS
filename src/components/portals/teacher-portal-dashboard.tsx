import Link from "next/link";
import type { Route } from "next";
import { BookOpen, CalendarDays, ClipboardCheck, Send, Sparkles } from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import { TeacherPortalView } from "@/lib/domain/types";
import { canAccessPathWithPermissions } from "@/lib/navigation/registry";
import { formatDate } from "@/lib/utils/formatters";

export function TeacherPortalDashboard({
  portal,
  role,
  permissions,
}: {
  portal: TeacherPortalView;
  role: "TEACHER" | "CLASS_TEACHER" | "SUBJECT_TEACHER";
  permissions: string[];
}) {
  const weekday = new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
  const todaysClasses = portal.weeklyTimetable.filter((item) => item.day.toLowerCase() === weekday.toLowerCase());
  const ledClasses = Array.from(
    new Map(
      portal.assignedClasses
        .filter((item) => item.classId && !item.subjectId)
        .map((item) => [item.classId, item.className]),
    ).values(),
  );
  const hasClassLeadership = ledClasses.length > 0;
  const quickActions = [
    ...(hasClassLeadership
      ? [{ label: "Mark attendance", href: "/portals/teacher/attendance", icon: ClipboardCheck }]
      : []),
    { label: "Open gradebook", href: "/portals/teacher/gradebook", icon: Send },
    { label: "Lesson notes", href: "/portals/teacher/content/lesson-notes/planning", icon: BookOpen },
    { label: "Timetable", href: "/portals/teacher/timetable", icon: CalendarDays },
  ].filter((action) => canAccessPathWithPermissions(role, action.href, permissions));

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              Teacher command center
            </div>
            <h1 className="mt-4 max-w-4xl font-[var(--font-heading)] text-[28px] font-black leading-tight tracking-tight text-[var(--color-text-primary)] md:text-[34px]">
              {portal.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-6 text-[var(--color-text-secondary)]">
              {portal.teacherName} can track today&apos;s lessons, assigned classes, attendance, scores, assignments,
              and classroom activity from one focused workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                {weekday} · {todaysClasses.length} class period{todaysClasses.length === 1 ? "" : "s"} today
              </span>
              {hasClassLeadership ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-success)]">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Form / Class Teacher
                </span>
              ) : null}
              {ledClasses.map((className) => (
                <span
                  key={className}
                  className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]"
                >
                  {className}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {quickActions.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href as Route}
                className="group inline-flex items-center gap-2 rounded-[11px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2.5 transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
              >
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{action.label}</span>
              </Link>
            );
          })}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {portal.stats.slice(0, 4).map((stat) => (
          <article key={stat.label} className="surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{stat.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{stat.value}</p>
          </article>
        ))}
      </section>

      {todaysClasses.length ? (
        <section className="surface-card p-6">
          <p className="section-eyebrow">Today&apos;s teaching timeline</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {todaysClasses.map((entry) => (
              <article key={entry.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{entry.time}</p>
                <p className="mt-2 text-[14px] font-bold text-[var(--color-text-primary)]">{entry.subject}</p>
                <p className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">{entry.className ?? "Assigned class"} · {entry.venue}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
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
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.className}</p>
                </div>
              )
            },
            { key: "venue", header: "Venue", render: (item) => item.venue }
          ]}
        />
        <TableCard
          title={hasClassLeadership ? "Teaching and class leadership" : "Teaching assignments"}
          description={hasClassLeadership ? "See where you lead a class and where you teach subjects." : "Operational overview for your subject teaching load."}
          items={portal.assignedClasses}
          columns={[
            {
              key: "className",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.subjectId ? item.subject : "Form / class leadership"}</p>
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
        <section className="grid gap-5 xl:grid-cols-2">
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
                    <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.className} / {item.subject}</p>
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

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-4">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Recent activity</p>
        </div>
        <div className="grid">
          {portal.recentActivity.map((item) => (
            <div key={item.id} className="flex gap-3 border-b border-[var(--color-border-muted)] px-6 py-3.5 last:border-b-0">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-primary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{item.time}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
              </div>
            </div>
          ))}
          {portal.recentActivity.length === 0 ? (
            <p className="px-6 py-6 text-center text-sm text-[var(--color-text-muted)]">No recent activity yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
