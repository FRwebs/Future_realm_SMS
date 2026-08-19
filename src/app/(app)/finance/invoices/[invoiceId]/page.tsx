import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ invoiceId: string }> };

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: string;
  discount: string;
  fine: string;
  total: string;
  balance: string;
  issuedOn: string;
  dueOn: string;
  student: { firstName: string; lastName: string; currentClass?: { name: string; arm: string | null } | null };
  items: Array<{ id: string; description: string; amount: string; quantity: number }>;
  payments: Array<{ id: string; reference: string; amount: string; status: string; method: string; paidAt?: string }>;
  receipts: Array<{ id: string; receiptNumber: string; amount: string; status: string; issuedAt: string }>;
  adjustments: Array<{ id: string; type: string; amount: string; reason: string; createdAt: string }>;
};

function className(classRoom?: { name: string; arm: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const { invoiceId } = await params;
  const invoice = await apiGet<InvoiceDetail>(`/api/v1/finance/invoices/${invoiceId}`);
  const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <a href="/finance" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{invoice.invoiceNumber}</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {studentName} · {className(invoice.student.currentClass)} · {invoice.status}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["Subtotal", Number(invoice.subtotal)],
          ["Discount", Number(invoice.discount)],
          ["Fine", Number(invoice.fine)],
          ["Total", Number(invoice.total)],
          ["Balance", Number(invoice.balance)]
        ].map(([label, value]) => (
          <article key={label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(Number(value))}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Invoice items"
          description={`Issued ${formatDate(invoice.issuedOn)} · Due ${formatDate(invoice.dueOn)}`}
          items={invoice.items}
          columns={[
            { key: "description", header: "Item", render: (item) => item.description },
            { key: "quantity", header: "Qty", render: (item) => item.quantity },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(Number(item.amount)) }
          ]}
        />
        <TableCard
          title="Receipts"
          description="Receipts issued for successful payments."
          items={invoice.receipts}
          columns={[
            { key: "receipt", header: "Receipt", render: (item) => item.receiptNumber },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(Number(item.amount)) },
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "issuedAt", header: "Issued", render: (item) => formatDate(item.issuedAt) }
          ]}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Payments"
          description="Payment history and allocation sources."
          items={invoice.payments}
          columns={[
            { key: "reference", header: "Reference", render: (item) => item.reference },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(Number(item.amount)) },
            { key: "method", header: "Method", render: (item) => item.method },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
        <TableCard
          title="Adjustments"
          description="Discounts, waivers, scholarships, and fines."
          items={invoice.adjustments}
          columns={[
            { key: "type", header: "Type", render: (item) => item.type },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(Number(item.amount)) },
            { key: "reason", header: "Reason", render: (item) => item.reason },
            { key: "createdAt", header: "When", render: (item) => formatDate(item.createdAt) }
          ]}
        />
      </section>
    </div>
  );
}
