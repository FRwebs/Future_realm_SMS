import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole, hasRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PaymentView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function PaymentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/finance")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const payments = await apiGet<PaymentView[]>("/api/v1/finance/payments");
  const canManageFinance = hasRole(session.role, ["SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT"]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Payments and adjustments</h1>
      </section>

      {canManageFinance ? <section className="grid gap-6 xl:grid-cols-2">
        <ResourceForm
          title="Manual payment"
          description="For cash, transfer, or POS payments recorded by the bursar. Successful payments allocate to the invoice and issue a receipt."
          endpoint="/api/v1/finance/payments/manual"
          submitLabel="Record payment"
          fields={[
            { name: "invoiceId", label: "Invoice ID", required: true },
            { name: "reference", label: "Reference", placeholder: "Bank/POS/cash reference" },
            { name: "amount", label: "Amount", type: "number", required: true, defaultValue: 50000, min: 1 },
            { name: "paidAt", label: "Paid at", type: "date" },
            { name: "method", label: "Method", type: "select", options: [{ label: "Transfer", value: "TRANSFER" }, { label: "Cash", value: "CASH" }, { label: "POS", value: "POS" }] },
            { name: "provider", label: "Provider record", type: "select", options: [{ label: "Paystack", value: "PAYSTACK" }, { label: "Flutterwave", value: "FLUTTERWAVE" }] },
            { name: "note", label: "Note", type: "textarea", placeholder: "Bank teller, teller name, or verification note." }
          ]}
        />
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
