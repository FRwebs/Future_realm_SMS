import { apiGet } from "@/lib/api/server";
import { naira, nairaShort } from "@/lib/modules/fees-data";
import {
  action,
  name as nameCell,
  pill,
  row,
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

export async function feeManagementLiveTab(
  tabSlug: string,
): Promise<TabContent | undefined> {
  // Only Collections reads live so far. The other three tabs fall through to
  // the authored content rather than pretending to be wired.
  if (tabSlug !== "collections") return undefined;

  const data = await apiGet<FinanceDashboardView>("/api/v1/finance/dashboard");
  return collectionsTab(data);
}
