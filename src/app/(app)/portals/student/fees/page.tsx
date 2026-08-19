import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalFinanceItem } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function StudentFeesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const fees = await apiGet<PortalFinanceItem[]>("/api/v1/student-portal/fees");
  const outstanding = fees.reduce((sum, item) => sum + item.balance, 0);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My fees</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Read-only invoice and payment summary. Financial edits are restricted to the bursary/accounting team.
        </p>
        <p className="mt-5 font-[var(--font-heading)] text-[24px] font-bold text-[var(--color-text-primary)]">{formatCurrency(outstanding)} outstanding</p>
      </section>

      <TableCard
        title="Invoices"
        description="Invoices, balances, due dates, and payment status."
        items={fees}
        columns={[
          { key: "title", header: "Invoice", render: (item) => item.title },
          { key: "amount", header: "Total", render: (item) => formatCurrency(item.amount) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) },
          { key: "status", header: "Status", render: (item) => item.status }
        ]}
      />

      <section className="surface-card p-6">
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Payment history</h2>
        <div className="mt-5 grid gap-3">
          {fees.flatMap((invoice) => invoice.payments ?? []).map((payment) => (
            <article key={payment.id} className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4 text-[13px] text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">{payment.reference}</p>
              <p>{formatCurrency(payment.amount)} · {payment.method} · {payment.status}</p>
              {payment.receiptNumber ? <p>Receipt: {payment.receiptNumber}</p> : null}
              <p>{payment.paidAt ? formatDate(payment.paidAt) : "Pending confirmation"}</p>
            </article>
          ))}
          {fees.flatMap((invoice) => invoice.payments ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)]">No payment records are visible yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
