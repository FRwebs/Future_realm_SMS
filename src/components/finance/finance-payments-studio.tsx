"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Download,
  Landmark,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { ActionMenu, ActionMenuButton, ActionMenuLink } from "@/components/ui/action-menu";
import { useToast } from "@/components/ui/toast-provider";
import type { InvoiceView, PaymentView, ReceiptView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import {
  FinanceDataTable,
  FinanceDrawer,
  FinanceEmptyState,
  FinancePageHeader,
  FinancePanel,
  FinanceStatusBadge,
} from "@/components/finance/finance-studio-ui";

type Props = {
  payments: PaymentView[];
  invoices: InvoiceView[];
  canManageFinance: boolean;
};

const paymentMethods = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "TRANSFER", label: "Bank Transfer", icon: Landmark },
  { value: "POS", label: "POS", icon: CreditCard },
  { value: "CHEQUE", label: "Cheque", icon: WalletCards },
] as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

export function FinancePaymentsStudio({ payments, invoices, canManageFinance }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [studentQuery, setStudentQuery] = useState("");
  const debouncedStudentQuery = useDebouncedValue(studentQuery);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices.find((item) => item.balance > 0)?.id ?? invoices[0]?.id ?? "");
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<(typeof paymentMethods)[number]["value"]>("CASH");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<ReceiptView | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyMethod, setHistoryMethod] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [previewPayment, setPreviewPayment] = useState<PaymentView | null>(null);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId],
  );

  useEffect(() => {
    if (selectedInvoice) {
      setAmount(selectedInvoice.balance > 0 ? selectedInvoice.balance : selectedInvoice.total);
      setPaymentDate(new Date().toISOString().slice(0, 10));
    }
  }, [selectedInvoiceId, selectedInvoice]);

  const studentResults = useMemo(() => {
    const query = debouncedStudentQuery.trim().toLowerCase();
    const ranked = invoices
      .filter((invoice) =>
        !query
          ? true
          : [invoice.studentName, invoice.admissionNumber ?? "", invoice.className, invoice.invoiceNumber]
              .join(" ")
              .toLowerCase()
              .includes(query),
      )
      .sort((a, b) => b.balance - a.balance);
    return ranked.slice(0, 10);
  }, [debouncedStudentQuery, invoices]);

  const selectedStudentInvoices = useMemo(() => {
    if (!selectedInvoice?.studentId) return selectedInvoice ? [selectedInvoice] : [];
    return invoices.filter((invoice) => invoice.studentId === selectedInvoice.studentId);
  }, [invoices, selectedInvoice]);

  const selectedStudentPayments = useMemo(() => {
    if (!selectedInvoice?.studentId) return [];
    return payments
      .filter((payment) => payment.studentId === selectedInvoice.studentId)
      .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
  }, [payments, selectedInvoice]);

  const outstandingBalance = selectedStudentInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const nextBalance = Math.max(outstandingBalance - amount, 0);
  const paymentSummary = selectedInvoice
    ? {
        student: selectedInvoice.studentName,
        invoice: selectedInvoice.invoiceNumber,
        amount,
        method,
        reference,
        paymentDate,
      }
    : null;

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesQuery =
        !query ||
        [
          payment.studentName,
          payment.className ?? "",
          payment.reference,
          payment.receiptNumber ?? "",
          payment.recordedByName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesMethod = !historyMethod || payment.method === historyMethod;
      const matchesStatus = !historyStatus || (payment.isReversed ? "REVERSED" : payment.status) === historyStatus;
      return matchesQuery && matchesMethod && matchesStatus;
    });
  }, [historyMethod, historyQuery, historyStatus, payments]);

  async function submitPayment() {
    if (!selectedInvoice) {
      showToast({ variant: "warning", title: "Select a student invoice", description: "Choose a student from the search results first." });
      return;
    }
    if (!amount || amount <= 0) {
      showToast({ variant: "warning", title: "Enter a valid amount", description: "Payment amount must be greater than zero." });
      return;
    }
    if (method !== "CASH" && !reference.trim()) {
      showToast({ variant: "warning", title: "Add a reference number", description: "Transfer, POS, and cheque payments require a reference." });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/bursary/payments", {
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
          paidAt: paymentDate,
          allowOverpayment,
          schoolBankReference: method === "TRANSFER" ? reference : undefined,
          paymentChannel: method === "POS" ? "POS" : undefined,
          chequeBankName: method === "CHEQUE" ? bankName : undefined,
          note,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; data?: ReceiptView };
      if (!response.ok || body.ok === false || !body.data) {
        throw new Error(body.error ?? "Could not record payment.");
      }

      setSuccessReceipt(body.data);
      showToast({
        variant: "success",
        title: "Payment recorded",
        description: `Receipt ${body.data.receiptNumber} is ready.`,
      });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Payment not recorded",
        description: error instanceof Error ? error.message : "Please review the payment details and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Payments desk"
        title="Record payments with live balance intelligence"
        description="Search the student, review live fee exposure, collect the payment, and issue a receipt without leaving the bursary console."
        actions={
          <>
            <Link href="/finance" className="finance-btn-secondary">
              Dashboard
            </Link>
            <Link href="/finance/reports" className="finance-btn-ghost">
              View reports
            </Link>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <FinancePanel className="p-5">
          <div className="grid gap-6">
            <div>
              <label className="finance-label">Search student invoice</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--finance-text-muted)]" />
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="Search by name, admission number, class, or invoice"
                  className="finance-field pl-11"
                />
              </div>
              <div className="mt-3 grid gap-2">
                {studentResults.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition",
                      selectedInvoiceId === invoice.id
                        ? "border-[#12796a]/40 bg-[#12796a]/10"
                        : "finance-soft-surface finance-soft-surface-hover",
                    )}
                  >
                    <div>
                      <p className="font-semibold text-[var(--finance-text-primary)]">{invoice.studentName}</p>
                      <p className="text-xs text-[var(--finance-text-secondary)]">
                        {invoice.className} · {invoice.invoiceNumber}
                      </p>
                    </div>
                    <p className="finance-mono text-sm font-semibold text-rose-300">{formatCurrency(invoice.balance)}</p>
                  </button>
                ))}
              </div>
            </div>

            {canManageFinance ? (
              <div className="finance-soft-surface-strong grid gap-5 rounded-[16px] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="finance-label mb-0">Amount received</span>
                    <input
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(event) => setAmount(Number(event.target.value))}
                      className="finance-field finance-mono text-lg"
                    />
                    <span className="text-xs text-[var(--finance-text-secondary)]">Balance after: <span className="finance-mono text-[var(--finance-text-primary)]">{formatCurrency(nextBalance)}</span></span>
                  </label>
                  <label className="grid gap-2">
                    <span className="finance-label mb-0">Payment date</span>
                    <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="finance-field" />
                  </label>
                </div>

                <div>
                  <span className="finance-label">Payment method</span>
                  <div className="grid gap-3 md:grid-cols-4">
                    {paymentMethods.map((option) => {
                      const Icon = option.icon;
                      const active = method === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMethod(option.value)}
                          className={cn(
                            "rounded-2xl border px-4 py-4 text-left transition",
                            active ? "border-[#12796a]/40 bg-[#12796a]/10" : "finance-soft-surface finance-soft-surface-hover",
                          )}
                        >
                          <Icon className={cn("h-5 w-5", active ? "text-[var(--finance-accent-primary)]" : "text-[var(--finance-text-secondary)]")} />
                          <p className="mt-3 font-semibold text-[var(--finance-text-primary)]">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="finance-label mb-0">
                      {method === "TRANSFER" ? "Reference No." : method === "POS" ? "Terminal / Reference" : method === "CHEQUE" ? "Cheque No." : "Reference"}
                    </span>
                    <input value={reference} onChange={(event) => setReference(event.target.value)} className="finance-field" placeholder="Enter payment reference" />
                  </label>
                  {method !== "CASH" ? (
                    <label className="grid gap-2">
                      <span className="finance-label mb-0">{method === "TRANSFER" ? "Bank name" : method === "POS" ? "POS terminal" : "Cheque bank"}</span>
                      <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="finance-field" placeholder="Supporting detail" />
                    </label>
                  ) : null}
                </div>

                <label className="grid gap-2">
                  <span className="finance-label mb-0">Note / Description</span>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} className="finance-textarea" placeholder="Optional narration for this payment" />
                </label>

                {amount > outstandingBalance ? (
                  <label
                    className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm"
                    style={{ color: "var(--finance-warning-text)" }}
                  >
                    <input type="checkbox" checked={allowOverpayment} onChange={(event) => setAllowOverpayment(event.target.checked)} className="h-4 w-4 rounded border-white/10 bg-transparent" />
                    Allow this overpayment and roll the excess forward.
                  </label>
                ) : null}

                {paymentSummary ? (
                  <div className="finance-soft-surface rounded-[16px] p-4">
                    <p className="finance-eyebrow">Live summary</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <SummaryItem label="Student" value={paymentSummary.student} />
                      <SummaryItem label="Invoice" value={paymentSummary.invoice} mono />
                      <SummaryItem label="Amount" value={formatCurrency(paymentSummary.amount)} mono />
                      <SummaryItem label="Method" value={paymentSummary.method} />
                      <SummaryItem label="Reference" value={paymentSummary.reference || "Will auto-generate"} mono />
                      <SummaryItem label="Date" value={paymentSummary.paymentDate} />
                    </div>
                  </div>
                ) : null}

                <button type="button" onClick={submitPayment} disabled={submitting || !selectedInvoice} className="finance-btn-primary w-full">
                  {submitting ? "Recording payment..." : "Record Payment"}
                </button>
              </div>
            ) : (
              <FinanceEmptyState title="Payment entry locked" description="Your current finance permissions allow viewing but not recording new receipts." />
            )}
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          {selectedInvoice ? (
            <>
              <div className="flex items-start gap-4">
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[#12796a]/14 text-2xl font-bold text-[var(--finance-accent-primary)]">
                  {selectedInvoice.studentName
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="font-[var(--font-finance-heading)] text-[28px] font-bold text-[var(--finance-text-primary)]">{selectedInvoice.studentName}</p>
                  <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
                    {selectedInvoice.className} · {selectedInvoice.admissionNumber ?? "No admission no."}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--finance-text-muted)]">
                    {selectedInvoice.session ?? "Current session"} · {selectedInvoice.term ?? "Current term"}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[16px] border border-rose-500/18 bg-rose-500/[0.08] p-4">
                <p className="finance-label mb-2">Outstanding balance</p>
                <p className={cn("finance-mono text-[32px] font-bold", outstandingBalance > 0 ? "text-rose-300" : "text-emerald-300")}>
                  {outstandingBalance > 0 ? formatCurrency(outstandingBalance) : "₦0.00"}
                </p>
              </div>

              <div className="mt-6">
                <p className="finance-eyebrow">Fee breakdown</p>
                <div className="mt-3 grid gap-2">
                  {selectedStudentInvoices.map((invoice) => (
                    <div key={invoice.id} className="finance-soft-surface grid grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] gap-3 rounded-2xl px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-[var(--finance-text-primary)]">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-[var(--finance-text-secondary)]">{invoice.term ?? "Current term"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--finance-text-muted)]">Total</p>
                        <p className="finance-mono text-[var(--finance-text-primary)]">{formatCurrency(invoice.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--finance-text-muted)]">Paid</p>
                        <p className="finance-mono text-[var(--finance-text-primary)]">{formatCurrency(invoice.paid ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--finance-text-muted)]">Balance</p>
                        <p className="finance-mono text-rose-300">{formatCurrency(invoice.balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="finance-eyebrow">Payment history</p>
                  {selectedInvoice.studentId ? (
                    <Link href={`/finance/students/${selectedInvoice.studentId}`} className="finance-btn-ghost">
                      Full ledger
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedStudentPayments.slice(0, 5).map((payment) => (
                    <button
                      key={payment.id}
                      type="button"
                      onClick={() => setPreviewPayment(payment)}
                      className="finance-soft-surface finance-soft-surface-hover rounded-2xl px-4 py-3 text-left transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="finance-mono text-sm font-semibold text-[var(--finance-accent-primary)]">{payment.receiptNumber ?? payment.reference}</p>
                          <p className="text-xs text-[var(--finance-text-secondary)]">{payment.paidAt ? formatDate(payment.paidAt) : "Pending date"}</p>
                        </div>
                        <div className="text-right">
                          <p className="finance-mono text-sm font-semibold text-[var(--finance-text-primary)]">{formatCurrency(payment.amount)}</p>
                          <FinanceStatusBadge status={payment.isReversed ? "REVERSED" : payment.status} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <FinanceEmptyState title="Select a student" description="Search and choose a student invoice to reveal the bursary profile and payment history." />
          )}
        </FinancePanel>
      </section>

      <FinancePanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="finance-eyebrow">Payment history</p>
            <h2 className="mt-2 font-[var(--font-finance-heading)] text-2xl font-bold text-[var(--finance-text-primary)]">Receipts, adjustments, and cashier trail</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--finance-text-muted)]" />
              <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search payment history" className="finance-field pl-11" />
            </div>
            <select value={historyMethod} onChange={(event) => setHistoryMethod(event.target.value)} className="finance-select">
              <option value="">All methods</option>
              {Array.from(new Set(payments.map((payment) => payment.method))).map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)} className="finance-select">
              <option value="">All statuses</option>
              {["SUCCESS", "PENDING", "FAILED", "REVERSED"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <a href="/api/v1/bursary/reports/fee-collection?format=excel" className="finance-btn-secondary">
              <Download className="h-4 w-4" />
              Export
            </a>
          </div>
        </div>

        <div className="mt-5">
          <FinanceDataTable
            rows={filteredHistory}
            page={historyPage}
            pageSize={12}
            onPageChange={setHistoryPage}
            totalLabel={`Showing ${Math.min(historyPage * 12, filteredHistory.length)} of ${filteredHistory.length} payments`}
            rowKey={(row) => row.id}
            stickyFirstColumn
            columns={[
              {
                key: "receipt",
                header: "Receipt #",
                render: (row) => (
                  <div>
                    <p className="finance-mono text-sm font-semibold text-[var(--finance-accent-primary)]">{row.receiptNumber ?? row.reference}</p>
                    <p className="text-xs text-[var(--finance-text-secondary)]">{row.paymentNumber ?? row.reference}</p>
                  </div>
                ),
              },
              {
                key: "date",
                header: "Date",
                render: (row) => (row.paidAt ? formatDate(row.paidAt) : "-"),
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
                key: "status",
                header: "Status",
                render: (row) => <FinanceStatusBadge status={row.isReversed ? "REVERSED" : row.status} />,
              },
            ]}
            rowActions={(row) => (
              <ActionMenu triggerLabel={`Actions for ${row.studentName}`}>
                <ActionMenuButton onClick={() => setPreviewPayment(row)}>
                  <ReceiptText className="mr-2 h-4 w-4" />
                  View receipt
                </ActionMenuButton>
                <ActionMenuLink href={row.studentId ? `/finance/students/${row.studentId}` : "/finance"}>View ledger</ActionMenuLink>
              </ActionMenu>
            )}
            emptyState={<FinanceEmptyState title="No matching payments" description="Try a different search term or clear the payment filters." />}
          />
        </div>
      </FinancePanel>

      <FinanceDrawer
        open={Boolean(successReceipt)}
        onClose={() => setSuccessReceipt(null)}
        title="Payment Successful"
        subtitle="Receipt has been generated and can be printed or shared with the parent immediately."
        width="480px"
        footer={
          successReceipt ? (
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setSuccessReceipt(null)} className="finance-btn-secondary">
                Record another
              </button>
              <button type="button" onClick={() => window.open(`/api/v1/bursary/payments/${successReceipt.paymentId ?? successReceipt.id}/receipt`, "_blank")} className="finance-btn-primary">
                <ReceiptText className="h-4 w-4" />
                Print receipt PDF
              </button>
            </div>
          ) : null
        }
      >
        {successReceipt ? (
          <div className="grid gap-4">
            <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
              <p className="finance-label mb-2">Receipt number</p>
              <p className="finance-mono text-2xl font-bold text-emerald-300">{successReceipt.receiptNumber}</p>
            </div>
            <button type="button" onClick={() => window.open(`/api/v1/bursary/payments/${successReceipt.paymentId ?? successReceipt.id}/receipt`, "_blank")} className="finance-btn-secondary w-full">
              <Download className="h-4 w-4" />
              Open receipt PDF
            </button>
          </div>
        ) : null}
      </FinanceDrawer>

      <FinanceDrawer
        open={Boolean(previewPayment)}
        onClose={() => setPreviewPayment(null)}
        title={previewPayment?.receiptNumber ?? previewPayment?.reference ?? "Receipt preview"}
        subtitle="Official receipt actions for the selected transaction."
        width="500px"
        footer={
          previewPayment ? (
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setPreviewPayment(null)} className="finance-btn-secondary">
                Close
              </button>
              <button type="button" onClick={() => window.open(`/api/v1/bursary/payments/${previewPayment.id}/receipt`, "_blank")} className="finance-btn-primary">
                <ReceiptText className="h-4 w-4" />
                View PDF
              </button>
            </div>
          ) : null
        }
      >
        {previewPayment ? (
          <div className="grid gap-4">
            <div className="finance-soft-surface rounded-[16px] p-4">
              <p className="finance-label mb-2">Student</p>
              <p className="font-semibold text-[var(--finance-text-primary)]">{previewPayment.studentName}</p>
              <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">{previewPayment.className ?? "No class"} · {previewPayment.invoiceNumber ?? "No invoice"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryItem label="Amount" value={formatCurrency(previewPayment.amount)} mono />
              <SummaryItem label="Method" value={previewPayment.method} />
              <SummaryItem label="Reference" value={previewPayment.reference} mono />
              <SummaryItem label="Date" value={previewPayment.paidAt ? formatDate(previewPayment.paidAt) : "-"} />
            </div>
            <div className="finance-soft-surface rounded-[16px] p-4">
              <p className="finance-label mb-2">Status</p>
              <FinanceStatusBadge status={previewPayment.isReversed ? "REVERSED" : previewPayment.status} />
            </div>
          </div>
        ) : null}
      </FinanceDrawer>
    </div>
  );
}

function SummaryItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="finance-soft-surface rounded-2xl px-4 py-3">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--finance-text-muted)]">{label}</p>
      <p className={cn("mt-2 text-sm text-[var(--finance-text-primary)]", mono && "finance-mono font-semibold")}>{value}</p>
    </div>
  );
}
