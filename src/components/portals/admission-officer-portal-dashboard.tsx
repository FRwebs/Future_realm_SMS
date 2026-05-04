import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BellRing, BookCheck, FileSpreadsheet, UserPlus, Users } from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import {
  AdmissionInfoCard,
  AdmissionMetricCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
  AdmissionStatusPill,
} from "@/components/portals/admission-officer-ui";
import { buildAdmissionDashboardData } from "@/lib/admissions/portal";
import type { AdmissionApplicationView, AdmissionMetricsView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export function AdmissionOfficerPortalDashboard({
  applications,
  metrics,
}: {
  applications: AdmissionApplicationView[];
  metrics: AdmissionMetricsView;
}) {
  const dashboard = buildAdmissionDashboardData(applications, metrics);
  const offerAcceptanceRate =
    dashboard.offersSentCount > 0
      ? Math.round(
          (applications.filter((application) => application.status === "ACCEPTED").length /
            dashboard.offersSentCount) *
            100,
        )
      : 0;

  return (
    <div className="grid gap-6 xl:gap-7">
      <AdmissionPortalPageHeader
        eyebrow="Admissions command center"
        title="Admission officer workspace"
        description="Review applicants, clear document bottlenecks, coordinate screening, issue offers, and move accepted candidates cleanly into enrollment from one admissions-focused portal."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Review applications"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/pipeline"
              label="Open pipeline"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdmissionMetricCard
          label="Total Applications"
          value={dashboard.totalApplications}
          helper="All submissions captured in the active admissions workflow."
        />
        <AdmissionMetricCard
          label="Pending Review"
          value={dashboard.pendingReviewCount}
          helper="Applications still waiting for officer attention."
          accent="amber"
        />
        <AdmissionMetricCard
          label="Offers Sent"
          value={dashboard.offersSentCount}
          helper={`${offerAcceptanceRate}% acceptance rate so far.`}
          accent="teal"
        />
        <AdmissionMetricCard
          label="Enrolled"
          value={dashboard.enrolledCount}
          helper="Applicants already converted into student records."
          accent="slate"
        />
        <AdmissionMetricCard
          label="Vacancy Pressure"
          value={dashboard.vacancyPressureClasses.length}
          helper="Top class streams currently attracting the heaviest demand."
          accent="rose"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdmissionInfoCard
          title="Pipeline summary"
          description="See how the current intake is moving from submission through offer and final enrollment."
        >
          <div className="grid gap-3">
            {dashboard.funnel.map((stage) => {
              const percentage =
                dashboard.totalApplications > 0
                  ? Math.round((stage.count / dashboard.totalApplications) * 100)
                  : 0;

              return (
                <Link
                  key={stage.id}
                  href={`/portals/admission-officer/pipeline`}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {stage.label}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {percentage}% of total applications
                      </p>
                    </div>
                    <p className="font-[var(--font-mono)] text-lg font-semibold text-[var(--color-text-primary)]">
                      {stage.count}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-base)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent-primary)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </AdmissionInfoCard>

        <AdmissionInfoCard
          title="Tasks and alerts"
          description="The items most likely to slow down intake conversion if they sit untouched."
        >
          <div className="grid gap-3">
            {dashboard.alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href as Route}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {alert.label}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Action queue
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-accent)]">
                    {alert.count}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
                </div>
              </Link>
            ))}
          </div>
        </AdmissionInfoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <TableCard
          title="Recent applications"
          description="The newest application records entering the admissions pipeline."
          items={dashboard.recentApplications}
          primaryColumnKey="applicant"
          featuredColumnKeys={["status"]}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "applicant",
              header: "Applicant",
              render: (item) => (
                <div>
                  <Link
                    href={`/portals/admission-officer/applications?applicationId=${item.id}`}
                    className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-accent-primary-dim)] underline-offset-4"
                  >
                    {item.studentName}
                  </Link>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.applicationNo}
                  </p>
                </div>
              ),
            },
            {
              key: "class",
              header: "Class",
              render: (item) => formatNigeriaClassName(item.desiredClass),
            },
            {
              key: "submittedAt",
              header: "Submitted",
              render: (item) => formatDate(item.submittedAt),
            },
            {
              key: "status",
              header: "Status",
              render: (item) => <AdmissionStatusPill status={item.status} />,
            },
          ]}
        />

        <div className="grid gap-6">
          <AdmissionInfoCard
            title="Application volume"
            description="Daily submissions across the most recent admissions activity window."
          >
            <div className="grid gap-3">
              {dashboard.dailyVolume.map((point) => (
                <div key={point.date} className="grid gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {formatDate(point.date)}
                    </p>
                    <p className="font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-primary)]">
                      {point.count}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent-primary)]"
                      style={{
                        width: `${Math.max(
                          12,
                          (point.count /
                            Math.max(
                              ...dashboard.dailyVolume.map((item) => item.count),
                              1,
                            )) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AdmissionInfoCard>

          <AdmissionInfoCard
            title="Quick actions"
            description="Jump straight into the most frequent officer workflows."
          >
            <div className="grid gap-3">
              {[
                {
                  href: "/portals/admission-officer/applications",
                  label: "Review applications",
                  icon: Users,
                },
                {
                  href: "/portals/admission-officer/screenings",
                  label: "Schedule screening",
                  icon: BookCheck,
                },
                {
                  href: "/portals/admission-officer/offers",
                  label: "Issue offers",
                  icon: UserPlus,
                },
                {
                  href: "/portals/admission-officer/analytics",
                  label: "Open analytics",
                  icon: FileSpreadsheet,
                },
                {
                  href: "/portals/admission-officer/settings",
                  label: "Adjust intake rules",
                  icon: BellRing,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {item.label}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
                  </Link>
                );
              })}
            </div>
          </AdmissionInfoCard>
        </div>
      </section>

      <TableCard
        title="Demand by class"
        description="Classes currently attracting the highest volume of applications."
        items={dashboard.classDemand}
        primaryColumnKey="className"
        featuredColumnKeys={["count"]}
        getRowKey={(item) => item.className}
        columns={[
          {
            key: "className",
            header: "Class",
            render: (item) => item.className,
          },
          {
            key: "count",
            header: "Applications",
            render: (item) => item.count,
          },
          {
            key: "trend",
            header: "Pipeline posture",
            render: (item) =>
              item.count >= 10
                ? "Heavy demand"
                : item.count >= 5
                  ? "Healthy demand"
                  : "Emerging demand",
          },
        ]}
      />
    </div>
  );
}
