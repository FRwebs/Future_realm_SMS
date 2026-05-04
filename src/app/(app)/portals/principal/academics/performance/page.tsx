import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalAcademicBundle } from "@/lib/principal/portal";
import { formatPercentage } from "@/lib/utils/formatters";

export default async function PrincipalAcademicPerformancePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/academics/performance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { analytics, broadsheets } = await loadPrincipalAcademicBundle();

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Academic command center"
        title="School-wide academic performance"
        description="Read class means, subject pass rates, missing scores, and canonical broadsheet workflow from one executive academic workspace."
        actions={
          <>
            <PrincipalQuickLink href="/academics/results/broadsheets" label="Open broadsheets" />
            <PrincipalQuickLink href="/academics/results/analytics" label="Legacy analytics" />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.slice(0, 4).map((metric) => (
          <PrincipalMetricCard key={metric.label} label={metric.label} value={metric.value} helper="Live from the result analytics engine." />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <TableCard
          title="Class performance"
          description="Compare class averages, publication progress, and outstanding score pressure."
          items={analytics.classSummaries}
          emptyState="No class performance data is available yet."
          columns={[
            { key: "class", header: "Class", render: (item) => item.className },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "pass", header: "Published", render: (item) => item.published },
            { key: "pending", header: "Pending", render: (item) => item.pending },
            { key: "missing", header: "Missing", render: (item) => item.missingScores },
          ]}
        />
        <TableCard
          title="Subject performance"
          description="Spot weak subjects quickly and follow up before results are finalised."
          items={analytics.subjectSummaries}
          emptyState="No subject performance data is available yet."
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "passRate", header: "Pass rate", render: (item) => formatPercentage(item.passRate) },
            { key: "entries", header: "Entries", render: (item) => item.entries },
          ]}
        />
      </section>

      <TableCard
        title="Broadsheet command list"
        description="Canonical class result workspaces that are shaping report cards and publication readiness."
        items={broadsheets.slice(0, 10)}
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
          { key: "stage", header: "Stage", render: (item) => item.approvalStage },
          { key: "mean", header: "Class mean", render: (item) => `${item.metrics?.classAverage ?? 0}%` },
          {
            key: "open",
            header: "Open",
            render: (item) => (
              <Link href={`/academics/results/broadsheets/${item.broadsheetId}`} className="font-semibold text-[var(--color-text-accent)]">
                Review
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
