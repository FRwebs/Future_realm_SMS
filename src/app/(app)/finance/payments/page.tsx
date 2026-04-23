import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ManualPaymentModal } from "@/components/finance/manual-payment-modal";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { InvoiceView, PaymentView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import Link from "next/link";

export default async function PaymentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const [payments, invoices, permissions] = await Promise.all([
    apiGet<PaymentView[]>("/api/v1/finance/payments"),
    apiGet<InvoiceView[]>("/api/v1/finance/invoices"),
    getServerPermissions(session),
  ]);
  const canManageFinance = permissions.some((permission) =>
    ["fees.collect", "fees.edit_payment", "fees.approve", "fees.create_receipt", "fees.apply_waiver"].includes(permission),
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</Link>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Payments and adjustments</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">
              Record cash, bank transfer, POS, cheque, and online collections with receipt generation and audit history.
            </p>
          </div>
          {canManageFinance ? <ManualPaymentModal invoices={invoices} /> : null}
        </div>
      </section>

      {canManageFinance ? <section className="grid gap-6 xl:grid-cols-2">
        <ResourceForm
          title="Verify online payment"
          description="Verify a Paystack/Flutterwave reference, allocate the payment, and issue a receipt."
          endpoint="/api/v1/finance/payments/verify"
          submitLabel="Verify payment"
          fields={[{ name: "reference", label: "Payment reference", required: true, placeholder: "PAY-..." }]}
        />
      </section> : null}

      {canManageFinance ? <section className="grid gap-6 xl:grid-cols-2">
        <ResourceForm
          title="Discount or scholarship"
          description="Apply an approved fixed or percentage reduction to an open invoice."
          endpoint="/api/v1/finance/discounts"
          submitLabel="Apply discount"
          fields={[
            { name: "invoiceId", label: "Invoice ID", required: true },
            { name: "type", label: "Type", type: "select", options: [{ label: "Discount", value: "DISCOUNT" }, { label: "Scholarship", value: "SCHOLARSHIP" }] },
            { name: "valueType", label: "Value type", type: "select", options: [{ label: "Fixed amount", value: "FIXED" }, { label: "Percentage", value: "PERCENTAGE" }] },
            { name: "value", label: "Value", type: "number", required: true, min: 0 },
            { name: "reason", label: "Approval reason", type: "textarea", required: true }
          ]}
        />
        <ResourceForm
          title="Waiver"
          description="Apply a bursary-approved waiver to an invoice balance."
          endpoint="/api/v1/finance/waivers"
          submitLabel="Apply waiver"
          fields={[
            { name: "invoiceId", label: "Invoice ID", required: true },
            { name: "type", label: "Type", type: "select", options: [{ label: "Waiver", value: "WAIVER" }] },
            { name: "valueType", label: "Value type", type: "select", options: [{ label: "Fixed amount", value: "FIXED" }, { label: "Percentage", value: "PERCENTAGE" }] },
            { name: "value", label: "Value", type: "number", required: true, min: 0 },
            { name: "reason", label: "Approval reason", type: "textarea", required: true }
          ]}
        />
      </section> : null}

      <TableCard
        title="Payment history"
        description="Recent payment records, receipt numbers, and verification status."
        items={payments}
        columns={[
          { key: "reference", header: "Reference", render: (item) => item.reference },
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "invoice", header: "Invoice", render: (item) => item.invoiceNumber ?? "-" },
          { key: "receipt", header: "Receipt", render: (item) => item.receiptNumber ?? "-" },
          { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
          { key: "method", header: "Method", render: (item) => item.method },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "paidAt", header: "Paid", render: (item) => item.paidAt ? formatDate(item.paidAt) : "-" }
        ]}
      />
    </div>
  );
}
