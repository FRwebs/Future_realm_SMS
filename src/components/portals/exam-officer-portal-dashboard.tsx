import Link from "next/link";
import type { Route } from "next";
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  FileClock,
  FileSpreadsheet,
  GraduationCap,
  Send,
} from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import type { ExamOfficerDashboardView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function MetricCard({
  label,
  value,
  detail,
  tone = "brand",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "brand" | "success" | "warning";
}) {
  const accent =
    tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "warning"
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-accent-primary)]";

  return (
    <article className="surface-card relative overflow-hidden p-5">
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-4 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {detail}
      </p>
    </article>
  );
}

const quickIcons = {
  "Create New Exam": GraduationCap,
  "Enter Scores": ClipboardCheck,
  "View Broadsheets": FileSpreadsheet,
  "Publish Results": Send,
  "Question Bank": BookOpenCheck,
} as const;

export function ExamOfficerPortalDashboard({
  dashboard,
}: {
  dashboard: ExamOfficerDashboardView;
}) {
  const progressRate =
    dashboard.metrics.totalScoresExpected > 0
      ? Math.round(
          (dashboard.metrics.totalScoresEntered /
            dashboard.metrics.totalScoresExpected) *
            100,
        )
      : 0;

  return (
    <div className="grid gap-6 xl:gap-7">
      <section className="surface-card relative overflow-hidden p-6 md:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[var(--color-accent-primary-dim)] blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div>
            <p className="section-eyebrow">Exam operations hub</p>
            <h1 className="mt-3 font-[var(--font-display)] text-[40px] font-black tracking-tight text-[var(--color-text-primary)]">
              Exam officer command center
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Coordinate assessments, monitor score entry, release results,
              and keep the school’s exam workflow disciplined across{" "}
              {dashboard.currentTerm ?? "the active term"}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {dashboard.quickLinks.slice(0, 5).map((item) => {
                const Icon =
                  quickIcons[item.label as keyof typeof quickIcons] ??
                  FileClock;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-overlay)]"
                  >
                    <Icon className="h-4 w-4 text-[var(--color-text-accent)]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Current cycle
              </p>
              <p className="mt-3 text-[17px] font-semibold text-[var(--color-text-primary)]">
                {dashboard.currentSession ?? "Current session"}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                {dashboard.currentTerm ?? "Current term"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Score entry progress
              </p>
              <p className="mt-3 font-[var(--font-mono)] text-[24px] font-bold text-[var(--color-text-primary)]">
                {dashboard.metrics.totalScoresEntered.toLocaleString()} /{" "}
                {dashboard.metrics.totalScoresExpected.toLocaleString()}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent-primary)] transition-[width] duration-500"
                  style={{ width: `${progressRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Exams"
          value={dashboard.metrics.activeExams.toLocaleString()}
          detail="Assessments currently in active review, marking, or release phases."
        />
        <MetricCard
          label="Scores Entered"
          value={`${dashboard.metrics.totalScoresEntered.toLocaleString()} / ${dashboard.metrics.totalScoresExpected.toLocaleString()}`}
          detail={`${progressRate}% of expected score rows captured so far.`}
          tone="success"
        />
        <MetricCard
          label="Results Published"
          value={`${dashboard.metrics.publishedClasses} / ${dashboard.metrics.totalPublicationTargets}`}
          detail="Classes with live report visibility in the current term."
          tone="warning"
        />
        <MetricCard
          label="Upcoming Papers"
          value={dashboard.metrics.upcomingExams.toLocaleString()}
          detail="Scheduled exam papers starting within the next seven days."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TableCard
          title="Score entry status"
          description="Track which class-subject exam sheets are complete and which ones still need intervention."
          items={dashboard.scoreEntryStatus}
          primaryColumnKey="examTitle"
          featuredColumnKeys={["status"]}
          getRowKey={(item) => `${item.assessmentId}-${item.className}-${item.subject}`}
          columns={[
            {
              key: "examTitle",
              header: "Exam",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {item.examTitle}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.className} · {item.subject}
                  </p>
                </div>
              ),
            },
            {
              key: "completion",
              header: "Entry",
              render: (item) => (
                <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
                  {item.entered}/{item.total}
                </span>
              ),
            },
            {
              key: "progress",
              header: "Progress",
              render: (item) => `${item.completionRate}%`,
            },
            {
              key: "status",
              header: "Status",
              render: (item) => <StatusBadge status={item.status} />,
            },
          ]}
        />

        <TableCard
          title="Upcoming timetable"
          description="Immediate exam logistics across the next seven days."
          items={dashboard.upcomingTimetable}
          primaryColumnKey="subject"
          featuredColumnKeys={["candidateCount"]}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "subject",
              header: "Paper",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {item.subject}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.className}
                  </p>
                </div>
              ),
            },
            {
              key: "date",
              header: "Date",
              render: (item) => formatDate(item.examDate),
            },
            {
              key: "time",
              header: "Time",
              render: (item) => (
                <span className="font-[var(--font-mono)]">
                  {item.startsAt} - {item.endsAt}
                </span>
              ),
            },
            {
              key: "venue",
              header: "Venue",
              render: (item) => item.venue ?? "Pending venue",
            },
          ]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <TableCard
          title="Recent exam office activity"
          description="Latest audited actions touching exam operations, publication, and timetable work."
          items={dashboard.recentActivity}
          primaryColumnKey="action"
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "action",
              header: "Action",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {item.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.entityType}
                  </p>
                </div>
              ),
            },
            {
              key: "detail",
              header: "Detail",
              render: (item) => item.detail,
            },
            {
              key: "createdAt",
              header: "When",
              render: (item) => formatDate(item.createdAt),
            },
          ]}
        />

        <section className="surface-card p-6">
          <p className="section-eyebrow">Quick actions</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[24px] font-bold text-[var(--color-text-primary)]">
            High-frequency exam workflows
          </h2>
          <div className="mt-5 grid gap-3">
            {dashboard.quickLinks.map((item) => {
              const Icon =
                quickIcons[item.label as keyof typeof quickIcons] ?? FileClock;
              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className="group flex items-center justify-between rounded-[1.2rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {item.label}
                    </span>
                  </div>
                  <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)] transition group-hover:text-[var(--color-text-accent)]" />
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
