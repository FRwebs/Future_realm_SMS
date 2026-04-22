import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FinanceDashboardView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function FinanceReportsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/reports"))) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const dashboard = await apiGet<FinanceDashboardView>("/api/v1/finance/dashboard");
  const overdue = dashboard.invoices.filter((invoice) => invoice.status === "OVERDUE");
  const discounts = dashboard.invoices.reduce((sum, invoice) => sum + (invoice.discount ?? 0), 0);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Finance reports</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Collection performance, arrears, adjustments, and export-ready invoice data.</p>
        <a href="/api/v1/finance/reports/export" className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          Download CSV
        </a>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">{metric.label}</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metric.value}</p>
          </article>
        ))}
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Discounts / waivers</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{formatCurrency(discounts)}</p>
        </article>
      </section>

      <TableCard
        title="Overdue invoices"
        description="Invoices requiring arrears follow-up and reminders."
        items={overdue}
        columns={[
          { key: "invoice", header: "Invoice", render: (item) => item.invoiceNumber },
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "due", header: "Due", render: (item) => formatDate(item.dueOn) }
        ]}
      />

      <TableCard
        title="Audit view"
        description="Manual edits, approvals, and payment events."
        items={dashboard.auditTrail}
        columns={[
          { key: "action", header: "Action", render: (item) => item.action },
          { key: "entity", header: "Entity", render: (item) => item.entityType },
          { key: "detail", header: "Detail", render: (item) => item.detail },
          { key: "createdAt", header: "When", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
