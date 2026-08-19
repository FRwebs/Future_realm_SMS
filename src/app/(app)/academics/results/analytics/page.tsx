import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { ResultAnalyticsView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatPercentage } from "@/lib/utils/formatters";

export default async function ResultAnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/analytics"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const analytics = await apiGet<ResultAnalyticsView>("/api/v1/academics/analytics");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/academics/results" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Result analytics</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Performance summaries, workflow status, pass distribution, and missing score detection.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {analytics.metrics.map((metric) => (
            <article key={metric.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{metric.label}</p>
              <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Class performance"
          description="Average, published count, pending count, and missing scores by class."
          items={analytics.classSummaries}
          columns={[
            { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
            { key: "average", header: "Average", render: (item) => item.average },
            { key: "published", header: "Published", render: (item) => item.published },
            { key: "pending", header: "Pending", render: (item) => item.pending },
            { key: "missing", header: "Missing", render: (item) => item.missingScores }
          ]}
        />
        <TableCard
          title="Subject performance"
          description="Average and pass-rate distribution by subject."
          items={analytics.subjectSummaries}
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "average", header: "Average", render: (item) => item.average },
            { key: "passRate", header: "Pass rate", render: (item) => formatPercentage(item.passRate) },
            { key: "entries", header: "Entries", render: (item) => item.entries }
          ]}
        />
      </section>

      <TableCard
        title="Missing scores"
        description="Students and subject combinations that still need entries."
        items={analytics.missingScores}
        columns={[
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "subject", header: "Subject", render: (item) => item.subject }
        ]}
      />
    </div>
  );
}
