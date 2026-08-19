import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PayInvoiceButton } from "@/components/portals/pay-invoice-button";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalFinanceItem } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };

export default async function ParentChildFeesPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const fees = await apiGet<PortalFinanceItem[]>(`/api/v1/parent-portal/children/${studentId}/fees`);
  const outstanding = fees.reduce((sum, item) => sum + item.balance, 0);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/portals/parent/children/${studentId}` as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to child overview</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Child fees</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Invoice, payment, and receipt records for this child. Outstanding invoices can be paid through the school&apos;s configured online payment flow.</p>
        <p className="mt-5 text-[24px] font-bold text-[var(--color-text-primary)]">{formatCurrency(outstanding)} outstanding</p>
      </section>
      <TableCard
        title="Invoices"
        description="Invoice totals, balances, due dates, and statuses."
        items={fees}
        columns={[
          { key: "title", header: "Invoice", render: (item) => item.title },
          { key: "amount", header: "Total", render: (item) => formatCurrency(item.amount) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "due", header: "Due", render: (item) => formatDate(item.dueOn) },
          { key: "status", header: "Status", render: (item) => item.status },
          {
            key: "action",
            header: "Action",
            render: (item) =>
              item.canPay && item.balance > 0 ? (
                <PayInvoiceButton invoiceId={item.id} amount={item.balance} />
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">No payment due</span>
              )
          }
        ]}
      />
      <section className="surface-card p-6">
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Payment receipts</h2>
        <div className="mt-5 grid gap-3">
          {fees.flatMap((invoice) => invoice.payments ?? []).map((payment) => (
            <article key={payment.id} className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4 text-[13px] text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">{payment.reference}</p>
              <p>{formatCurrency(payment.amount)} · {payment.method} · {payment.status}</p>
              <p>{payment.receiptNumber ? `Receipt: ${payment.receiptNumber}` : "Receipt pending"}</p>
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
