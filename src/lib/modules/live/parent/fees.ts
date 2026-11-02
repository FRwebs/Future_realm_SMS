import { apiGet } from "@/lib/api/server";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, PanelFact, PanelTone, TableRow } from "@/lib/modules/panels";
import { PW, dLong, dShort, loadMe, money } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type FeeChild = {
  id: string; name: string; first: string; arm: string; invoiceNo: string; term: string;
  billed: number; paid: number; balance: number; outstanding: number; fromEarlier: number; oldestDue: string | null;
  status: string; tone: PanelTone;
};
type FeeInvoice = {
  id: string; childId: string; child: string; number: string; term: string; termId: string | null;
  issued: string; due: string; total: number; discount: number; fine: number; balance: number; status: string;
  lines: Array<{ description: string; amount: number; quantity: number }>;
};
type FeePayment = {
  id: string; childId: string; child: string; invoice: string; reference: string; receipt: string | null;
  amount: number; method: string; status: string; paidAt: string | null;
};
type FeePlan = {
  id: string; childId: string; child: string; number: string; total: number; balance: number; status: string;
  items: Array<{ id: string; due: string; amount: number; paid: number; status: string }>;
};
type Fees = { children: FeeChild[]; invoices: FeeInvoice[]; payments: FeePayment[]; plans: FeePlan[] };

const TABS = ["This term", "Payments and receipts", "Earlier terms"];

/**
 * What the family owes, and the proof of what they have paid.
 *
 * The whole-family view exists because a parent with two children is billed
 * twice and wants one answer to "how much do I owe". Opening a child gives the
 * invoice behind the figure, every receipt, and any plan the school approved —
 * which is what a parent reaches for when a payment seems to have gone missing.
 */
export async function feesPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data] = await Promise.all([loadMe(), apiGet<Fees>(`${PW}/fees?child=${encodeURIComponent(child)}`)]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childFees(one, data, query, me.school) : familyFees(data, me.school, Boolean(me.term));
}

const askTheBursar = (childId?: string): DrawerSpec => ({
  kicker: "Fees", title: "Ask the bursar", mode: "form",
  sub: "It goes to the school's bursary as a request you can track, and their answer arrives in your Messages.",
  fields: [
    { kind: "text", label: "What do you need to ask?", required: true, value: "", placeholder: "A question about an invoice, a payment, or a plan" },
  ],
  commitLabel: "Send to the bursary", commitDone: "Sent to the bursary", commitDoneBody: "You can follow it under Requests.",
  submit: {
    endpoint: "/api/v1/parent-portal/submissions", method: "POST",
    map: { "What do you need to ask?": "detail" },
    body: { type: "Fee question", ...(childId ? { studentId: childId } : {}) },
  },
});

function familyFees(data: Fees, school: string, hasTerm: boolean): ParentContent {
  const owed = data.children.reduce((sum, entry) => sum + entry.outstanding, 0);
  const earlier = data.children.reduce((sum, entry) => sum + entry.fromEarlier, 0);
  const billed = data.children.reduce((sum, entry) => sum + entry.billed, 0);
  const paid = data.children.reduce((sum, entry) => sum + entry.paid, 0);
  const worst = data.children.find((entry) => entry.tone === "negative");
  return {
    eyebrow: "Whole family", title: "Fees and payments",
    desc: hasTerm
      ? `What ${school} has billed this term, and what is still owed. It updates the moment the bursar records a payment.`
      : "No term is running, so nothing is billed this term. Earlier terms are still here.",
    launchers: [{ label: "Ask the bursar", drawer: askTheBursar() }],
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: 3,
        cards: [
          { label: "Owed now", value: owed > 0 ? money(owed) : "Nothing owed", sub: earlier > 0 ? `${money(earlier)} of it from a term that has ended` : worst ? `${worst.first}'s balance is overdue` : owed > 0 ? "Part paid" : "Every invoice is settled", tone: worst ? "negative" : owed > 0 ? "attention" : "positive", icon: "wallet" },
          { label: "Paid this term", value: money(paid), sub: billed ? `of ${money(billed)} billed for ${data.children.length === 1 ? "one child" : `${data.children.length} children`}` : "Nothing billed yet", tone: "positive", icon: "receipt" },
          { label: "Receipts on record", value: String(data.payments.length), sub: data.payments.length ? "Every payment the bursar has recorded" : "None yet", tone: "neutral", icon: "doc" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "This term, child by child", sub: "Open a child for the invoice, every receipt and earlier terms.",
        noun: "child", nounPlural: "children", head: ["Child", "Invoice", "Billed this term", "Paid", "Owed in all", "Status", ""], dense: true,
        rows: data.children.map((entry): TableRow => ({
          href: `/portals/parent/fees?child=${entry.id}`,
          keywords: `${entry.name} ${entry.invoiceNo}`,
          cells: [
            nameCell(entry.name, entry.arm, { avatar: false }),
            entry.invoiceNo ? nameCell(entry.invoiceNo, entry.term, { avatar: false }) : text("Nothing billed"),
            text(money(entry.billed), { mono: true }), text(money(entry.paid), { mono: true }),
            { kind: "text", text: money(entry.outstanding), strong: true, mono: true, ...(entry.tone === "negative" ? { tone: "negative" as PanelTone } : {}) },
            pill(entry.status, entry.tone),
            { kind: "action", label: "Open", href: `/portals/parent/fees?child=${entry.id}` },
          ],
        })),
        empty: "No child on your account has been billed yet.",
        foot: "A discount the school has applied is its own line on the invoice, not a reduced total.",
      }]),
    ],
  };
}

function childFees(entry: FeeChild, data: Fees, query: Record<string, string | undefined>, school: string): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const invoices = data.invoices.filter((invoice) => invoice.childId === entry.id);
  const current = invoices.filter((invoice) => invoice.term === entry.term);
  const earlier = invoices.filter((invoice) => invoice.term !== entry.term);
  const payments = data.payments.filter((payment) => payment.childId === entry.id);
  const plan = data.plans.find((item) => item.childId === entry.id) ?? null;

  const head = {
    eyebrow: `${entry.name} · ${entry.arm}`, title: "Fees and payments",
    desc: `Billed by ${school}. It updates the moment the bursar records a payment.`,
    tabs: TABS.map((label) => ({ label })), tab,
    launchers: [{ label: "Ask the bursar", drawer: askTheBursar(entry.id) }],
  };

  if (tab === "Payments and receipts") {
    return {
      ...head,
      rows: [row("1fr", [{
        type: "table", title: "Every payment the school has recorded", sub: "If one you made is not here, the bursar has not recorded it yet — ask, and keep your own proof.",
        noun: "payment", nounPlural: "payments", head: ["Paid", "Amount", "Method", "Receipt", "Against", "Status"], dense: true, per: 12, noRowOpen: true,
        rows: payments.map((payment): TableRow => ({
          keywords: `${payment.reference} ${payment.receipt ?? ""} ${payment.invoice}`,
          cells: [
            text(payment.paidAt ? dLong(payment.paidAt) : "—"),
            { kind: "text", text: money(payment.amount), strong: true, mono: true },
            text(payment.method),
            text(payment.receipt ?? "Not issued", { mono: Boolean(payment.receipt) }),
            text(payment.invoice, { mono: true }),
            pill(payment.status, payment.status === "CONFIRMED" || payment.status === "SUCCESS" ? "positive" : "attention"),
          ],
        })),
        empty: "No payment has been recorded against this child yet.",
      }])],
    };
  }

  if (tab === "Earlier terms") {
    return {
      ...head,
      rows: [row("1fr", [{
        type: "table", title: "Every earlier term", sub: "Kept exactly as the school issued it.",
        noun: "invoice", nounPlural: "invoices", head: ["Term", "Invoice", "Billed", "Balance", "Status", ""], dense: true, per: 12,
        rows: earlier.map((invoice): TableRow => ({
          drawer: invoiceDrawer(invoice, entry),
          keywords: `${invoice.number} ${invoice.term}`,
          cells: [
            text(invoice.term), text(invoice.number, { mono: true }),
            text(money(invoice.total), { mono: true }), text(money(invoice.balance), { mono: true }),
            pill(invoice.balance > 0 ? "Still owed" : "Settled", invoice.balance > 0 ? "attention" : "positive"),
            { kind: "action", label: "Open", drawer: invoiceDrawer(invoice, entry) },
          ],
        })),
        empty: "This is the first term this child has been billed for.",
      }])],
    };
  }

  const invoice = current[0] ?? null;
  return {
    ...head,
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: 3,
        cards: [
          { label: "Owed now", value: entry.outstanding > 0 ? money(entry.outstanding) : "Nothing owed", sub: entry.fromEarlier > 0 ? `${money(entry.fromEarlier)} of it from an earlier term` : invoice ? `Due ${dLong(invoice.due)} on ${invoice.number}` : "Nothing billed this term", tone: entry.tone, icon: "wallet" },
          { label: "Billed this term", value: money(entry.billed), sub: entry.term, tone: "neutral", icon: "receipt" },
          { label: "Paid", value: money(entry.paid), sub: entry.billed ? `${Math.round((entry.paid / entry.billed) * 100)}% of the bill` : "Nothing to pay", tone: "positive", icon: "check" },
        ],
      }]),
      ...(invoice
        ? [row("minmax(0,1.3fr) minmax(0,1fr)", [
            {
              type: "table" as const, title: `What is on ${invoice.number}`, sub: `Issued ${dLong(invoice.issued)} · due ${dLong(invoice.due)}.`,
              noun: "line", nounPlural: "lines", head: ["Item", "Amount"], dense: true, per: 0, noRowOpen: true,
              rows: invoice.lines.map((line): TableRow => ({
                cells: [text(line.quantity > 1 ? `${line.description} × ${line.quantity}` : line.description), text(money(line.amount), { mono: true })],
              })),
              empty: "The school has not itemised this invoice.",
              foot: [
                invoice.discount ? `Less a discount of ${money(invoice.discount)}` : "",
                invoice.fine ? `Plus a late fee of ${money(invoice.fine)}` : "",
                `Total ${money(invoice.total)}`,
                invoice.balance > 0 ? `still owed ${money(invoice.balance)}` : "settled in full",
              ].filter(Boolean).join(" · ") + ".",
            },
            plan
              ? {
                  type: "list" as const, title: "Payment plan", sub: `${plan.number} · the school approved paying this bill in instalments.`,
                  items: plan.items.map((item) => ({
                    label: `${money(item.amount)} · due ${dShort(item.due)}`,
                    sub: item.paid > 0 && item.paid < item.amount ? `${money(item.paid)} paid so far` : item.status === "PAID" ? "Paid" : "Not paid yet",
                    pill: item.status === "PAID" ? "Paid" : item.due < new Date().toISOString().slice(0, 10) ? "Overdue" : "Due",
                    tone: (item.status === "PAID" ? "positive" : item.due < new Date().toISOString().slice(0, 10) ? "negative" : "progress") as PanelTone,
                  })),
                  empty: "The plan has no instalments on it yet.",
                }
              : {
                  type: "note" as const, tone: "neutral" as PanelTone, title: "Paying in instalments",
                  body: "If the whole bill at once is difficult, ask the bursar for a payment plan. The school decides, and an approved plan appears here with each instalment and its date.",
                },
          ])]
        : [row("1fr", [{
            type: "note" as const,
            tone: (entry.outstanding > 0 ? "attention" : "neutral") as PanelTone,
            title: entry.outstanding > 0 ? `Nothing is billed this term, but ${money(entry.outstanding)} is still owed` : "Nothing is billed this term",
            body: entry.outstanding > 0
              ? `${school} has not issued an invoice for ${entry.first} this term. What is owed is from an earlier term — open Earlier terms to see it, or ask the bursar.`
              : `${school} has not issued an invoice for ${entry.first} this term. Earlier terms are under the Earlier terms tab.`,
          }])]),
    ],
  };
}

function invoiceDrawer(invoice: FeeInvoice, entry: FeeChild): DrawerSpec {
  return {
    kicker: invoice.term, title: invoice.number, mode: "view", readOnly: true,
    sub: `${entry.name} · issued ${dLong(invoice.issued)}`,
    facts: [
      ...invoice.lines.map((line): PanelFact => [line.description, money(line.amount), line.quantity > 1 ? `× ${line.quantity}` : ""]),
      ...(invoice.discount ? [["Discount", `−${money(invoice.discount)}`, "Applied by the school"] as PanelFact] : []),
      ...(invoice.fine ? [["Late fee", money(invoice.fine), "Added by the school"] as PanelFact] : []),
      ["Total", money(invoice.total), `Due ${dLong(invoice.due)}`],
      ["Still owed", money(invoice.balance), invoice.balance > 0 ? "" : "Settled", invoice.balance > 0 ? "attention" : "positive"],
    ],
  };
}
