import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
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
  if (!canAccessPath(session.role, "/finance")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const { invoiceId } = await params;
  const invoice = await apiGet<InvoiceDetail>(`/api/v1/finance/invoices/${invoiceId}`);
  const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{invoice.invoiceNumber}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
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
          <article key={label} className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">{label}</p>
            <p className="mt-3 text-2xl font-bold text-ink">{formatCurrency(Number(value))}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
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

      <section className="grid gap-6 xl:grid-cols-2">
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
