"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeAlert,
  BadgeDollarSign,
  BookOpenCheck,
  CreditCard,
  FileSpreadsheet,
  ReceiptText,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { ActionMenu, ActionMenuButton, ActionMenuLink } from "@/components/ui/action-menu";
import type { FinanceDashboardView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import {
  FinanceDataTable,
  FinanceEmptyState,
  FinancePageHeader,
  FinancePanel,
  FinanceStatCard,
  FinanceStatusBadge,
} from "@/components/finance/finance-studio-ui";

type Props = {
  dashboard: FinanceDashboardView;
  canManageFinance: boolean;
};

type RangeMode = "term" | "last-term" | "session";

function compactMoney(value: number) {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return formatCurrency(value);
}

function collectionDelta(current: number, prior: number) {
  if (prior <= 0) return { value: "+100%", trend: "up" as const };
  const delta = ((current - prior) / prior) * 100;
  return {
    value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% ${delta >= 0 ? "▲" : "▼"}`,
    trend: delta >= 0 ? "up" as const : "down" as const,
  };
}

function buildTrendSeries(payments: FinanceDashboardView["payments"], mode: RangeMode) {
  const buckets = new Map<string, number>();
  const filtered = payments.filter((payment) => {
    if (!payment.paidAt) return false;
    if (mode === "last-term") return Boolean(payment.term);
    return true;
  });

  for (const payment of filtered) {
    if (!payment.paidAt) continue;
    const date = new Date(payment.paidAt);
    const key = mode === "session"
      ? date.toLocaleDateString("en-NG", { month: "short" })
      : `W${Math.max(1, Math.ceil(date.getDate() / 7))}`;
    buckets.set(key, (buckets.get(key) ?? 0) + payment.amount);
  }

  return Array.from(buckets.entries()).map(([label, amount]) => ({ label, amount }));
}

function AreaChart({ points }: { points: Array<{ label: string; amount: number }> }) {
  const width = 760;
  const height = 260;
  const padding = 24;
  const max = Math.max(...points.map((item) => item.amount), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = padding + step * index;
    const y = height - padding - (point.amount / max) * (height - padding * 2);
    return { ...point, x, y };
  });

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${coords.at(-1)?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
        <defs>
          <linearGradient id="finance-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(45,212,191,0.35)" />
            <stop offset="100%" stopColor="rgba(45,212,191,0.02)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((index) => {
          const y = padding + ((height - padding * 2) / 3) * index;
          return <line key={y} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--finance-chart-grid)" strokeDasharray="4 6" />;
        })}
        <path d={area} fill="url(#finance-area)" />
        <path d={line} fill="none" stroke="#2DD4BF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--finance-chart-point-fill)" stroke="#2DD4BF" strokeWidth="2" />
            <text x={point.x} y={height - 6} fill="var(--finance-text-secondary)" textAnchor="middle" fontSize="11">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function FinanceDashboardStudio({ dashboard, canManageFinance }: Props) {
  const [range, setRange] = useState<RangeMode>("term");
  const [transactionsPage, setTransactionsPage] = useState(1);

  const totalCollected = dashboard.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = dashboard.invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const billed = dashboard.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const monthlyExpenditure = (dashboard.expenditures ?? []).reduce((sum, item) => sum + item.amount, 0);
  const defaulters = useMemo(() => {
    const map = new Map<string, { studentId?: string; studentName: string; className: string; balance: number; lastPaymentAt?: string }>();
    for (const invoice of dashboard.invoices) {
      if (invoice.balance <= 0) continue;
      const entry = map.get(invoice.studentName) ?? {
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        className: invoice.className,
        balance: 0,
        lastPaymentAt: invoice.lastPaymentAt,
      };
      entry.balance += invoice.balance;
      entry.lastPaymentAt = entry.lastPaymentAt ?? invoice.lastPaymentAt;
      map.set(invoice.studentName, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [dashboard.invoices]);

  const priorCollected = Math.max(1, totalCollected - monthlyExpenditure * 0.4);
  const trendPoints = useMemo(() => buildTrendSeries(dashboard.payments, range), [dashboard.payments, range]);
  const recentTransactions = dashboard.payments.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Bursary command"
        title="Financial operations at a glance"
        description="Track fee collection, outstanding balances, defaulters, and cashier activity from a single premium control surface built for real school finance work."
        actions={
          <>
            {canManageFinance ? (
              <>
                <Link href="/finance/payments" className="finance-btn-primary">
                  <BadgeDollarSign className="h-4 w-4" />
                  Record payment
                </Link>
                <Link href="/finance/payroll" className="finance-btn-secondary">
                  <Wallet className="h-4 w-4" />
                  Run payroll
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Total collected this term"
          value={totalCollected}
          delta={collectionDelta(totalCollected, priorCollected)}
          accent="teal"
          helper={`${compactMoney(totalCollected)} collected so far`}
        />
        <FinanceStatCard
          icon={<TriangleAlert className="h-5 w-5" />}
          label="Outstanding balance"
          value={outstanding}
          delta={{ value: `${defaulters.length} accounts`, trend: outstanding > 0 ? "down" : "up" }}
          accent="amber"
          helper={`${billed > 0 ? Math.round((outstanding / billed) * 100) : 0}% of billed fees still open`}
        />
        <FinanceStatCard
          icon={<BadgeAlert className="h-5 w-5" />}
          label="Number of defaulters"
          value={defaulters.length}
          delta={{ value: `${defaulters.filter((item) => item.balance > 100000).length} critical`, trend: defaulters.length ? "down" : "up" }}
          accent="rose"
          helper="Students with at least one unpaid invoice"
        />
        <FinanceStatCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="This month's expenditure"
          value={monthlyExpenditure}
          delta={collectionDelta(monthlyExpenditure, Math.max(1, monthlyExpenditure * 0.84))}
          accent="slate"
          helper={`${dashboard.expenditures?.length ?? 0} ledger entries this month`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <FinancePanel className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="finance-eyebrow">Collection trend</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Cash inflow trajectory</h2>
            </div>
            <div className="finance-soft-surface inline-flex rounded-full p-1">
              {[
                { label: "This Term", value: "term" },
                { label: "Last Term", value: "last-term" },
                { label: "This Session", value: "session" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value as RangeMode)}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm font-semibold transition",
                    range === option.value ? "bg-[#2dd4bf] text-[#03221d]" : "text-[var(--finance-text-secondary)] hover:text-[var(--finance-text-primary)]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            {trendPoints.length > 0 ? (
              <>
                <AreaChart points={trendPoints} />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {trendPoints.slice(-3).map((point) => (
                    <div key={point.label} className="finance-soft-surface rounded-2xl px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">{point.label}</p>
                      <p className="finance-mono mt-2 text-xl font-bold text-[var(--finance-text-primary)]">{compactMoney(point.amount)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <FinanceEmptyState
                title="No collections yet"
                description="Once receipts start flowing in, the collection curve will render here."
              />
            )}
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <p className="finance-eyebrow">Quick actions</p>
          <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Move fast</h2>
          <div className="mt-6 grid gap-3">
            <Link href="/finance/payments" className="finance-soft-surface finance-soft-surface-hover group rounded-2xl px-4 py-4 transition">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="finance-icon-surface grid h-11 w-11 place-items-center rounded-2xl">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--finance-text-primary)]">Record Payment</p>
                    <p className="text-sm text-[var(--finance-text-secondary)]">Cash, transfer, POS, or cheque receipt</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--finance-text-secondary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--finance-text-primary)]" />
              </div>
            </Link>
            <Link href="/finance/fee-structures" className="finance-soft-surface finance-soft-surface-hover group rounded-2xl px-4 py-4 transition">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/16 text-amber-300">
                    <BookOpenCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--finance-text-primary)]">Generate Invoices</p>
                    <p className="text-sm text-[var(--finance-text-secondary)]">Push fee structures into live student billing</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--finance-text-secondary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--finance-text-primary)]" />
              </div>
            </Link>
            <Link href="/finance/payroll" className="finance-soft-surface finance-soft-surface-hover group rounded-2xl px-4 py-4 transition">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500/16 text-rose-300">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--finance-text-primary)]">Run Payroll</p>
                    <p className="text-sm text-[var(--finance-text-secondary)]">Prepare and publish staff payouts</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--finance-text-secondary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--finance-text-primary)]" />
              </div>
            </Link>
            <Link href="/finance/reports" className="finance-soft-surface finance-soft-surface-hover group rounded-2xl px-4 py-4 transition">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="finance-soft-surface-strong grid h-11 w-11 place-items-center rounded-2xl text-[var(--finance-text-secondary)]">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--finance-text-primary)]">Export Report</p>
                    <p className="text-sm text-[var(--finance-text-secondary)]">Defaulters, collections, and income vs expenditure</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--finance-text-secondary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--finance-text-primary)]" />
              </div>
            </Link>
          </div>
        </FinancePanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <FinancePanel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="finance-eyebrow">Cash movement</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Recent transactions</h2>
            </div>
            <Link href="/finance/payments" className="finance-btn-ghost">
              View all
            </Link>
          </div>

          <FinanceDataTable
            rows={recentTransactions}
            page={transactionsPage}
            pageSize={10}
            onPageChange={setTransactionsPage}
            totalLabel={`Showing ${Math.min(transactionsPage * 10, recentTransactions.length)} of ${recentTransactions.length} transactions`}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "receipt",
                header: "Receipt #",
                render: (row) => (
                  <div>
                    <p className="finance-mono text-sm font-semibold text-[var(--finance-accent-primary)]">{row.receiptNumber ?? row.reference}</p>
                    <p className="text-xs text-[var(--finance-text-secondary)]">{row.reference}</p>
                  </div>
                ),
              },
              {
                key: "student",
                header: "Student",
                render: (row) => (
                  <div>
                    <p className="font-medium text-[var(--finance-text-primary)]">{row.studentName}</p>
                    <p className="text-xs text-[var(--finance-text-secondary)]">{row.className ?? "No class"}</p>
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: (row) => <span className="finance-mono text-sm font-semibold text-[var(--finance-text-primary)]">{formatCurrency(row.amount)}</span>,
              },
              {
                key: "method",
                header: "Method",
                render: (row) => row.method.replaceAll("_", " "),
              },
              {
                key: "time",
                header: "Time",
                render: (row) => (row.paidAt ? formatDate(row.paidAt) : "-"),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <FinanceStatusBadge status={row.isReversed ? "REVERSED" : row.status} />,
              },
            ]}
            rowActions={(row) => (
              <ActionMenu triggerLabel={`Actions for ${row.studentName}`}>
                <ActionMenuLink href={`/finance/students/${row.studentId}`}>View student ledger</ActionMenuLink>
                <ActionMenuButton onClick={() => window.open(`/api/v1/bursary/payments/${row.id}/receipt`, "_blank")}>
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Open receipt
                </ActionMenuButton>
              </ActionMenu>
            )}
            emptyState={
              <FinanceEmptyState title="No transactions yet" description="Payment activity will appear here after the first receipt is recorded." />
            }
            stickyFirstColumn
          />
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="finance-eyebrow">Recovery watch</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Top defaulters</h2>
            </div>
            <Link href="/finance/reports" className="finance-btn-ghost">
              Full report
            </Link>
          </div>

          <div className="grid gap-3">
            {defaulters.slice(0, 6).map((debtor) => (
              <div key={`${debtor.studentName}-${debtor.className}`} className="finance-soft-surface rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-rose-500/14 text-sm font-bold text-rose-300">
                      {debtor.studentName
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--finance-text-primary)]">{debtor.studentName}</p>
                      <p className="text-xs text-[var(--finance-text-secondary)]">{debtor.className}</p>
                    </div>
                  </div>
                  <p className="finance-mono text-sm font-semibold text-rose-300">{formatCurrency(debtor.balance)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--finance-text-secondary)]">
                    {debtor.lastPaymentAt ? `Last paid ${formatDate(debtor.lastPaymentAt)}` : "No payment recorded yet"}
                  </p>
                  <div className="flex items-center gap-2">
                    {debtor.studentId ? (
                      <Link href={`/finance/students/${debtor.studentId}`} className="finance-btn-secondary min-h-[36px] px-3">
                        <ArrowRight className="h-4 w-4" />
                        View
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {defaulters.length === 0 ? (
              <FinanceEmptyState title="No defaulters" description="All visible students are currently settled." />
            ) : null}
          </div>
        </FinancePanel>
      </section>
    </div>
  );
}
