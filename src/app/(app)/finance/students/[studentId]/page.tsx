import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ManualPaymentModal } from "@/components/finance/manual-payment-modal";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { StudentFinanceLedgerView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function FinanceStudentLedgerPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const [ledger, permissions] = await Promise.all([
    apiGet<StudentFinanceLedgerView>(`/api/v1/finance/students/${studentId}`),
    getServerPermissions(session),
  ]);

  const canManageFinance = permissions.some((permission) =>
    [
      "fees.create",
      "fees.edit",
      "fees.collect",
      "fees.approve",
      "fees.apply_waiver",
      "fees.create_receipt",
      "fees.edit_payment",
    ].includes(permission),
  );

  return (
    <div className="portal-page">
      <DetailPageHeader
        eyebrow="Student finance ledger"
        title={ledger.studentName}
        backHref="/finance"
        backLabel="Back to finance"
        description={`${ledger.admissionNumber} · ${ledger.className} · ${ledger.status}`}
        badges={[
          ledger.classLevel ?? "No level set",
          ledger.currentSession ?? "No active session",
          ledger.metrics.outstanding > 0 ? "Outstanding balance" : "Account clear",
        ]}
        actions={canManageFinance ? <ManualPaymentModal invoices={ledger.invoices} /> : undefined}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Total billed</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(ledger.metrics.totalBilled)}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Total paid</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(ledger.metrics.totalPaid)}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-danger-dim)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-danger)]">Outstanding</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(ledger.metrics.outstanding)}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Overdue invoices</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{ledger.metrics.overdueInvoices}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Installment plans</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{ledger.metrics.activeInstallmentPlans}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Last payment</p>
          <p className="mt-2 text-[15px] font-semibold text-[var(--color-text-primary)]">{ledger.metrics.lastPaymentAt ? formatDate(ledger.metrics.lastPaymentAt) : "No payment yet"}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Family and account context</h2>
          <div className="mt-4 grid gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Guardian:</span> {ledger.guardianName ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Phone:</span> {ledger.guardianPhone ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Email:</span> {ledger.guardianEmail ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Class:</span> {ledger.className}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Level:</span> {ledger.classLevel ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Current session:</span> {ledger.currentSession ?? "Not recorded"}</p>
          </div>
        </article>

        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Ledger summary</h2>
          <div className="mt-4 grid gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Invoice records:</span> {ledger.invoices.length}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Payment records:</span> {ledger.payments.length}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Installment plans:</span> {ledger.installmentPlans.length}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Adjustments:</span> {ledger.adjustments.length}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Account state:</span> {ledger.metrics.outstanding > 0 ? "Balance outstanding" : "Financially clear"}</p>
          </div>
        </article>
      </section>

      <TableCard
        title="Invoice history"
        description="All fee invoices issued for this student across terms and sessions."
        items={ledger.invoices}
        emptyState="No invoice history has been recorded for this student yet."
        primaryColumnKey="invoice"
        featuredColumnKeys={["status"]}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "invoice",
            header: "Invoice",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.invoiceNumber}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.className}</p>
              </div>
            ),
          },
          { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || "No context set" },
          { key: "total", header: "Billed", render: (item) => formatCurrency(item.total) },
          { key: "paid", header: "Paid", render: (item) => formatCurrency(item.paid ?? 0) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
          { key: "due", header: "Due", render: (item) => formatDate(item.dueOn) },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Payment history"
          description="Every payment recorded against this student, including manual and online channels."
          items={ledger.payments}
          emptyState="No payment history has been recorded for this student yet."
          primaryColumnKey="reference"
          featuredColumnKeys={["status"]}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "reference",
              header: "Reference",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.reference}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.invoiceNumber ?? "No linked invoice"}</p>
                </div>
              ),
            },
            { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || item.className || "No context set" },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
            { key: "method", header: "Method", render: (item) => item.paymentChannel || item.method },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
            { key: "paidAt", header: "Paid", render: (item) => (item.paidAt ? formatDate(item.paidAt) : "—") },
          ]}
        />

        <TableCard
          title="Installment plans"
          description="Structured payment agreements and their remaining balances."
          items={ledger.installmentPlans}
          emptyState="No installment plan is active for this student."
          primaryColumnKey="plan"
          featuredColumnKeys={["status"]}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "plan",
              header: "Plan",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.planNumber}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.invoiceNumber ?? "No linked invoice"}</p>
                </div>
              ),
            },
            { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || item.className || "No context set" },
            { key: "total", header: "Total", render: (item) => formatCurrency(item.totalAmount) },
            { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
            { key: "next", header: "Next due", render: (item) => (item.items[0] ? formatDate(item.items[0].dueOn) : "—") },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
          ]}
        />
      </section>

      <TableCard
        title="Adjustments and waivers"
        description="Discounts, scholarships, and waivers applied to this student's invoices."
        items={ledger.adjustments}
        emptyState="No waivers, discounts, or scholarships have been applied to this student yet."
        getRowKey={(item) => item.id}
        primaryColumnKey="type"
        featuredColumnKeys={["amount"]}
        columns={[
          {
            key: "type",
            header: "Type",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.type}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.invoiceNumber ?? "No invoice number"}</p>
              </div>
            ),
          },
          { key: "context", header: "Context", render: (item) => [item.session, item.term].filter(Boolean).join(" · ") || "No context set" },
          { key: "valueType", header: "Value type", render: (item) => item.valueType },
          { key: "value", header: "Entered value", render: (item) => formatCurrency(item.value) },
          { key: "amount", header: "Applied amount", render: (item) => formatCurrency(item.amount) },
          { key: "reason", header: "Reason", render: (item) => item.reason },
          { key: "createdAt", header: "Applied", render: (item) => formatDate(item.createdAt) },
        ]}
      />
    </div>
  );
}
