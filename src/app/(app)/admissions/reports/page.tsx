import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AdmissionMetricsView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function AdmissionReportsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/admissions")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const metrics = await apiGet<AdmissionMetricsView>("/api/v1/admissions/metrics");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Admission reports</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Admissions analytics</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Track application volume, class demand, approvals, rejection, screening performance, payment clearance,
              and enrollment conversion.
            </p>
          </div>
          <Link href="/admissions" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            Back to admissions
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Admitted</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.admitted}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Rejected</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.rejected}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Financially verified</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.paymentVerified}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Avg processing</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.averageProcessingDays}d</p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Stage breakdown"
          description="Admissions funnel by current workflow stage."
          items={metrics.byStatus}
          columns={[
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "count", header: "Applications", render: (item) => item.count }
          ]}
        />
        <TableCard
          title="Applications by class"
          description="Demand by class applied for."
          items={metrics.byClass}
          columns={[
            { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
            { key: "count", header: "Applications", render: (item) => item.count }
          ]}
        />
      </section>
    </div>
  );
}
