import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AdmissionMetricsView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function AdmissionReportsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/admissions/reports"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const metrics = await apiGet<AdmissionMetricsView>("/api/v1/admissions/metrics");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow">Admission reports</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Admissions analytics</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Track application volume, class demand, approvals, rejection, screening performance, payment clearance,
              and enrollment conversion.
            </p>
          </div>
          <Link href="/admissions" className="btn-primary px-4">
            Back to admissions
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Admitted</p>
            <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metrics.admitted}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Rejected</p>
            <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metrics.rejected}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Financially verified</p>
            <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metrics.paymentVerified}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Avg processing</p>
            <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{metrics.averageProcessingDays}d</p>
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
