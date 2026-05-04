import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import {
  AdmissionInfoCard,
  AdmissionMetricCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import { buildAdmissionDashboardData } from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type {
  AdmissionApplicationView,
  AdmissionMetricsView,
} from "@/lib/domain/types";

export default async function AdmissionOfficerAnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/analytics"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [applications, metrics] = await Promise.all([
    apiGet<AdmissionApplicationView[]>("/api/v1/admissions"),
    apiGet<AdmissionMetricsView>("/api/v1/admissions/metrics"),
  ]);
  const dashboard = buildAdmissionDashboardData(applications, metrics);

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Admissions analytics"
        title="Pipeline and demand analytics"
        description="Measure application flow, class demand, processing pressure, and enrollment conversion without leaving the admissions workspace."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/pipeline"
              label="Pipeline board"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Applications desk"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdmissionMetricCard
          label="Conversion Rate"
          value={`${metrics.conversionRate}%`}
          helper="Application-to-enrollment movement across the current data set."
        />
        <AdmissionMetricCard
          label="Average Processing"
          value={`${metrics.averageProcessingDays}d`}
          helper="Average days between submission and recorded decision."
          accent="amber"
        />
        <AdmissionMetricCard
          label="Financially Verified"
          value={metrics.paymentVerified}
          helper="Applications already financially cleared or fee-complete."
          accent="teal"
        />
        <AdmissionMetricCard
          label="Screening Average"
          value={metrics.screeningAverage}
          helper="Average recorded screening score from completed screenings."
          accent="slate"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdmissionInfoCard
          title="Stage distribution"
          description="Current admissions load by workflow stage."
        >
          <div className="grid gap-3">
            {metrics.byStatus.map((item) => {
              const percentage =
                metrics.totalApplications > 0
                  ? Math.round((item.count / metrics.totalApplications) * 100)
                  : 0;

              return (
                <div key={item.status} className="grid gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      {item.status.replaceAll("_", " ")}
                    </p>
                    <p className="font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.count}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent-primary)]"
                      style={{ width: `${Math.max(12, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </AdmissionInfoCard>

        <AdmissionInfoCard
          title="Recent intake rhythm"
          description="Daily application volume across the most recent admissions window."
        >
          <div className="grid gap-3">
            {dashboard.dailyVolume.map((point) => (
              <div key={point.date} className="grid gap-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-[var(--color-text-primary)]">{point.date}</p>
                  <p className="font-[var(--font-mono)] text-sm font-semibold text-[var(--color-text-primary)]">
                    {point.count}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-info)]"
                    style={{
                      width: `${Math.max(
                        10,
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
      </section>

      <TableCard
        title="Demand by class"
        description="Where applicants are concentrating their demand right now."
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
            key: "signal",
            header: "Signal",
            render: (item) =>
              item.count >= 12
                ? "High demand"
                : item.count >= 6
                  ? "Steady demand"
                  : "Developing",
          },
        ]}
      />
    </div>
  );
}
