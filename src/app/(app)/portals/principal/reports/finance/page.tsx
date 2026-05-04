import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalDashboardBundle } from "@/lib/principal/portal";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function PrincipalFinanceSummaryPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/reports/finance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { finance } = await loadPrincipalDashboardBundle();

  const collected = finance?.payments.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const outstanding = finance?.invoices.reduce((sum, item) => sum + item.balance, 0) ?? 0;
  const expenditure = finance?.expenditures?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const recentAudit = finance?.auditTrail.slice(0, 10) ?? [];

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Financial oversight"
        title="Read-only finance visibility for leadership"
        description="Review collection performance, invoice exposure, expenditure activity, and audit movement without entering bursary edit paths."
        actions={<PrincipalQuickLink href="/finance" label="Open bursary workspace" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Collected" value={formatCurrency(collected)} helper="Total of posted payment rows currently visible in finance." />
        <PrincipalMetricCard label="Outstanding" value={formatCurrency(outstanding)} helper="Open invoice balances still exposed across the school." tone="amber" />
        <PrincipalMetricCard label="Expenditure" value={formatCurrency(expenditure)} helper="Recorded expenditure total from the current finance workspace snapshot." tone="rose" />
      </section>

      <TableCard
        title="Recent payments"
        description="Recent payment postings the principal may want to scan before meetings or reviews."
        items={finance?.payments.slice(0, 10) ?? []}
        emptyState="No payment rows were returned from finance."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.className}</p>
              </div>
            ),
          },
          { key: "amount", header: "Amount", render: (item) => <span className="font-[var(--font-mono)]">{formatCurrency(item.amount)}</span> },
          { key: "method", header: "Method", render: (item) => item.paymentMethod ?? "Not captured" },
          { key: "status", header: "Status", render: (item) => item.status },
          {
            key: "date",
            header: "Date",
            render: (item) => (item.paymentDate ?? item.createdAt ? formatDate(item.paymentDate ?? item.createdAt ?? new Date()) : "Not captured"),
          },
        ]}
      />

      <TableCard
        title="Finance audit trail"
        description="A quick read of recent finance mutations and the operational detail attached to them."
        items={recentAudit}
        emptyState="No audit events were returned from finance."
        columns={[
          { key: "action", header: "Action", render: (item) => item.action },
          { key: "entity", header: "Entity", render: (item) => item.entityType },
          { key: "detail", header: "Detail", render: (item) => item.detail },
          { key: "date", header: "When", render: (item) => formatDate(item.createdAt) },
        ]}
      />
    </div>
  );
}
