import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ResultAnalyticsView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatPercentage } from "@/lib/utils/formatters";

export default async function ResultAnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results/analytics")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const analytics = await apiGet<ResultAnalyticsView>("/api/v1/academics/analytics");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Result analytics</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Performance summaries, workflow status, pass distribution, and missing score detection.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {analytics.metrics.map((metric) => (
            <article key={metric.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{metric.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
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
