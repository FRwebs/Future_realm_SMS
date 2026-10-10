import { apiGet } from "@/lib/api/server";
import { naira, nairaShort } from "@/lib/modules/fees-data";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type TabContent,
  type PanelTone,
  type TableRow,
} from "@/lib/modules/panels";
import type { FinanceDashboardView, InvoiceView, PaymentView } from "@/lib/domain/types";

/**
 * M10 Fee Management, read from the finance API instead of the authored file.
 *
 * `GET /v1/finance/dashboard` already returns invoices, payments and fee
 * structures together behind a cache, so the whole tab costs one round trip.
 * The authored version of this tab stays in content/ and is what the page falls
 * back to if this call fails.
 */

const DAY = 86_400_000;

function daysPast(iso: string | undefined): number {
  if (!iso) return 0;
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.floor((Date.now() - due) / DAY);
}

/** The mockup's ageing bands, applied to how long a balance has been due. */
function ageing(days: number): { label: string; tone: PanelTone } {
  if (days <= 0) return { label: "Not yet due", tone: "positive" };
  if (days <= 30) return { label: `${days}d`, tone: "positive" };
  if (days <= 90) return { label: `${days}d`, tone: "attention" };
  return { label: `${days}d`, tone: "negative" };
}

function dateLabel(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/**
 * The drawer behind a debtor row: what is owed, and the one thing you can do
 * about it from here. The send is a real command — `POST /invoices/:id/send`
 * — so confirming it reaches the family rather than only closing the drawer.
 */
function debtorDrawer(invoice: InvoiceView): DrawerSpec {
  const days = daysPast(invoice.dueOn);

  return {
    kicker: invoice.invoiceNumber,
    title: invoice.studentName,
    sub: `${invoice.className} · ${naira(invoice.balance)} outstanding`,
    tone: days > 90 ? "negative" : days > 30 ? "attention" : "neutral",
    facts: [
      ["Invoice", invoice.invoiceNumber],
      ["Student", invoice.studentName],
      ["Admission number", invoice.admissionNumber ?? "—"],
      ["Class", invoice.className],
      ["Term", invoice.term ?? "—"],
      ["Invoiced", naira(invoice.total)],
      ["Paid", naira(invoice.total - invoice.balance)],
      ["Outstanding", naira(invoice.balance)],
      ["Due", dateLabel(invoice.dueOn)],
      ["Ageing", days > 0 ? `${days} days past due` : "Not yet due"],
      ["Payments so far", String(invoice.paymentCount ?? 0)],
      ["Last payment", dateLabel(invoice.lastPaymentAt)],
    ],
    mode: "commit",
    // The send the comment above promises. Note the role split behind it:
    // PRINCIPAL is in bursaryOversightRoles and can read this page, but not in
    // bursaryRoles, so a principal gets a refusal here rather than a send. The
    // drawer shows that refusal, which is the honest outcome — the alternative
    // was reporting a reminder that never left.
    submit: {
      endpoint: `/api/v1/bursary/invoices/${invoice.id}/send`,
      method: "POST",
    },
    commitLabel: "Send the reminder",
    commitNote: "The family is sent this invoice on the contact details held for them.",
    commitDone: "Reminder sent",
    commitDoneBody: `${invoice.studentName}'s family has been sent invoice ${invoice.invoiceNumber}.`,
  };
}

function paymentDrawer(payment: PaymentView): DrawerSpec {
  return {
    kicker: payment.reference,
    title: payment.studentName,
    sub: `${naira(payment.amount)} · ${payment.method}`,
    readOnly: true,
    readOnlyNote:
      "This is a record of a payment that was received. It is read-only — a payment is reversed, never edited.",
    facts: [
      ["Reference", payment.reference],
      ["Receipt", payment.receiptNumber ?? "—"],
      ["Student", payment.studentName],
      ["Class", payment.className ?? "—"],
      ["Amount", naira(payment.amount)],
      ["Method", payment.method],
      ["Channel", payment.paymentChannel ?? payment.provider ?? "—"],
      ["Status", payment.status],
      ["Invoice", payment.invoiceNumber ?? "—"],
      ["Term", payment.term ?? "—"],
    ],
  };
}

function collectionsTab(data: FinanceDashboardView): TabContent {
  const invoices = data.invoices ?? [];
  const payments = data.payments ?? [];

  const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const collected = billed - outstanding;
  const discounts = invoices.reduce((sum, invoice) => sum + (invoice.discount ?? 0), 0);

  const debtors = invoices
    .filter((invoice) => invoice.balance > 0)
    .sort((a, b) => daysPast(b.dueOn) - daysPast(a.dueOn) || b.balance - a.balance);

  const past90 = debtors
    .filter((invoice) => daysPast(invoice.dueOn) > 90)
    .reduce((sum, invoice) => sum + invoice.balance, 0);

  const collectedPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const cards: KpiCard[] = [
    {
      label: "Expected",
      value: nairaShort(billed),
      sub: `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} raised`,
    },
    {
      label: "Collected",
      value: nairaShort(collected),
      tone: collectedPct >= 75 ? "positive" : collectedPct >= 50 ? "attention" : "negative",
      sub: `${collectedPct}% of what was billed`,
    },
    {
      label: "Outstanding",
      value: nairaShort(outstanding),
      tone: outstanding > 0 ? "attention" : "positive",
      sub: `across ${debtors.length} invoice${debtors.length === 1 ? "" : "s"}`,
    },
    {
      label: "Past 90 days",
      value: nairaShort(past90),
      tone: past90 > 0 ? "negative" : "positive",
      sub: past90 > 0 ? "Beyond the usual reminder cycle" : "Nothing this old",
    },
    {
      label: "Discount exposure",
      value: nairaShort(discounts),
      sub: "Applied to invoices raised",
    },
    {
      label: "Payments received",
      value: String(payments.length),
      sub: "Most recent first, below",
      link: "See every payment ever",
      href: "/fee-management/history",
    },
  ];

  const paymentRows: TableRow[] = payments.slice(0, 12).map((payment) => ({
    cells: [
      nameCell(payment.studentName, payment.className ?? payment.admissionNumber ?? ""),
      text(naira(payment.amount)),
      text(payment.method),
      pill(payment.status, payment.status.toUpperCase() === "COMPLETED" ? "positive" : "attention"),
      text(dateLabel(payment.paidAt)),
      { kind: "action" as const, label: "View", drawer: paymentDrawer(payment) },
    ],
    drawer: paymentDrawer(payment),
    keywords: `${payment.reference} ${payment.receiptNumber ?? ""}`,
  }));

  const debtorRows: TableRow[] = debtors.slice(0, 20).map((invoice) => {
    const band = ageing(daysPast(invoice.dueOn));
    return {
      cells: [
        nameCell(invoice.studentName, invoice.className),
        text(naira(invoice.balance)),
        pill(band.label, band.tone),
        text(dateLabel(invoice.dueOn)),
        { kind: "action" as const, label: "Chase", drawer: debtorDrawer(invoice) },
      ],
      // The whole row opens the same drawer the Chase cell does.
      drawer: debtorDrawer(invoice),
      keywords: `${invoice.invoiceNumber} ${invoice.admissionNumber ?? ""}`,
    };
  });

  return {
    title: "Collections",
    desc: "What has been billed, what has come in, and who is behind — read from this school's ledger.",
    launchers: [{ label: "Open the history", href: "/fee-management/history" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "This school's fee position", per: 6, cards }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Payments received",
            sub: payments.length
              ? `The ${Math.min(payments.length, 12)} most recent of ${payments.length}.`
              : "No payment has been recorded yet.",
            head: ["Paying", "Amount", "Method", "Status", "Received", ""],
            rows: paymentRows,
            per: 8,
            acts: [{ label: "See every payment ever", href: "/fee-management/history" }],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Debtor list",
            sub: debtors.length
              ? `${debtors.length} invoice${debtors.length === 1 ? "" : "s"} carrying a balance, oldest first.`
              : "Every invoice raised has been settled.",
            head: ["Family", "Outstanding", "Ageing", "Due", ""],
            rows: debtorRows,
            per: 8,
          },
        ],
      },
    ],
  };
}


type PaymentRow = {
  id: string;
  reference: string;
  studentName: string;
  admissionNumber: string | null;
  className: string | null;
  invoiceNumber: string | null;
  amount: number;
  status: string;
  method: string | null;
  provider: string | null;
  gatewayStatus: string | null;
  recordedByName: string | null;
  paidAt?: string | null;
};

function paymentTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return "positive";
    case "PENDING":
      return "attention";
    case "FAILED":
    case "REVERSED":
      return "negative";
    default:
      return "neutral";
  }
}

function readablePayment(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * M10 · History, read from `GET /v1/finance/payments`.
 *
 * Every payment the school has a record of, in the state the gateway left it.
 * A pending payment is money the school cannot spend, which is why the tab
 * counts those separately from what actually cleared rather than totalling the
 * two together.
 */
function historyTab(payments: PaymentRow[]): TabContent {
  const cleared = payments.filter((row) => row.status.toUpperCase() === "SUCCESS");
  const pending = payments.filter((row) => row.status.toUpperCase() === "PENDING");
  const failed = payments.filter((row) => ["FAILED", "REVERSED"].includes(row.status.toUpperCase()));
  const clearedTotal = cleared.reduce((sum, row) => sum + row.amount, 0);
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount, 0);

  const methods = new Map<string, number>();
  for (const row of payments) {
    const key = readablePayment(row.method ?? "unknown");
    methods.set(key, (methods.get(key) ?? 0) + 1);
  }

  return {
    title: "History",
    desc: "Every payment the school has a record of, in the state it was left in.",
    launchers: [{ label: "Collections", href: "/fee-management/collections" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What has actually come in",
            per: 4,
            cards: [
              {
                label: "Cleared",
                value: naira(clearedTotal),
                sub: `${cleared.length} payment${cleared.length === 1 ? "" : "s"}`,
                tone: "positive",
              },
              {
                label: "Pending",
                value: naira(pendingTotal),
                sub: pending.length
                  ? `${pending.length} not yet confirmed by the gateway`
                  : "Nothing in flight",
                tone: pending.length ? "attention" : "positive",
              },
              {
                label: "Failed or reversed",
                value: String(failed.length),
                sub: failed.length ? "Money that never arrived" : "None",
                tone: failed.length ? "negative" : "positive",
              },
              {
                label: "Methods in use",
                value: String(methods.size),
                sub: Array.from(methods.keys()).join(" · ") || "none",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          pending.length
            ? {
                type: "note",
                tone: "attention",
                title: `${naira(pendingTotal)} is sitting in pending`,
                body: `${pending.length} of ${payments.length} payments have never been confirmed by the gateway. Until they are, that money is recorded but not collected — it should not be counted against what families still owe.`,
              }
            : {
                type: "note",
                tone: "positive",
                title: "Nothing is stuck pending",
                body: "Every payment on record has reached a final state.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          payments.length
            ? {
                type: "table",
                title: "Payments",
                sub: "Every record, whatever state it reached.",
                meta: `${payments.length} payments · ${cleared.length} cleared`,
                head: ["Paying", "Reference", "Amount", "Method", "Status", "Recorded by", ""],
                per: 15,
                rows: payments.map((row) => ({
                  cells: [
                    nameCell(row.studentName, row.className ?? row.admissionNumber ?? ""),
                    text(row.reference, { mono: true }),
                    text(naira(row.amount), { strong: true }),
                    text(readablePayment(row.method ?? "—")),
                    pill(readablePayment(row.status), paymentTone(row.status)),
                    text(row.recordedByName ?? "—", {
                      tone: row.recordedByName ? undefined : "attention",
                    }),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: row.reference,
                        title: row.studentName,
                        sub: `${naira(row.amount)} · ${readablePayment(row.status)}`,
                        tone: paymentTone(row.status),
                        readOnly: true,
                        readOnlyNote:
                          "A payment record is evidence. Corrections are made by recording a reversal, never by editing what was received.",
                        facts: [
                          ["Reference", row.reference],
                          ["Student", row.studentName],
                          ["Admission number", row.admissionNumber ?? "—"],
                          ["Class", row.className ?? "—"],
                          ["Invoice", row.invoiceNumber ?? "—"],
                          ["Amount", naira(row.amount)],
                          ["Method", readablePayment(row.method ?? "unknown")],
                          ["Provider", row.provider ?? "—"],
                          ["Gateway status", readablePayment(row.gatewayStatus ?? "unknown")],
                          ["Status", readablePayment(row.status)],
                          ["Recorded by", row.recordedByName ?? "—"],
                        ],
                      },
                    },
                  ],
                  keywords: `${row.studentName} ${row.reference} ${row.status}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No payment has been recorded",
                body: "Nothing has been received against any invoice on this school.",
              },
        ],
      },
    ],
  };
}


type WaiverRow = {
  id: string;
  studentName: string;
  admissionNumber: string | null;
  className: string | null;
  invoiceNumber: string | null;
  invoiceTotal: number;
  invoiceBalance: number;
  waiverType: string;
  amount: number;
  percentage: number | null;
  reason: string;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
};

function waiverTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "PENDING":
      return "attention";
    default:
      return "negative";
  }
}

function waiverWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/** What a waiver is actually worth, which differs by type. */
function waiverValue(row: WaiverRow): number {
  if (row.waiverType.toUpperCase() === "PERCENTAGE" && row.percentage !== null) {
    return Math.round((row.invoiceTotal * row.percentage) / 100);
  }
  if (row.waiverType.toUpperCase() === "FULL") return row.invoiceTotal;
  return row.amount;
}

/**
 * M10 · Review, read from `GET /v1/bursary/waivers`.
 *
 * A waiver is money the school has decided not to collect, so the figure worth
 * leading on is what has been given away and what is being asked for — not how
 * many rows there are.
 */
function reviewTab(rows: WaiverRow[]): TabContent {
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");
  const approved = rows.filter((row) => row.status.toUpperCase() === "APPROVED");
  const givenAway = approved.reduce((sum, row) => sum + waiverValue(row), 0);
  const requested = pending.reduce((sum, row) => sum + waiverValue(row), 0);

  return {
    title: "Review",
    desc: "Fee waivers — money the school has decided not to collect.",
    launchers: [{ label: "Collections", href: "/fee-management/collections" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What has been waived",
            per: 4,
            cards: [
              {
                label: "Waived so far",
                value: naira(givenAway),
                sub: `${approved.length} approved`,
                tone: "positive",
              },
              {
                label: "Awaiting a decision",
                value: naira(requested),
                sub: pending.length ? `${pending.length} request(s)` : "Nothing waiting",
                tone: pending.length ? "attention" : "positive",
              },
              { label: "Requests on file", value: String(rows.length), sub: "All time" },
              {
                label: "Refused",
                value: String(rows.filter((row) => row.status.toUpperCase() === "REJECTED").length),
                sub: "Declined outright",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          pending.length
            ? {
                type: "note",
                tone: "attention",
                title: `${naira(requested)} is waiting on somebody's decision`,
                body: "Until a waiver is decided, the family still owes the full invoice and the school still counts it as collectable. Both sides are planning against a figure that is not settled.",
              }
            : {
                type: "note",
                tone: "positive",
                title: "Every waiver has been decided",
                body: "Nothing is sitting between a family and a settled invoice.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Waiver requests",
                sub: "Most recent first.",
                meta: `${rows.length} request${rows.length === 1 ? "" : "s"} · ${naira(givenAway)} waived`,
                head: ["Student", "Invoice", "Kind", "Worth", "Status", "Decided by", ""],
                per: 12,
                rows: rows.map((row) => ({
                  cells: [
                    nameCell(row.studentName, row.className ?? row.admissionNumber ?? ""),
                    text(row.invoiceNumber ?? "—", { mono: Boolean(row.invoiceNumber) }),
                    text(
                      row.waiverType.toUpperCase() === "PERCENTAGE" && row.percentage !== null
                        ? `${row.percentage}%`
                        : row.waiverType.toLowerCase(),
                    ),
                    text(naira(waiverValue(row)), { strong: true }),
                    pill(row.status.toLowerCase(), waiverTone(row.status)),
                    text(row.approvedBy ?? "—", {
                      tone: row.approvedBy ? undefined : "attention",
                    }),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: row.invoiceNumber ?? "Waiver",
                        title: row.studentName,
                        sub: `${naira(waiverValue(row))} off ${naira(row.invoiceTotal)}`,
                        tone: waiverTone(row.status),
                        readOnly: true,
                        facts: [
                          ["Student", row.studentName],
                          ["Class", row.className ?? "—"],
                          ["Invoice", row.invoiceNumber ?? "—"],
                          ["Invoice total", naira(row.invoiceTotal)],
                          ["Outstanding", naira(row.invoiceBalance)],
                          ["Kind", row.waiverType.toLowerCase()],
                          ["Worth", naira(waiverValue(row))],
                          ["Reason", row.reason],
                          ["Requested by", row.requestedBy ?? "—"],
                          ["Status", row.status.toLowerCase()],
                          ["Decided by", row.approvedBy ?? "not yet"],
                          ["Decided", waiverWhen(row.approvedAt)],
                        ],
                      },
                    },
                  ],
                  keywords: `${row.studentName} ${row.invoiceNumber ?? ""} ${row.status}`,
                })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "No waiver has been requested",
                body: "Nobody has asked for fees to be reduced on this school.",
              },
        ],
      },
    ],
  };
}

export async function feeManagementLiveTab(
  tabSlug: string,
): Promise<TabContent | undefined> {
  if (tabSlug === "collections") {
    const data = await apiGet<FinanceDashboardView>("/api/v1/finance/dashboard");
    return collectionsTab(data);
  }

  if (tabSlug === "history") {
    const payments = await apiGet<PaymentRow[]>("/api/v1/finance/payments");
    return historyTab(payments ?? []);
  }

  if (tabSlug === "review") {
    const waivers = await apiGet<WaiverRow[]>("/api/v1/bursary/waivers");
    return reviewTab(waivers ?? []);
  }

  // Structures stays authored: this school has one FeeStructure row, so a wired
  // tab would show a single line where the mockup shows a catalogue.
  return undefined;
}
