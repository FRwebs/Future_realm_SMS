"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  Filter,
  FolderClock,
  Landmark,
  Layers3,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { ManualPaymentModal } from "@/components/finance/manual-payment-modal";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import type {
  FinanceDashboardView,
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type FinanceOperationsWorkspaceProps = {
  dashboard: FinanceDashboardView;
  canManageFinance: boolean;
};

type TabId = "overview" | "invoices" | "payments" | "installments" | "audit";

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
  label,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm">
      <p className="text-slate-500">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-14 text-center">
      <FolderClock className="h-10 w-10 text-slate-300" />
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function tabClass(active: boolean) {
  return active
    ? "text-brand-700"
    : "text-slate-500 hover:text-slate-700";
}

export function FinanceOperationsWorkspace({
  dashboard,
  canManageFinance,
}: FinanceOperationsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const invoices = dashboard.invoices;
  const payments = dashboard.payments;
  const installmentPlans = dashboard.installmentPlans;
  const feeStructures = dashboard.feeStructures;

  const sessionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...invoices.map((item) => item.session).filter(Boolean),
            ...payments.map((item) => item.session).filter(Boolean),
            ...installmentPlans.map((item) => item.session).filter(Boolean),
            ...feeStructures.map((item) => item.session).filter(Boolean),
          ] as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [feeStructures, installmentPlans, invoices, payments],
  );

  const termOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...invoices.map((item) => item.term).filter(Boolean),
            ...payments.map((item) => item.term).filter(Boolean),
            ...installmentPlans.map((item) => item.term).filter(Boolean),
            ...feeStructures.map((item) => item.term).filter(Boolean),
          ] as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [feeStructures, installmentPlans, invoices, payments],
  );

  const levelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...invoices.map((item) => item.classLevel).filter(Boolean),
            ...payments.map((item) => item.classLevel).filter(Boolean),
            ...installmentPlans.map((item) => item.classLevel).filter(Boolean),
          ] as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [installmentPlans, invoices, payments],
  );

  const feeStructureOptions = useMemo(
    () =>
      feeStructures.map((item) => ({
        label: [item.name, item.session, item.term].filter(Boolean).join(" · "),
        value: item.id,
      })),
    [feeStructures],
  );

  const studentOutstanding = useMemo(() => {
    const ledger = new Map<
      string,
      { studentId?: string; studentName: string; className: string; classLevel?: string; balance: number; invoices: number; session?: string; term?: string }
    >();

    for (const invoice of invoices) {
      const current =
        ledger.get(invoice.studentName) ??
        {
          studentId: invoice.studentId,
          studentName: invoice.studentName,
          className: invoice.className,
          classLevel: invoice.classLevel,
          balance: 0,
          invoices: 0,
          session: invoice.session,
          term: invoice.term,
        };
      current.balance += invoice.balance;
      current.invoices += 1;
      ledger.set(invoice.studentName, current);
    }

    return Array.from(ledger.values())
      .filter((item) => item.balance > 0)
      .sort((left, right) => right.balance - left.balance)
      .slice(0, 8);
  }, [invoices]);

  const termSummary = useMemo(() => {
    const grouped = new Map<string, { label: string; billed: number; paid: number; balance: number; invoices: number }>();
    for (const invoice of invoices) {
      const label = [invoice.session, invoice.term].filter(Boolean).join(" · ") || "Unclassified";
      const bucket = grouped.get(label) ?? { label, billed: 0, paid: 0, balance: 0, invoices: 0 };
      bucket.billed += invoice.total;
      bucket.paid += invoice.paid ?? 0;
      bucket.balance += invoice.balance;
      bucket.invoices += 1;
      grouped.set(label, bucket);
    }
    return Array.from(grouped.values()).sort((a, b) => b.label.localeCompare(a.label));
  }, [invoices]);

  const levelSummary = useMemo(() => {
    const grouped = new Map<string, { label: string; billed: number; paid: number; balance: number; students: Set<string> }>();
    for (const invoice of invoices) {
      const label = invoice.classLevel || "Unknown level";
      const bucket =
        grouped.get(label) ?? { label, billed: 0, paid: 0, balance: 0, students: new Set<string>() };
      bucket.billed += invoice.total;
      bucket.paid += invoice.paid ?? 0;
      bucket.balance += invoice.balance;
      if (invoice.studentId) bucket.students.add(invoice.studentId);
      grouped.set(label, bucket);
    }
    return Array.from(grouped.values()).map((item) => ({
      label: item.label,
      billed: item.billed,
      paid: item.paid,
      balance: item.balance,
      students: item.students.size,
    }));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [
          invoice.studentName,
          invoice.admissionNumber ?? "",
          invoice.invoiceNumber,
          invoice.className,
          invoice.classLevel ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesSession = !sessionFilter || invoice.session === sessionFilter;
      const matchesTerm = !termFilter || invoice.term === termFilter;
      const matchesLevel = !levelFilter || invoice.classLevel === levelFilter;
      const matchesStatus = statusFilter === "ALL" || invoice.status === statusFilter;
      return matchesQuery && matchesSession && matchesTerm && matchesLevel && matchesStatus;
    });
  }, [invoices, levelFilter, search, sessionFilter, statusFilter, termFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [
          payment.studentName,
          payment.admissionNumber ?? "",
          payment.reference,
          payment.invoiceNumber ?? "",
          payment.className ?? "",
          payment.recordedByName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesSession = !sessionFilter || payment.session === sessionFilter;
      const matchesTerm = !termFilter || payment.term === termFilter;
      const matchesLevel = !levelFilter || payment.classLevel === levelFilter;
      const matchesStatus =
        statusFilter === "ALL" || payment.status === statusFilter || payment.method === statusFilter;
      return matchesQuery && matchesSession && matchesTerm && matchesLevel && matchesStatus;
    });
  }, [levelFilter, payments, search, sessionFilter, statusFilter, termFilter]);

  const filteredPlans = useMemo(() => {
    return installmentPlans.filter((plan) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [plan.studentName, plan.invoiceNumber ?? "", plan.planNumber, plan.className ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesSession = !sessionFilter || plan.session === sessionFilter;
      const matchesTerm = !termFilter || plan.term === termFilter;
      const matchesLevel = !levelFilter || plan.classLevel === levelFilter;
      const matchesStatus = statusFilter === "ALL" || plan.status === statusFilter;
      return matchesQuery && matchesSession && matchesTerm && matchesLevel && matchesStatus;
    });
  }, [installmentPlans, levelFilter, search, sessionFilter, statusFilter, termFilter]);

  const filteredAudit = useMemo(() => {
    return dashboard.auditTrail.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [item.action, item.entityType, item.detail, item.entityId].join(" ").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || item.action === statusFilter || item.entityType === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [dashboard.auditTrail, search, statusFilter]);

  const paginatedInvoices = useMemo(() => paginate(filteredInvoices, page, 12), [filteredInvoices, page]);
  const paginatedPayments = useMemo(() => paginate(filteredPayments, page, 12), [filteredPayments, page]);
  const paginatedPlans = useMemo(() => paginate(filteredPlans, page, 10), [filteredPlans, page]);
  const paginatedAudit = useMemo(() => paginate(filteredAudit, page, 12), [filteredAudit, page]);

  const overdueCount = invoices.filter((invoice) => invoice.status === "OVERDUE").length;
  const studentBalanceCount = studentOutstanding.length;
  const paymentMethodsCount = new Set(payments.map((item) => item.method)).size;

  const statusOptions = useMemo(() => {
    if (activeTab === "payments") {
      return ["ALL", ...Array.from(new Set([...payments.map((item) => item.status), ...payments.map((item) => item.method)]))];
    }
    if (activeTab === "installments") {
      return ["ALL", ...Array.from(new Set(installmentPlans.map((item) => item.status)))];
    }
    if (activeTab === "audit") {
      return ["ALL", ...Array.from(new Set(dashboard.auditTrail.map((item) => item.action)))];
    }
    return ["ALL", ...Array.from(new Set(invoices.map((item) => item.status)))];
  }, [activeTab, dashboard.auditTrail, installmentPlans, invoices, payments]);

  function resetFilters() {
    setSearch("");
    setSessionFilter("");
    setTermFilter("");
    setLevelFilter("");
    setStatusFilter("ALL");
    setPage(1);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Finance operations</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Fees, payments, and clearance</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Run the bursary desk from one workspace: issue invoices, generate class-wide term billing, record cash and transfer payments, apply waivers, manage installment plans, and review history across students, sessions, terms, and levels.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/finance/fee-structures" className="btn-secondary px-4">
              <Layers3 className="h-4 w-4" />
              Fee structures
            </Link>
            <Link href="/finance/reports" className="btn-secondary px-4">
              <FileSpreadsheet className="h-4 w-4" />
              Reports
            </Link>
            <Link href="/finance/payroll" className="btn-secondary px-4">
              <Landmark className="h-4 w-4" />
              Staff payroll
            </Link>
            {canManageFinance ? <ManualPaymentModal invoices={invoices} /> : null}
            <ActionMenu triggerLabel="More finance actions">
              <ActionMenuLink href="/finance/payments">Open payments desk</ActionMenuLink>
              <ActionMenuLink href="/finance/installments">Open installment plans</ActionMenuLink>
              <ActionMenuLink href="/finance/expenditures">Open expenditure register</ActionMenuLink>
              <ActionMenuLink href="/finance/audit">Open audit log</ActionMenuLink>
              <ActionMenuLink href="/finance/settings">Open finance settings</ActionMenuLink>
              {canManageFinance ? (
                <>
                  <ResourceActionDialog
                    triggerLabel="Create invoice"
                    title="Single student invoice"
                    description="Issue one invoice for a student and tie it to the live school ledger."
                    endpoint="/api/v1/finance/invoices"
                    submitLabel="Create invoice"
                    confirmLabel="Confirm invoice"
                    confirmMessage="Review the student, fee components, and due date before issuing this invoice."
                    variant="menu"
                    presentation="drawer"
                    fields={[
                      { name: "studentId", label: "Student ID", required: true, placeholder: "Student database ID" },
                      { name: "studentName", label: "Student name", required: true, placeholder: "Adebayo Daniel" },
                      { name: "className", label: "Class", required: true, placeholder: "JSS 2 Gold" },
                      { name: "tuition", label: "Tuition", type: "number", required: true, defaultValue: 200000, min: 0 },
                      { name: "transport", label: "Transport", type: "number", defaultValue: 0, min: 0 },
                      { name: "developmentLevy", label: "Development levy", type: "number", defaultValue: 0, min: 0 },
                      { name: "discount", label: "Discount", type: "number", defaultValue: 0, min: 0 },
                      { name: "fine", label: "Fine", type: "number", defaultValue: 0, min: 0 },
                      { name: "dueOn", label: "Due date", type: "date", required: true },
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Generate invoices"
                    title="Bulk term invoices"
                    description="Generate invoices from a fee structure for a class or selected group."
                    endpoint="/api/v1/finance/invoices/generate"
                    submitLabel="Generate invoices"
                    confirmLabel="Confirm generation"
                    confirmMessage="This will create invoices for all eligible students who do not already have one for this structure."
                    variant="menu"
                    presentation="drawer"
                    fields={[
                      { name: "feeStructureId", label: "Fee structure", type: "select", required: true, options: feeStructureOptions },
                      { name: "classId", label: "Class ID", placeholder: "Optional class filter" },
                      { name: "dueOn", label: "Due date", type: "date" },
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Verify online payment"
                    title="Verify online payment"
                    description="Verify a gateway reference and complete allocation with receipt generation."
                    endpoint="/api/v1/finance/payments/verify"
                    submitLabel="Verify payment"
                    variant="menu"
                    presentation="drawer"
                    fields={[{ name: "reference", label: "Payment reference", required: true, placeholder: "PAY-..." }]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Apply discount / scholarship"
                    title="Discount or scholarship"
                    description="Apply an approved fixed or percentage reduction to an open invoice."
                    endpoint="/api/v1/finance/discounts"
                    submitLabel="Apply adjustment"
                    variant="menu"
                    presentation="drawer"
                    fields={[
                      { name: "invoiceId", label: "Invoice ID", required: true },
                      { name: "type", label: "Type", type: "select", options: [{ label: "Discount", value: "DISCOUNT" }, { label: "Scholarship", value: "SCHOLARSHIP" }] },
                      { name: "valueType", label: "Value type", type: "select", options: [{ label: "Fixed amount", value: "FIXED" }, { label: "Percentage", value: "PERCENTAGE" }] },
                      { name: "value", label: "Value", type: "number", required: true, min: 0.01 },
                      { name: "reason", label: "Approval reason", type: "textarea", required: true },
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Apply waiver"
                    title="Apply waiver"
                    description="Apply an approved waiver to a student invoice."
                    endpoint="/api/v1/finance/waivers"
                    submitLabel="Apply waiver"
                    variant="menu"
                    presentation="drawer"
                    fields={[
                      { name: "invoiceId", label: "Invoice ID", required: true },
                      { name: "type", label: "Type", type: "select", options: [{ label: "Waiver", value: "WAIVER" }] },
                      { name: "valueType", label: "Value type", type: "select", options: [{ label: "Fixed amount", value: "FIXED" }, { label: "Percentage", value: "PERCENTAGE" }] },
                      { name: "value", label: "Value", type: "number", required: true, min: 0.01 },
                      { name: "reason", label: "Approval reason", type: "textarea", required: true },
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Create installment plan"
                    title="Create installment plan"
                    description="Split an outstanding balance into a structured payment agreement."
                    endpoint="/api/v1/finance/installment-plans"
                    submitLabel="Create plan"
                    variant="menu"
                    presentation="drawer"
                    fields={[
                      { name: "invoiceId", label: "Invoice ID", required: true },
                      { name: "installment1Due", label: "Installment 1 due", type: "date", required: true },
                      { name: "installment1Amount", label: "Installment 1 amount", type: "number", required: true, min: 1 },
                      { name: "installment2Due", label: "Installment 2 due", type: "date" },
                      { name: "installment2Amount", label: "Installment 2 amount", type: "number", min: 0 },
                      { name: "installment3Due", label: "Installment 3 due", type: "date" },
                      { name: "installment3Amount", label: "Installment 3 amount", type: "number", min: 0 },
                      { name: "notes", label: "Agreement note", type: "textarea" },
                    ]}
                  />
                </>
              ) : null}
            </ActionMenu>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{metric.value}</p>
          </article>
        ))}
        <article className="rounded-[1.5rem] border border-rose-100 bg-rose-50/70 p-5 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">Overdue invoices</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-rose-700">{overdueCount}</p>
        </article>
        <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 p-5 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">Students with balance</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-amber-800">{studentBalanceCount}</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-5 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payment channels used</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{paymentMethodsCount}</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-5 shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {(
            [
              { id: "overview" as TabId, label: "Overview", icon: ShieldCheck },
              { id: "invoices" as TabId, label: "Invoices", icon: ReceiptText },
              { id: "payments" as TabId, label: "Payments", icon: CreditCard },
              { id: "installments" as TabId, label: "Installments", icon: CalendarRange },
              { id: "audit" as TabId, label: "Audit", icon: RefreshCw },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setPage(1);
              }}
              className={`relative flex h-11 items-center gap-2 px-4 text-sm font-semibold transition ${tabClass(activeTab === id)}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {activeTab === id ? (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-brand-700" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_220px_220px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search student, admission number, invoice, reference, or class"
              className="field-control h-11 w-full pl-10"
            />
          </label>

          <select
            value={sessionFilter}
            onChange={(event) => {
              setSessionFilter(event.target.value);
              setPage(1);
            }}
            className="field-select h-11"
          >
            <option value="">All sessions</option>
            {sessionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={termFilter}
            onChange={(event) => {
              setTermFilter(event.target.value);
              setPage(1);
            }}
            className="field-select h-11"
          >
            <option value="">All terms</option>
            {termOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={levelFilter}
            onChange={(event) => {
              setLevelFilter(event.target.value);
              setPage(1);
            }}
            className="field-select h-11"
          >
            <option value="">All levels</option>
            {levelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="field-select h-11"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All states" : option}
              </option>
            ))}
          </select>

          <button type="button" onClick={resetFilters} className="btn-secondary h-11 px-4">
            <Filter className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Student balance watchlist</h2>
              <p className="mt-1 text-sm text-slate-500">Highest outstanding student accounts across all sessions and active finance records.</p>
            </div>
            <div className="p-5">
              {studentOutstanding.length === 0 ? (
                <EmptyState title="No outstanding balances" description="All visible student accounts are currently clear." />
              ) : (
                <div className="grid gap-3">
                  {studentOutstanding.map((item) => (
                    <article key={`${item.studentName}-${item.className}`} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {item.studentId ? (
                            <Link href={`/finance/students/${item.studentId}`} className="text-base font-black text-slate-900 underline decoration-slate-200 underline-offset-4">
                              {item.studentName}
                            </Link>
                          ) : (
                            <p className="text-base font-black text-slate-900">{item.studentName}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {item.className} {item.classLevel ? `· ${item.classLevel}` : ""} · {item.invoices} invoice{item.invoices === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Outstanding</p>
                          <p className="mt-1 text-xl font-black text-rose-600">{formatCurrency(item.balance)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6">
            <article className="rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Session / term history</h2>
                <p className="mt-1 text-sm text-slate-500">Collections and balances grouped by academic context.</p>
              </div>
              <div className="space-y-3 p-5">
                {termSummary.slice(0, 6).map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.invoices} invoice record{item.invoices === 1 ? "" : "s"}</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">
                        {formatCurrency(item.paid)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>Billed {formatCurrency(item.billed)}</span>
                      <span>Balance {formatCurrency(item.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Level summary</h2>
                <p className="mt-1 text-sm text-slate-500">Outstanding and collection signals by class level.</p>
              </div>
              <div className="space-y-3 p-5">
                {levelSummary.slice(0, 6).map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.students} learner account{item.students === 1 ? "" : "s"}</p>
                      </div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(item.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      ) : null}

      {activeTab === "invoices" ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Invoice ledger</h2>
            <p className="mt-1 text-sm text-slate-500">All student invoice records with session, term, level, payment count, and last payment visibility.</p>
          </div>
          {filteredInvoices.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No invoices match the current filter" description="Try another session, term, level, or search phrase." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Invoice", "Student", "Context", "Billed", "Paid", "Balance", "Status", "Last payment"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <Link href={`/finance/invoices/${item.id}`} className="font-semibold text-ink underline decoration-ink/20 underline-offset-4">
                            {item.invoiceNumber}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(item.dueOn)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {item.studentId ? (
                            <Link href={`/finance/students/${item.studentId}`} className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-4">
                              {item.studentName}
                            </Link>
                          ) : (
                            <p className="font-semibold text-slate-900">{item.studentName}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">{item.admissionNumber ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{item.className}</p>
                          <p className="mt-1 text-xs text-slate-500">{[item.classLevel, item.session, item.term].filter(Boolean).join(" · ") || "No context set"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                        <td className="px-4 py-3 text-emerald-700">{formatCurrency(item.paid ?? 0)}</td>
                        <td className="px-4 py-3 font-semibold text-rose-600">{formatCurrency(item.balance)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {item.lastPaymentAt ? formatDate(item.lastPaymentAt) : "No payment yet"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={paginatedInvoices.page}
                totalPages={paginatedInvoices.totalPages}
                onPageChange={setPage}
                label={`${filteredInvoices.length} invoice record${filteredInvoices.length === 1 ? "" : "s"}`}
              />
            </>
          )}
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Payment history</h2>
            <p className="mt-1 text-sm text-slate-500">Every payment record across students, sessions, terms, and levels with channel and recording context.</p>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No payments match the current filter" description="Try another session, term, level, payment state, or learner search." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Reference", "Student", "Context", "Amount", "Method", "Status", "Receipt", "Recorded by", "Paid"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{item.reference}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.invoiceNumber ?? "Unlinked payment"}</p>
                        </td>
                        <td className="px-4 py-3">
                          {item.studentId ? (
                            <Link href={`/finance/students/${item.studentId}`} className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-4">
                              {item.studentName}
                            </Link>
                          ) : (
                            <p className="font-semibold text-slate-900">{item.studentName}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">{item.admissionNumber ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{item.className ?? "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{[item.classLevel, item.session, item.term].filter(Boolean).join(" · ") || "No context set"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.amount)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-700">{item.method}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.paymentChannel || item.provider || item.schoolBankReference || "Standard channel"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.receiptNumber ?? "Pending receipt"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.recordedByName ?? "System / gateway"}</td>
                        <td className="px-4 py-3 text-slate-500">{item.paidAt ? formatDate(item.paidAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={paginatedPayments.page}
                totalPages={paginatedPayments.totalPages}
                onPageChange={setPage}
                label={`${filteredPayments.length} payment record${filteredPayments.length === 1 ? "" : "s"}`}
              />
            </>
          )}
        </section>
      ) : null}

      {activeTab === "installments" ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Installment plans</h2>
            <p className="mt-1 text-sm text-slate-500">Structured payment agreements with academic context and next-due visibility.</p>
          </div>
          {filteredPlans.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No installment plans match the current filter" description="Try another session, term, level, learner, or plan state." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Plan", "Student", "Context", "Invoice", "Total", "Balance", "Next due", "Status"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPlans.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{item.planNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.notes || "No note attached"}</p>
                        </td>
                        <td className="px-4 py-3">
                          {item.studentId ? (
                            <Link href={`/finance/students/${item.studentId}`} className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-4">
                              {item.studentName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-900">{item.studentName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{item.className ?? "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{[item.classLevel, item.session, item.term].filter(Boolean).join(" · ") || "No context set"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.invoiceNumber ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.totalAmount)}</td>
                        <td className="px-4 py-3 font-semibold text-amber-700">{formatCurrency(item.balance)}</td>
                        <td className="px-4 py-3 text-slate-500">{item.items[0] ? formatDate(item.items[0].dueOn) : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={paginatedPlans.page}
                totalPages={paginatedPlans.totalPages}
                onPageChange={setPage}
                label={`${filteredPlans.length} installment plan${filteredPlans.length === 1 ? "" : "s"}`}
              />
            </>
          )}
        </section>
      ) : null}

      {activeTab === "audit" ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Finance audit trail</h2>
            <p className="mt-1 text-sm text-slate-500">Reviewer-friendly finance actions across invoices, receipts, adjustments, and plans.</p>
          </div>
          {filteredAudit.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No audit entries match the current filter" description="Try another action filter or search term." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Action", "Entity", "Reference", "Detail", "When"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAudit.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.action}</td>
                        <td className="px-4 py-3 text-slate-600">{item.entityType}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.entityId}</td>
                        <td className="px-4 py-3 text-xs leading-6 text-slate-500">{item.detail}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={paginatedAudit.page}
                totalPages={paginatedAudit.totalPages}
                onPageChange={setPage}
                label={`${filteredAudit.length} audit entr${filteredAudit.length === 1 ? "y" : "ies"}`}
              />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
