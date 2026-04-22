import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FinanceDashboardView } from "@/lib/domain/types";
import { feeGatewayOptions, formatNigeriaClassName, nigerianClassFieldOptions } from "@/lib/school-options";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function FinancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [dashboard, permissions] = await Promise.all([
    apiGet<FinanceDashboardView>("/api/v1/finance/dashboard"),
    getServerPermissions(session),
  ]);
  const canManageFinance = permissions.some((permission) =>
    ["fees.create", "fees.edit", "fees.collect", "fees.approve", "fees.apply_waiver", "fees.create_receipt"].includes(permission),
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Finance</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Fees, payments, and clearance</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          Configure school fees, issue invoices, record payments, generate receipts, monitor arrears, and keep finance actions auditable.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href="/finance/fee-structures" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Fee structures</a>
          <a href="/finance/payments" className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">Payments</a>
          <a href="/finance/installments" className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">Installments</a>
          <a href="/finance/reports" className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">Reports</a>
          {canManageFinance ? (
            <>
              <ResourceActionDialog
                triggerLabel="Create invoice"
                title="Single invoice"
                description="Issue one invoice for a student. Use student ID in production mode so the invoice is tied to the register."
                endpoint="/api/v1/finance/invoices"
                submitLabel="Create invoice"
                confirmLabel="Confirm Invoice"
                confirmMessage="Confirm fee components and due date before issuing this invoice."
                fields={[
                  { name: "studentId", label: "Student ID", placeholder: "Student database ID" },
                  { name: "studentName", label: "Student name", required: true, placeholder: "Daniel Yusuf" },
                  { name: "className", label: "Class", type: "select", required: true, options: nigerianClassFieldOptions },
                  { name: "tuition", label: "Tuition", type: "number", required: true, defaultValue: 200000, min: 0 },
                  { name: "transport", label: "Transport", type: "number", required: true, defaultValue: 60000, min: 0 },
                  { name: "developmentLevy", label: "Development levy", type: "number", required: true, defaultValue: 25000, min: 0 },
                  { name: "discount", label: "Discount", type: "number", defaultValue: 0, min: 0 },
                  { name: "fine", label: "Fine", type: "number", defaultValue: 0, min: 0 },
                  { name: "dueOn", label: "Due date", type: "date", required: true }
                ]}
              />
              <ResourceActionDialog
                triggerLabel="Payment handoff"
                title="Payment handoff"
                description="Create a Paystack or Flutterwave checkout intent. Verification allocates the payment and issues a receipt."
                endpoint="/api/v1/finance/payments"
                submitLabel="Initialize payment"
                confirmLabel="Confirm Payment Intent"
                confirmMessage="Confirm amount, invoice, and gateway before initializing the payment."
                variant="secondary"
                fields={[
                  { name: "invoiceId", label: "Invoice ID", required: true, placeholder: "Invoice database ID" },
                  { name: "email", label: "Parent email", type: "email", placeholder: "parent@example.com" },
                  { name: "amount", label: "Amount", type: "number", required: true, defaultValue: 50000, min: 1 },
                  { name: "method", label: "Method", type: "select", options: [{ label: "Online", value: "ONLINE" }] },
                  { name: "provider", label: "Gateway", type: "select", options: feeGatewayOptions }
                ]}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">{metric.label}</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metric.value}</p>
          </article>
        ))}
      </section>
      <TableCard
        title="Invoice ledger"
        description="Outstanding balances, due dates, and receipt status across enrolled students."
        items={dashboard.invoices}
        columns={[
          {
            key: "invoice",
            header: "Invoice",
            render: (item) => (
              <div>
                <a href={`/finance/invoices/${item.id}`} className="font-semibold text-ink underline decoration-ink/20 underline-offset-4">{item.invoiceNumber}</a>
                <p className="text-xs text-ink/55">{item.studentName}</p>
              </div>
            )
          },
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "total", header: "Total", render: (item) => formatCurrency(item.total) },
          { key: "paid", header: "Paid", render: (item) => formatCurrency(item.paid ?? 0) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
          { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) }
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Recent payments"
          description="Successful, pending, and verified payment entries."
          items={dashboard.payments}
          columns={[
            { key: "reference", header: "Reference", render: (item) => item.reference },
            { key: "student", header: "Student", render: (item) => item.studentName },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
        <TableCard
          title="Audit trail"
          description="Recent manual finance actions captured for reviewer visibility."
          items={dashboard.auditTrail}
          columns={[
            { key: "action", header: "Action", render: (item) => item.action },
            { key: "entity", header: "Entity", render: (item) => item.entityType },
            { key: "createdAt", header: "When", render: (item) => formatDate(item.createdAt) }
          ]}
        />
      </section>
    </div>
  );
}
