"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Landmark,
  Search,
  TriangleAlert,
} from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import type { FinanceDashboardView, InvoiceView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import {
  FinanceDataTable,
  FinancePageHeader,
  FinancePanel,
  FinanceStatusBadge,
} from "@/components/finance/finance-studio-ui";

type Props = {
  dashboard: FinanceDashboardView;
};

type DefaulterRow = {
  key: string;
  studentName: string;
  className: string;
  billed: number;
  paid: number;
  balance: number;
  lastPaymentAt?: string;
  invoiceId?: string;
  studentId?: string;
  daysOverdue: number;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function overdueDays(invoice: InvoiceView) {
  if (!invoice.dueOn) return 0;
  const due = new Date(invoice.dueOn);
  const diff = Date.now() - due.getTime();
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
}

function overdueBand(days: number) {
  if (days >= 30) return "CRITICAL";
  if (days >= 8) return "FOLLOW UP";
  if (days >= 1) return "DUE SOON";
  return "NEW";
}

export function FinanceReportsStudio({ dashboard }: Props) {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [rangeFilter, setRangeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const rows = useMemo<DefaulterRow[]>(() => {
    const grouped = new Map<string, DefaulterRow>();
    for (const invoice of dashboard.invoices) {
      if (invoice.balance <= 0) continue;
      const key = invoice.studentId ?? invoice.studentName;
      const current = grouped.get(key) ?? {
        key,
        studentName: invoice.studentName,
        className: invoice.className,
        billed: 0,
        paid: 0,
        balance: 0,
        lastPaymentAt: invoice.lastPaymentAt,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        daysOverdue: overdueDays(invoice),
      };
      current.billed += invoice.total;
      current.balance += invoice.balance;
      current.paid += invoice.total - invoice.balance;
      if (!current.invoiceId || overdueDays(invoice) > current.daysOverdue) {
        current.invoiceId = invoice.id;
      }
      current.daysOverdue = Math.max(current.daysOverdue, overdueDays(invoice));
      current.lastPaymentAt = current.lastPaymentAt ?? invoice.lastPaymentAt;
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.balance - a.balance);
  }, [dashboard.invoices]);

  const classes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.className))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalized ||
        [row.studentName, row.className, row.invoiceId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesClass = classFilter === "ALL" || row.className === classFilter;
      const matchesRange =
        rangeFilter === "ALL"
          ? true
          : rangeFilter === "LOW"
            ? row.balance < 100000
            : rangeFilter === "MID"
              ? row.balance >= 100000 && row.balance < 250000
              : row.balance >= 250000;
      return matchesQuery && matchesClass && matchesRange;
    });
  }, [classFilter, query, rangeFilter, rows]);

  const summary = useMemo(() => {
    const totalOutstanding = filteredRows.reduce((sum, row) => sum + row.balance, 0);
    return {
      totalOutstanding,
      count: filteredRows.length,
      average: filteredRows.length ? totalOutstanding / filteredRows.length : 0,
    };
  }, [filteredRows]);

  async function sendReminder(invoiceId?: string) {
    if (!invoiceId) {
      showToast({
        variant: "warning",
        title: "No invoice to notify",
        description: "This student does not yet have an invoice record linked for reminder delivery.",
      });
      return;
    }
    setSendingInvoiceId(invoiceId);
    try {
      const response = await fetch(`/api/v1/bursary/invoices/${invoiceId}/send`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": getCookie("fr_csrf") ?? "" },
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Could not send reminder.");
      showToast({
        variant: "success",
        title: "Reminder sent",
        description: "The latest invoice reminder has been queued for the parent/guardian.",
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Reminder failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSendingInvoiceId(null);
    }
  }

  async function sendReminderToAll() {
    const invoiceIds = filteredRows.map((row) => row.invoiceId).filter(Boolean) as string[];
    if (!invoiceIds.length) {
      showToast({ variant: "warning", title: "Nothing to remind", description: "There are no defaulters in the current filtered view." });
      return;
    }
    for (const invoiceId of invoiceIds.slice(0, 20)) {
      // Keep MVP-safe: queue a reasonable burst from the filtered view instead of hammering every invoice at once.
      await sendReminder(invoiceId);
    }
  }

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Defaulters report"
        title="Find exposure fast and act before balances age badly"
        description="Track overdue accounts by class, payment behaviour, and balance severity. Trigger reminders, open student ledgers, and move directly into the payment desk."
        actions={
          <>
            <a href="/api/v1/bursary/reports/defaulters?format=pdf" className="finance-btn-secondary">
              <Download className="h-4 w-4" />
              Export PDF
            </a>
            <a href="/api/v1/bursary/reports/defaulters?format=excel" className="finance-btn-ghost">
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </a>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <FinancePanel className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Total defaulters" value={String(summary.count)} helper="Students with unpaid balances" />
            <SummaryCard label="Total outstanding" value={formatCurrency(summary.totalOutstanding)} helper="Open billed value in the filtered view" mono />
            <SummaryCard label="Average balance" value={formatCurrency(summary.average)} helper="Average unpaid amount per defaulter" mono />
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <p className="finance-eyebrow">Collection insight</p>
          <div className="mt-4 grid gap-3">
            <InsightCard
              icon={<TriangleAlert className="h-4 w-4" />}
              title="Critical overdue"
              text={`${rows.filter((row) => row.daysOverdue >= 30).length} student accounts are 30+ days overdue.`}
            />
            <InsightCard
              icon={<CreditCard className="h-4 w-4" />}
              title="Collection share"
              text={`${dashboard.invoices.length ? Math.round((dashboard.payments.reduce((sum, item) => sum + item.amount, 0) / dashboard.invoices.reduce((sum, item) => sum + item.total, 0)) * 100) : 0}% of billed value has already been collected.`}
            />
            <InsightCard
              icon={<Landmark className="h-4 w-4" />}
              title="Next best action"
              text="Prioritise the highest balances first, then clear recent low-balance accounts through quick reminder and payment follow-up."
            />
          </div>
        </FinancePanel>
      </section>

      <FinancePanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="finance-eyebrow">Filters</p>
            <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">
              Defaulter command table
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--finance-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="finance-field min-w-[260px] pl-11"
                placeholder="Search by student, class, or invoice"
              />
            </div>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="finance-select min-w-[180px]">
              <option value="ALL">All classes</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value)} className="finance-select min-w-[180px]">
              <option value="ALL">All balance ranges</option>
              <option value="LOW">Below ₦100k</option>
              <option value="MID">₦100k to ₦249k</option>
              <option value="HIGH">₦250k and above</option>
            </select>
            <button type="button" onClick={sendReminderToAll} className="finance-btn-secondary">
              <BellRing className="h-4 w-4" />
              Send reminder to all
            </button>
          </div>
        </div>

        <div className="mt-6">
          <FinanceDataTable
            rows={filteredRows}
            page={page}
            pageSize={12}
            onPageChange={setPage}
            totalLabel={`Showing ${filteredRows.length} defaulter accounts`}
            stickyFirstColumn
            rowKey={(row) => row.key}
            columns={[
              {
                key: "student",
                header: "Student",
                render: (row) => (
                  <div className="min-w-[220px]">
                    <p className="font-semibold text-[var(--finance-text-primary)]">{row.studentName}</p>
                    <p className="text-xs text-[var(--finance-text-secondary)]">{row.className}</p>
                  </div>
                ),
              },
              {
                key: "billed",
                header: "Total billed",
                align: "right",
                render: (row) => <span className="finance-mono">{formatCurrency(row.billed)}</span>,
              },
              {
                key: "paid",
                header: "Paid",
                align: "right",
                render: (row) => <span className="finance-mono text-emerald-300">{formatCurrency(row.paid)}</span>,
              },
              {
                key: "balance",
                header: "Outstanding",
                align: "right",
                render: (row) => <span className="finance-mono text-rose-300">{formatCurrency(row.balance)}</span>,
              },
              {
                key: "overdue",
                header: "Days overdue",
                render: (row) => <FinanceStatusBadge status={`${overdueBand(row.daysOverdue)} · ${row.daysOverdue}d`} />,
              },
              {
                key: "lastPayment",
                header: "Last payment",
                render: (row) => row.lastPaymentAt ? formatDate(row.lastPaymentAt) : "No payment yet",
              },
            ]}
            rowActions={(row) => (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => sendReminder(row.invoiceId)}
                  className="finance-icon-btn"
                  aria-label={`Send reminder to ${row.studentName}`}
                  disabled={sendingInvoiceId === row.invoiceId}
                >
                  <BellRing className="h-4 w-4" />
                </button>
                {row.studentId ? (
                  <Link href={`/finance/students/${row.studentId}`} className="finance-icon-btn" aria-label={`View ${row.studentName} finance profile`}>
                    <Filter className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link href="/finance/payments" className="finance-icon-btn" aria-label={`Record payment for ${row.studentName}`}>
                  <CreditCard className="h-4 w-4" />
                </Link>
              </div>
            )}
          />
        </div>
      </FinancePanel>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  mono = false,
}: {
  label: string;
  value: string;
  helper: string;
  mono?: boolean;
}) {
  return (
    <div className="finance-soft-surface rounded-2xl px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold text-[var(--finance-text-primary)] ${mono ? "finance-mono" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">{helper}</p>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="finance-soft-surface rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="finance-icon-surface grid h-10 w-10 place-items-center rounded-2xl">{icon}</div>
        <div>
          <p className="font-semibold text-[var(--finance-text-primary)]">{title}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--finance-text-secondary)]">{text}</p>
        </div>
      </div>
    </div>
  );
}
