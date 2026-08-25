import { BadgeDollarSign, BadgePercent, BookOpenCheck, CircleDollarSign, ReceiptText, TriangleAlert } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type {
  ExpenditureView,
  FeesModuleDiscountView,
  FeeStructureView,
  FinanceDashboardView,
  PaymentView
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type FinancePageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

const invoiceStatusTone: Record<string, { background: string; color: string }> = {
  DRAFT: { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" },
  ISSUED: { background: "var(--color-info-dim)", color: "var(--color-info)" },
  PARTIALLY_PAID: { background: "var(--color-warning-dim)", color: "var(--color-warning)" },
  PAID: { background: "var(--color-success-dim)", color: "var(--color-success)" },
  OVERDUE: { background: "var(--color-danger-dim)", color: "var(--color-danger)" },
  VOID: { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }
};

const paymentStatusTone: Record<string, { background: string; color: string }> = {
  SUCCESS: { background: "var(--color-success-dim)", color: "var(--color-success)" },
  PENDING: { background: "var(--color-warning-dim)", color: "var(--color-warning)" },
  FAILED: { background: "var(--color-danger-dim)", color: "var(--color-danger)" },
  REVERSED: { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }
};

const adjustmentTypeTone: Record<string, { background: string; color: string }> = {
  DISCOUNT: { background: "var(--color-info-dim)", color: "var(--color-info)" },
  WAIVER: { background: "var(--color-warning-dim)", color: "var(--color-warning)" },
  SCHOLARSHIP: { background: "var(--color-success-dim)", color: "var(--color-success)" }
};

function statusTone(map: Record<string, { background: string; color: string }>, key: string) {
  return map[key] ?? { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" };
}

function tabHref(tab: string) {
  return tab === "structure" ? "/finance" : `/finance?tab=${tab}`;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "structure";

  const permissions = await getServerPermissions(session);
  const canManageFinance = permissions.some((permission) =>
    ["fees.create", "fees.edit", "fees.collect", "fees.approve", "fees.apply_waiver", "fees.create_receipt", "fees.edit_payment"].includes(
      permission
    )
  );

  const tabs = [
    { label: "Fee Structure", href: tabHref("structure"), active: tab === "structure" },
    { label: "Payments", href: tabHref("payments"), active: tab === "payments" },
    { label: "Outstanding", href: tabHref("outstanding"), active: tab === "outstanding" },
    { label: "Discounts & Expenses", href: tabHref("discounts"), active: tab === "discounts" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Fee &amp; financial management</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">
              Financial operations at a glance
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Fee structures, payments, outstanding balances, and discounts &amp; expenses — pulled live from the
              school&apos;s finance ledger, with the full editing workspaces one click away.
            </p>
          </div>
          {canManageFinance ? (
            <a href="/finance/payments" className="btn-primary inline-flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4" />
              Record payment
            </a>
          ) : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "structure" ? <StructureTab /> : null}
      {tab === "payments" ? <PaymentsTab /> : null}
      {tab === "outstanding" ? <OutstandingTab /> : null}
      {tab === "discounts" ? <DiscountsExpensesTab /> : null}
    </div>
  );
}

async function StructureTab() {
  const structures = await apiGet<FeeStructureView[]>("/api/v1/bursary/fee-structures");

  const activeStructures = structures.filter((structure) => structure.isActive);
  const categories = new Set(structures.flatMap((structure) => structure.items.map((item) => item.componentType)));
  const totalTermlyValue = structures
    .filter((structure) => structure.isActive && structure.recurrence === "TERM")
    .reduce((sum, structure) => sum + structure.total, 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fee structures" value={structures.length} icon={BookOpenCheck} />
        <StatCard label="Active structures" value={activeStructures.length} tone="success" />
        <StatCard label="Fee categories in use" value={categories.size} tone="info" />
        <StatCard label="Total termly fee value" value={formatCurrency(totalTermlyValue)} tone="accent" />
      </section>

      <TableCard
        title="Fee structures"
        description="Every fee structure configured for the school, with recurrence, item count, and total value per structure."
        items={structures}
        emptyState="No fee structures have been created yet."
        primaryColumnKey="name"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "name",
            header: "Structure",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {item.session ?? "No session"}
                  {item.term ? ` · ${item.term}` : ""}
                  {item.className ? ` · ${item.className}` : ""}
                </p>
              </div>
            )
          },
          { key: "recurrence", header: "Recurrence", render: (item) => (item.isOneTime ? "One-time" : item.recurrence) },
          { key: "items", header: "Items", render: (item) => item.items.length },
          { key: "total", header: "Total", render: (item) => <span className="font-semibold">{formatCurrency(item.total)}</span> },
          {
            key: "isActive",
            header: "Status",
            render: (item) => (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={item.isActive ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}
              >
                {item.isActive ? "Active" : "Inactive"}
              </span>
            )
          }
        ]}
      />

      <a href="/finance/fee-structures" className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline">
        Open full Fee Structures workspace →
      </a>
    </div>
  );
}

async function PaymentsTab() {
  const [payments, dashboard] = await Promise.all([
    apiGet<PaymentView[]>("/api/v1/bursary/payments"),
    apiGet<FinanceDashboardView>("/api/v1/bursary/dashboard")
  ]);

  const successfulPayments = payments.filter((payment) => payment.status === "SUCCESS" && !payment.isReversed);
  const totalCollected = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const reversedCount = payments.filter((payment) => payment.isReversed).length;
  const collectionRateMetric = dashboard.metrics.find((metric) => metric.label === "Collection rate")?.value ?? "0%";
  const recentPayments = [...payments].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")).slice(0, 25);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={formatCurrency(totalCollected)} icon={CircleDollarSign} tone="success" />
        <StatCard label="Payments recorded" value={payments.length} />
        <StatCard label="Collection rate" value={collectionRateMetric} tone="info" />
        <StatCard label="Reversed payments" value={reversedCount} tone={reversedCount > 0 ? "danger" : "neutral"} />
      </section>

      <TableCard
        title="Recent payments"
        description="The most recent payments recorded across cash, transfer, POS, and online channels."
        items={recentPayments}
        emptyState="No payments have been recorded yet."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "receiptNumber",
            header: "Receipt #",
            render: (item) => (
              <div>
                <p className="font-mono text-[12px] font-semibold text-[var(--color-text-accent)]">{item.receiptNumber ?? item.reference}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.reference}</p>
              </div>
            )
          },
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.className ?? "No class"}</p>
              </div>
            )
          },
          { key: "amount", header: "Amount", render: (item) => <span className="font-semibold">{formatCurrency(item.amount)}</span> },
          { key: "method", header: "Method", render: (item) => item.method.replaceAll("_", " ") },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={statusTone(paymentStatusTone, item.isReversed ? "REVERSED" : item.status)}>
                {item.isReversed ? "REVERSED" : item.status}
              </span>
            )
          },
          { key: "paidAt", header: "Date", render: (item) => (item.paidAt ? formatDate(item.paidAt) : "—") }
        ]}
      />

      <a href="/finance/payments" className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline">
        Open full Payments workspace →
      </a>
    </div>
  );
}

async function OutstandingTab() {
  const dashboard = await apiGet<FinanceDashboardView>("/api/v1/bursary/dashboard");
  const outstandingInvoices = [...dashboard.invoices]
    .filter((invoice) => invoice.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const totalOutstanding = outstandingInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const accountsOwing = new Set(outstandingInvoices.map((invoice) => invoice.studentId ?? invoice.studentName)).size;
  const overdueCount = outstandingInvoices.filter((invoice) => invoice.status === "OVERDUE").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total outstanding" value={formatCurrency(totalOutstanding)} icon={TriangleAlert} tone="warning" />
        <StatCard label="Accounts owing" value={accountsOwing} tone="danger" />
        <StatCard label="Overdue invoices" value={overdueCount} tone="danger" />
        <StatCard label="Open invoices" value={outstandingInvoices.length} />
      </section>

      <TableCard
        title="Outstanding balances"
        description="Invoices with an unpaid balance, sorted from the highest amount owing."
        items={outstandingInvoices}
        emptyState="No students currently owe an outstanding balance."
        primaryColumnKey="studentName"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber ?? "—"} · {item.className}</p>
              </div>
            )
          },
          { key: "invoiceNumber", header: "Invoice #", render: (item) => <span className="font-mono text-[12px]">{item.invoiceNumber}</span> },
          { key: "total", header: "Total billed", render: (item) => formatCurrency(item.total) },
          { key: "balance", header: "Balance owing", render: (item) => <span className="font-semibold" style={{ color: "var(--color-danger)" }}>{formatCurrency(item.balance)}</span> },
          { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={statusTone(invoiceStatusTone, item.status)}>
                {item.status.replaceAll("_", " ")}
              </span>
            )
          }
        ]}
      />
    </div>
  );
}

async function DiscountsExpensesTab() {
  const [discounts, expenses] = await Promise.all([
    apiGet<FeesModuleDiscountView[]>("/api/v1/finance/discounts"),
    apiGet<ExpenditureView[]>("/api/v1/bursary/expenditures")
  ]);

  const totalDiscounted = discounts.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Discounts & waivers" value={discounts.length} icon={BadgePercent} tone="info" />
        <StatCard label="Total discounted" value={formatCurrency(totalDiscounted)} tone="info" />
        <StatCard label="Expense entries" value={expenses.length} icon={ReceiptText} />
        <StatCard label="Total expenses" value={formatCurrency(totalExpenses)} tone="warning" />
      </section>

      <TableCard
        title="Discounts, waivers & scholarships"
        description="Adjustments applied to student invoices — discounts, fee waivers, and scholarship credits."
        items={discounts}
        emptyState="No discounts, waivers, or scholarship credits have been applied yet."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber ?? "—"} · {item.className ?? "No class"}</p>
              </div>
            )
          },
          {
            key: "type",
            header: "Type",
            render: (item) => (
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={statusTone(adjustmentTypeTone, item.type)}>
                {item.type}
              </span>
            )
          },
          {
            key: "amount",
            header: "Value",
            render: (item) => (
              <span className="font-semibold">
                {item.valueType === "PERCENTAGE" ? `${item.value}% (${formatCurrency(item.amount)})` : formatCurrency(item.amount)}
              </span>
            )
          },
          { key: "reason", header: "Reason", render: (item) => item.reason },
          { key: "approvedByName", header: "Approved by", render: (item) => item.approvedByName ?? item.appliedByName ?? "—" },
          { key: "createdAt", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Recent expenses"
        description="Operating expenses recorded by the bursary team, most recent first."
        items={expenses}
        emptyState="No expenses have been recorded yet."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "description",
            header: "Expense",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.description}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.category}</p>
              </div>
            )
          },
          { key: "amount", header: "Amount", render: (item) => <span className="font-semibold">{formatCurrency(item.amount)}</span> },
          { key: "paymentMethod", header: "Method", render: (item) => item.paymentMethod ?? "—" },
          { key: "paidTo", header: "Paid to", render: (item) => item.paidTo ?? "—" },
          { key: "expenditureDate", header: "Date", render: (item) => formatDate(item.expenditureDate) }
        ]}
      />

      <a href="/finance/expenditures" className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline">
        Open full Expenditures workspace →
      </a>
    </div>
  );
}
