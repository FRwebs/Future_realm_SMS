"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import type { ExpenditureView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import {
  FinanceDataTable,
  FinanceDrawer,
  FinancePageHeader,
  FinancePanel,
} from "@/components/finance/finance-studio-ui";

type Props = {
  expenditures: ExpenditureView[];
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function FinanceExpendituresStudio({ expenditures }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount: "",
    paymentMethod: "",
    paidTo: "",
    receiptUrl: "",
    expenditureDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return expenditures.filter((item) =>
      !normalized
        ? true
        : [item.category, item.description, item.paidTo ?? "", item.paymentMethod ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
    );
  }, [expenditures, query]);

  const monthTotal = useMemo(() => filtered.reduce((sum, item) => sum + item.amount, 0), [filtered]);

  async function submitExpense() {
    if (!form.category.trim() || !form.description.trim() || !form.amount || !form.paymentMethod.trim() || !form.paidTo.trim()) {
      showToast({ variant: "warning", title: "Complete the expense form", description: "Category, description, amount, payment method, and beneficiary are required." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/v1/bursary/expenditures", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Could not record expenditure.");
      showToast({ variant: "success", title: "Expenditure recorded", description: "The finance ledger has been updated successfully." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Could not save expenditure", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Expenditure register"
        title="Track every naira that leaves the school"
        description="Keep petty cash, utilities, transport, salaries, and vendor payments in one searchable finance ledger with production-ready traceability."
        actions={
          <button type="button" onClick={() => setOpen(true)} className="finance-btn-primary">
            <Plus className="h-4 w-4" />
            Record expense
          </button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <FinancePanel className="p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="finance-eyebrow">Ledger filters</p>
              <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Expense history</h2>
            </div>
            <div className="relative min-w-[260px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--finance-text-muted)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="finance-field pl-11" placeholder="Search category, vendor, method..." />
            </div>
          </div>
          <div className="mt-6">
            <FinanceDataTable
              rows={filtered}
              page={page}
              pageSize={12}
              onPageChange={setPage}
              totalLabel={`${filtered.length} expenditure records`}
              rowKey={(row) => row.id}
              columns={[
                { key: "date", header: "Date", render: (row) => formatDate(row.expenditureDate) },
                { key: "category", header: "Category", render: (row) => row.category },
                { key: "description", header: "Description", render: (row) => row.description },
                { key: "paidTo", header: "Paid to", render: (row) => row.paidTo ?? "-" },
                { key: "amount", header: "Amount", align: "right", render: (row) => <span className="finance-mono">{formatCurrency(row.amount)}</span> },
                { key: "method", header: "Method", render: (row) => row.paymentMethod ?? "-" },
              ]}
            />
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="grid gap-4">
            <Metric label="Visible ledger value" value={formatCurrency(monthTotal)} />
            <Metric label="Expense rows" value={String(filtered.length)} />
            <div className="finance-soft-surface rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="finance-icon-surface grid h-10 w-10 place-items-center rounded-2xl">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--finance-text-primary)]">Best practice</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--finance-text-secondary)]">
                    Record the beneficiary, payment method, and receipt link on the same day to keep audit follow-up friction low.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FinancePanel>
      </section>

      <FinanceDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record expenditure"
        subtitle="Add a clean finance ledger entry with all the context the bursary office will need later."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="finance-btn-secondary">Cancel</button>
            <button type="button" onClick={submitExpense} className="finance-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save expenditure"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="finance-field" placeholder="Expense category" />
          <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="finance-field" placeholder="Description" />
          <div className="grid gap-4 md:grid-cols-2">
            <input type="number" min={0} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="finance-field finance-mono" placeholder="Amount" />
            <input value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="finance-field" placeholder="Payment method" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input value={form.paidTo} onChange={(event) => setForm((current) => ({ ...current, paidTo: event.target.value }))} className="finance-field" placeholder="Paid to" />
            <input type="date" value={form.expenditureDate} onChange={(event) => setForm((current) => ({ ...current, expenditureDate: event.target.value }))} className="finance-field" />
          </div>
          <input value={form.receiptUrl} onChange={(event) => setForm((current) => ({ ...current, receiptUrl: event.target.value }))} className="finance-field" placeholder="Receipt URL (optional)" />
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="finance-textarea" placeholder="Notes (optional)" />
        </div>
      </FinanceDrawer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="finance-soft-surface rounded-2xl px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">{label}</p>
      <p className="finance-mono mt-3 text-2xl font-bold text-[var(--finance-text-primary)]">{value}</p>
    </div>
  );
}
