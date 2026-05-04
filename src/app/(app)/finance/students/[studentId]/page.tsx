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
    <div className="grid gap-6">
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
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Total billed</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{formatCurrency(ledger.metrics.totalBilled)}</p>
        </article>
        <article className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5 shadow-panel">
          <p className="text-sm text-emerald-700/80">Total paid</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-emerald-800">{formatCurrency(ledger.metrics.totalPaid)}</p>
        </article>
        <article className="rounded-[1.5rem] border border-rose-100 bg-rose-50/70 p-5 shadow-panel">
          <p className="text-sm text-rose-700/80">Outstanding</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-rose-700">{formatCurrency(ledger.metrics.outstanding)}</p>
        </article>
        <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 p-5 shadow-panel">
          <p className="text-sm text-amber-700/80">Overdue invoices</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-amber-800">{ledger.metrics.overdueInvoices}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Installment plans</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{ledger.metrics.activeInstallmentPlans}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Last payment</p>
          <p className="mt-3 text-lg font-semibold text-ink">{ledger.metrics.lastPaymentAt ? formatDate(ledger.metrics.lastPaymentAt) : "No payment yet"}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Family and account context</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Guardian:</span> {ledger.guardianName ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Phone:</span> {ledger.guardianPhone ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Email:</span> {ledger.guardianEmail ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Class:</span> {ledger.className}</p>
            <p><span className="font-semibold text-ink">Level:</span> {ledger.classLevel ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Current session:</span> {ledger.currentSession ?? "Not recorded"}</p>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Ledger summary</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Invoice records:</span> {ledger.invoices.length}</p>
            <p><span className="font-semibold text-ink">Payment records:</span> {ledger.payments.length}</p>
            <p><span className="font-semibold text-ink">Installment plans:</span> {ledger.installmentPlans.length}</p>
            <p><span className="font-semibold text-ink">Adjustments:</span> {ledger.adjustments.length}</p>
            <p><span className="font-semibold text-ink">Account state:</span> {ledger.metrics.outstanding > 0 ? "Balance outstanding" : "Financially clear"}</p>
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
                <p className="font-semibold text-ink">{item.invoiceNumber}</p>
                <p className="text-xs text-ink/55">{item.className}</p>
              </div>
            ),
          },
          { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || "No context set" },
          { key: "total", header: "Billed", render: (item) => formatCurrency(item.total) },
          { key: "paid", header: "Paid", render: (item) => formatCurrency(item.paid ?? 0) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
          { key: "due", header: "Due", render: (item) => formatDate(item.dueOn) },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-2">
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
                  <p className="font-semibold text-ink">{item.reference}</p>
                  <p className="text-xs text-ink/55">{item.invoiceNumber ?? "No linked invoice"}</p>
                </div>
              ),
            },
            { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || item.className || "No context set" },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
            { key: "method", header: "Method", render: (item) => item.paymentChannel || item.method },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
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
                  <p className="font-semibold text-ink">{item.planNumber}</p>
                  <p className="text-xs text-ink/55">{item.invoiceNumber ?? "No linked invoice"}</p>
                </div>
              ),
            },
            { key: "context", header: "Context", render: (item) => [item.session, item.term, item.classLevel].filter(Boolean).join(" · ") || item.className || "No context set" },
            { key: "total", header: "Total", render: (item) => formatCurrency(item.totalAmount) },
            { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
            { key: "next", header: "Next due", render: (item) => (item.items[0] ? formatDate(item.items[0].dueOn) : "—") },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
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
                <p className="font-semibold text-ink">{item.type}</p>
                <p className="text-xs text-ink/55">{item.invoiceNumber ?? "No invoice number"}</p>
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
