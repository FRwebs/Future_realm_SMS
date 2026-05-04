"use client";

import { Banknote, CheckCircle2, CreditCard, Landmark, Search, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import type { InvoiceView } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

type ManualPaymentModalProps = {
  invoices: InvoiceView[];
};

const paymentMethods = [
  { value: "CASH", label: "Cash", icon: Banknote, helper: "Cash received at bursary" },
  { value: "TRANSFER", label: "Bank Transfer", icon: Landmark, helper: "Parent sent transfer/teller" },
  { value: "POS", label: "POS", icon: CreditCard, helper: "Card paid on school POS" },
  { value: "CHEQUE", label: "Cheque", icon: WalletCards, helper: "Cheque received for clearing" },
] as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function ManualPaymentModal({ invoices }: ManualPaymentModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const openInvoices = invoices.filter((invoice) => invoice.balance > 0 && !["PAID", "VOID"].includes(invoice.status));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(openInvoices[0]?.id ?? "");
  const [amount, setAmount] = useState(openInvoices[0]?.balance ?? 0);
  const [method, setMethod] = useState<(typeof paymentMethods)[number]["value"]>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const selectedInvoice = openInvoices.find((invoice) => invoice.id === selectedInvoiceId);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return openInvoices.slice(0, 6);
    return openInvoices
      .filter((invoice) =>
        [invoice.studentName, invoice.invoiceNumber, invoice.className]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 8);
  }, [openInvoices, query]);

  function selectInvoice(invoice: InvoiceView) {
    setSelectedInvoiceId(invoice.id);
    setAmount(invoice.balance);
    setQuery(`${invoice.studentName} · ${invoice.invoiceNumber}`);
  }

  function openModal() {
    if (openInvoices.length === 0) {
      showToast({
        variant: "info",
        title: "No open invoices available",
        description: "All visible invoices are settled already, so there is nothing to record right now.",
      });
      return;
    }
    setOpen(true);
  }

  async function submitPayment() {
    if (!selectedInvoice) {
      showToast({
        variant: "warning",
        title: "Select an invoice first",
        description: "Choose the learner's open invoice before recording payment.",
      });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        variant: "warning",
        title: "Enter a valid amount",
        description: "Payment amount must be greater than zero.",
      });
      return;
    }
    if (amount > selectedInvoice.balance) {
      showToast({
        variant: "warning",
        title: "Amount is above outstanding balance",
        description: `This invoice has only ${formatCurrency(selectedInvoice.balance)} outstanding.`,
      });
      return;
    }
    if (method !== "CASH" && !reference.trim()) {
      showToast({
        variant: "warning",
        title: "Reference required",
        description: "Add the transfer, POS, or cheque reference before recording this payment.",
      });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/v1/finance/payments/manual", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amount,
          method,
          reference,
          paidAt: new Date().toISOString().slice(0, 10),
          schoolBankReference: method === "TRANSFER" ? reference : undefined,
          note,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Unable to record payment.");

      showToast({
        variant: "success",
        title: "Payment recorded",
        description: `${formatCurrency(amount)} recorded for ${selectedInvoice.studentName}. Receipt generated.`,
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Could not record payment",
        description: error instanceof Error ? error.message : "Please review the payment details and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const nextBalance = selectedInvoice ? Math.max(selectedInvoice.balance - Number(amount || 0), 0) : 0;

  return (
    <>
      <button type="button" onClick={openModal} className="btn-primary">
        <Banknote className="h-4 w-4" />
        Record payment
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record Fee Payment"
        subtitle="Search the student or invoice, confirm the amount, and generate an official receipt."
        size="lg"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-slate-500">
              {selectedInvoice ? `Balance after payment: ${formatCurrency(nextBalance)}` : "Select an invoice to continue."}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPayment}
                disabled={pending}
                className="btn-primary disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Recording..." : "Confirm and Generate Receipt"}
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-5">
          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Student / invoice search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by student name, class, or invoice number"
                className="field-control pl-10"
              />
            </div>
            <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
              {searchResults.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => selectInvoice(invoice)}
                  className={cn(
                    "rounded-xl border bg-white p-3 text-left transition hover:border-primary-200 hover:bg-primary-50/70",
                    selectedInvoiceId === invoice.id ? "border-primary-300 ring-2 ring-primary-500/15" : "border-slate-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{invoice.studentName}</p>
                      <p className="text-[12px] text-slate-500">{invoice.className} · {invoice.invoiceNumber}</p>
                    </div>
                    <p className="text-right text-[13px] font-black text-red-600">{formatCurrency(invoice.balance)}</p>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-slate-500">No outstanding invoice matches that search.</p>
              ) : null}
            </div>
          </div>

          {selectedInvoice ? (
            <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-primary-700">Invoice overview</p>
                  <h3 className="mt-1 text-[18px] font-black text-slate-900">{selectedInvoice.studentName}</h3>
                  <p className="text-[13px] text-slate-600">{selectedInvoice.className} · {selectedInvoice.invoiceNumber}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Outstanding</p>
                  <p className="text-[22px] font-black text-red-600">{formatCurrency(selectedInvoice.balance)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Amount received
              </label>
              <input
                type="number"
                min={1}
                max={selectedInvoice?.balance}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="field-control text-[18px] font-black"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Reference / teller no.
              </label>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional for cash, required for transfer/POS"
                className="field-control"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Payment method
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {paymentMethods.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMethod(item.value)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition hover:border-primary-300 hover:bg-primary-50",
                      method === item.value ? "border-primary-400 bg-primary-50 ring-2 ring-primary-500/15" : "border-slate-100 bg-white"
                    )}
                  >
                    <Icon className="h-5 w-5 text-primary-600" />
                    <p className="mt-2 text-[13px] font-bold text-slate-900">{item.label}</p>
                    <p className="text-[11px] text-slate-500">{item.helper}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note, teller name, or verification detail"
              className="field-textarea"
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
