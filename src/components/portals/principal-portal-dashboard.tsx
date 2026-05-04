import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, BellRing } from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import {
  PrincipalCommandLink,
  PrincipalDataList,
  PrincipalInfoCard,
  PrincipalMetricCard,
  PrincipalPageHeader,
  PrincipalQuickLink,
  PrincipalSpotlightCard,
} from "@/components/portals/principal-portal-ui";
import type {
  AdmissionMetricsView,
  AnnouncementView,
  DashboardSummary,
  FinanceDashboardView,
  ResultApprovalView,
  TeacherActivityView,
  TeacherRecordView,
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export function PrincipalPortalDashboard({
  overview,
  finance,
  admissions,
  announcements,
  approvalQueue,
  teachers,
  teacherActivities,
  principalName,
}: {
  overview: DashboardSummary;
  finance: FinanceDashboardView | null;
  admissions: AdmissionMetricsView | null;
  announcements: AnnouncementView[];
  approvalQueue: ResultApprovalView[];
  teachers: TeacherRecordView[];
  teacherActivities: TeacherActivityView[];
  principalName: string;
}) {
  const totalStudents = overview.metrics.find((item) =>
    item.label.toLowerCase().includes("student"),
  )?.value ?? "0";
  const totalStaff = overview.metrics.find((item) =>
    item.label.toLowerCase().includes("staff"),
  )?.value ?? teachers.length.toLocaleString();
  const schoolAverage =
    overview.metrics.find((item) => item.label.toLowerCase().includes("average"))
      ?.value ?? "--";
  const attendanceMetric =
    overview.metrics.find((item) => item.label.toLowerCase().includes("attendance"))
      ?.value ?? "--";
  const feeCollection =
    finance?.payments.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const feeOutstanding =
    finance?.invoices.reduce((sum, item) => sum + item.balance, 0) ?? 0;
  const pendingApprovals = approvalQueue.length || overview.pendingActions?.length || 0;
  const topAlerts = overview.pendingActions?.slice(0, 4) ?? [];
  const staffOnLeave = teachers.filter((teacher) =>
    teacher.leaveStatus.toLowerCase().includes("approved"),
  );
  const upcoming = overview.upcomingExams?.slice(0, 6) ?? [];
  const leadershipFeed = [
    ...teacherActivities.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      accent: item.tone,
    })),
    ...(overview.recentActivity ?? []).slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      accent: item.category,
    })),
  ].slice(0, 5);

  return (
    <div className="grid gap-6 xl:gap-7">
      <PrincipalPageHeader
        eyebrow="Principal command center"
        title={`Good leadership starts with clarity, ${principalName.split(" ")[0]}.`}
        description={`Track academics, approvals, finance exposure, admissions pressure, and day-to-day school signals from one leadership workspace for ${overview.currentTerm} · ${overview.currentSession}.`}
        actions={
          <>
            <PrincipalQuickLink href="/portals/principal/approvals" label="Review approvals" />
            <PrincipalQuickLink href="/portals/principal/reports/analytics" label="Open analytics" />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PrincipalMetricCard
          label="Total Students"
          value={totalStudents}
          helper="Current enrolled learners across all active classes."
        />
        <PrincipalMetricCard
          label="Total Staff"
          value={totalStaff}
          helper="Teaching and operational staff currently visible to leadership."
          tone="gold"
        />
        <PrincipalMetricCard
          label="School Average"
          value={schoolAverage}
          helper="School-wide academic pulse from the latest result aggregation."
        />
        <PrincipalMetricCard
          label="Attendance Today"
          value={attendanceMetric}
          helper="Live student and staff attendance signal from the current school day."
          tone="amber"
        />
        <PrincipalMetricCard
          label="Fee Collection"
          value={formatCurrency(feeCollection)}
          helper={`Outstanding exposure ${formatCurrency(feeOutstanding)} across open invoices.`}
        />
        <PrincipalMetricCard
          label="Pending Approvals"
          value={pendingApprovals}
          helper="Items requiring principal attention before workflows can move forward."
          tone="rose"
        />
      </section>

      {topAlerts.length ? (
        <section className="surface-card overflow-x-auto p-4">
          <div className="flex min-w-max gap-3">
            {topAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href as Route}
                className="flex min-w-[260px] max-w-[320px] items-start gap-3 rounded-[1.35rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
              >
                <div className="mt-0.5 rounded-full bg-[var(--color-danger-dim)] p-2 text-[var(--color-danger)]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                    {alert.detail}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <TableCard
          title="Pending approvals"
          description="Academic and operational items still waiting on principal sign-off."
          items={approvalQueue.slice(0, 8)}
          emptyState="No result approvals are waiting right now."
          primaryColumnKey="student"
          featuredColumnKeys={["status"]}
          getRowKey={(item) => item.id}
          actions={<PrincipalQuickLink href="/portals/principal/approvals" label="View all" />}
          columns={[
            {
              key: "student",
              header: "Student / Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {item.studentName}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.className}
                  </p>
                </div>
              ),
            },
            { key: "action", header: "Action", render: (item) => item.action },
            {
              key: "status",
              header: "Status",
              render: (item) => <StatusBadge status={item.status} />,
            },
            { key: "date", header: "Logged", render: (item) => formatDate(item.createdAt) },
          ]}
        />

        <PrincipalInfoCard
          title="Upcoming calendar"
          description="The next exam and event windows that need leadership visibility."
        >
          <div className="grid gap-3">
            {upcoming.length ? (
              upcoming.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                >
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                    {item.detail}
                  </p>
                  <p className="mt-2 font-[var(--font-mono)] text-[11px] text-[var(--color-text-accent)]">
                    {item.startsAt}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                No upcoming exam or timetable events were returned.
              </p>
            )}
          </div>
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Quick commands"
          description="Fast routes for the actions leadership reaches for most often."
        >
          <div className="grid gap-3">
            <PrincipalCommandLink
              href="/portals/principal/communication/announcements"
              title="Send announcement"
              detail="Address staff, parents, or students from the communication desk."
            />
            <PrincipalCommandLink
              href="/portals/principal/people/discipline"
              title="Review incidents"
              detail="Inspect open welfare and disciplinary cases that need executive review."
            />
            <PrincipalCommandLink
              href="/portals/principal/reports/finance"
              title="Check finance pulse"
              detail="See fee exposure, cash collection, and audit highlights without entering bursary edit flows."
            />
          </div>
        </PrincipalInfoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.95fr]">
        <PrincipalInfoCard
          title="School performance trend"
          description="Recent class, attendance, and weekly rhythm signals from the school-wide overview feed."
        >
          <div className="grid gap-3">
            {overview.attendanceTrend.slice(0, 5).map((item) => (
              <div key={item.day} className="grid gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {item.day}
                  </span>
                  <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">
                    {item.rate}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent-primary)]"
                    style={{ width: `${Math.min(item.rate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>

        <PrincipalSpotlightCard
          eyebrow="Admissions pulse"
          title="Demand, approvals, and conversion pressure"
          detail="Keep one eye on the intake funnel so leadership decisions on offers and enrollment stay ahead of bottlenecks."
        >
          <PrincipalDataList
            items={
              admissions
                ? [
                    {
                      label: "Applications",
                      value: admissions.totalApplications.toLocaleString(),
                      detail: "Total applications currently in the pipeline.",
                    },
                    {
                      label: "Pending approvals",
                      value: admissions.pendingApprovals.toLocaleString(),
                      detail: "Applications blocked pending leadership sign-off.",
                    },
                    {
                      label: "Admitted",
                      value: admissions.admitted.toLocaleString(),
                      detail: "Applicants already converted into admitted outcomes.",
                    },
                    {
                      label: "Conversion rate",
                      value: `${admissions.conversionRate}%`,
                      detail: "Current application-to-admission effectiveness.",
                    },
                  ]
                : [
                    {
                      label: "Admissions feed",
                      value: "Offline",
                      detail: "Admissions metrics are unavailable in this environment.",
                    },
                  ]
            }
          />
        </PrincipalSpotlightCard>

        <PrincipalInfoCard
          title="Communications & staffing pulse"
          description="Leadership watchlist across announcements, leave posture, and staff readiness."
        >
          <PrincipalDataList
            items={[
              {
                label: "Announcements",
                value: announcements.length.toLocaleString(),
                detail: "Recent school-wide broadcasts available for review.",
              },
              {
                label: "Staff on leave",
                value: staffOnLeave.length.toLocaleString(),
                detail: "Staff records currently showing approved leave posture.",
              },
              {
                label: "Teacher activity",
                value: teacherActivities.length.toLocaleString(),
                detail: "Recent staffing events visible in the leadership feed.",
              },
            ]}
          />
        </PrincipalInfoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <PrincipalInfoCard
          title="Recent leadership activity"
          description="Teacher, approval, and communication events worth scanning before the next meeting."
        >
          <div className="grid gap-3">
            {leadershipFeed.length ? (
              leadershipFeed.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                >
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                    {item.detail}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                No recent leadership activity is available yet.
              </p>
            )}
          </div>
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Broadcast radar"
          description="What leadership has recently said, and where the next communication can go."
        >
          <div className="grid gap-3">
            {announcements.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <div className="flex items-center gap-2 text-[var(--color-text-accent)]">
                  <BellRing className="h-3.5 w-3.5" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {item.channel}
                  </p>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {item.title}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {item.audience}
                </p>
              </div>
            ))}
            <PrincipalQuickLink
              href="/portals/principal/communication/broadcast"
              label="Open broadcast center"
            />
          </div>
        </PrincipalInfoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <PrincipalCommandLink
          href="/portals/principal/academics/performance"
          title="Academic command center"
          detail="Broadsheets, school averages, missing scores, and publication readiness in one place."
        />
        <PrincipalCommandLink
          href="/portals/principal/people/staff"
          title="Staff management"
          detail="Attendance signals, pending results, leave pressure, and leadership oversight on teachers."
        />
        <PrincipalCommandLink
          href="/portals/principal/operations/visitors"
          title="Operations watch"
          detail="Front desk traffic, calendar events, and physical campus movement through the week."
        />
      </section>
    </div>
  );
}
