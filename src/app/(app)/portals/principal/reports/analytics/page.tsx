import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalAcademicBundle, loadPrincipalDashboardBundle } from "@/lib/principal/portal";
import { formatPercentage } from "@/lib/utils/formatters";

export default async function PrincipalAnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/reports/analytics"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [{ admissions }, { analytics, broadsheets }] = await Promise.all([
    loadPrincipalDashboardBundle(),
    loadPrincipalAcademicBundle(),
  ]);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Executive analytics"
        title="School-wide performance and trend intelligence"
        description="A leadership view of attendance, academics, admissions flow, and risk signals without dropping into the underlying operational modules."
        actions={<PrincipalQuickLink href="/portals/principal/reports/finance" label="Financial summary" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.slice(0, 4).map((metric) => (
          <PrincipalMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper="Live from the current analytics snapshot."
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <TableCard
          title="Class performance"
          description="Read class mean, publication progress, and missing-score pressure from one register."
          items={analytics.classSummaries}
          emptyState="No class performance rows are available yet."
          columns={[
            { key: "class", header: "Class", render: (item) => item.className },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "published", header: "Published", render: (item) => item.published },
            { key: "pending", header: "Pending", render: (item) => item.pending },
            { key: "missing", header: "Missing", render: (item) => item.missingScores },
          ]}
        />
        <TableCard
          title="Subject performance"
          description="School-wide subject signal to identify standout and weak-performing subjects."
          items={analytics.subjectSummaries}
          emptyState="No subject performance rows are available yet."
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "passRate", header: "Pass rate", render: (item) => formatPercentage(item.passRate) },
            { key: "entries", header: "Entries", render: (item) => item.entries },
          ]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PrincipalInfoCard
          title="Enrollment funnel"
          description="Admissions conversion tells leadership whether brand demand is becoming actual enrollment."
        >
          <div className="grid gap-3">
            {admissions ? (
              [
                ["Total applications", admissions.totalApplications],
                ["Pending approvals", admissions.pendingApprovals],
                ["Admitted", admissions.admitted],
                ["Rejected", admissions.rejected],
                ["Conversion rate", `${admissions.conversionRate}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                >
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{label}</span>
                  <span className="font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {value}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                Admissions metrics are unavailable for this environment.
              </p>
            )}
          </div>
        </PrincipalInfoCard>

        <TableCard
          title="Broadsheet register"
          description="Published and in-flight class broadsheets that are influencing the executive academic picture."
          items={broadsheets.slice(0, 8)}
          emptyState="No broadsheets are available yet."
          columns={[
            {
              key: "class",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.term}{item.session ? ` · ${item.session}` : ""}</p>
                </div>
              ),
            },
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "average", header: "Mean", render: (item) => `${item.metrics?.classAverage ?? 0}%` },
            { key: "complete", header: "Complete", render: (item) => item.completeStudents ?? 0 },
          ]}
        />
      </section>
    </div>
  );
}
