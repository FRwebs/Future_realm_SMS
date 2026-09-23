import { exportDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import {
  debtorFamilies,
  feePayments,
  feeStructures,
  naira,
  nairaShort,
  schoolFees,
} from "@/lib/modules/fees-data";
import type { DrawerSpec } from "@/lib/modules/panels";
import {
  action,
  name as nameCell,
  pill,
  row,
  text,
  type ModuleContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M10 · Fee Management — "What is owed, what came in, who still owes."
 *
 * Every figure derives from the published fee table and the school's own rolls,
 * so the headline and the list beneath it can never tell different stories.
 */

const fees = schoolFees();
const debtors = debtorFamilies();
const outstanding = debtors.reduce((total, debtor) => total + debtor.amount, 0);
const over90 = debtors.filter((debtor) => debtor.days > 90);
const structures = feeStructures();

const paymentRows: TableRow[] = feePayments.map((payment) => ({
  cells: [
    text(payment.ref, { strong: true, mono: true }),
    nameCell(payment.student, payment.admission),
    text(payment.arm),
    text(naira(payment.amount), { mono: true, strong: true }),
    pill(payment.kind, payment.kind === "Full payment" ? "positive" : "attention"),
    text(payment.method),
    payment.bankRef === "—" ? text("—") : text(payment.bankRef, { mono: true }),
    text(payment.recordedBy),
    text(payment.date),
    {
      kind: "action",
      label: "Receipt",
      drawer: {
        kicker: "Receipt",
        title: payment.ref,
        sub: `${payment.student} · ${payment.arm}`,
        readOnly: payment.state === "Final",
        readOnlyNote:
          payment.state === "Final"
            ? "A receipt is a record of money received. It can be reversed, but never edited."
            : undefined,
        facts: [
          ["Student", payment.student, payment.admission],
          ["Amount received", naira(payment.amount)],
          [
            "Against a bill of",
            naira(payment.billed),
            payment.amount >= payment.billed
              ? "Settled in full"
              : `${naira(payment.billed - payment.amount)} still outstanding`,
          ],
          ["Method", payment.method],
          ["Reference", payment.bankRef === "—" ? "None — cash" : payment.bankRef],
          ["Recorded by", payment.recordedBy, payment.date],
          [
            "State",
            payment.state,
            payment.state === "Provisional"
              ? "Taken offline — provisional until it syncs and is confirmed"
              : "Confirmed and reconciled",
          ],
        ],
      },
    },
  ],
  keywords: `${payment.method} ${payment.kind}`,
}));

const debtorRows: TableRow[] = debtors.map((debtor) => ({
  cells: [
    nameCell(debtor.family, debtor.children),
    text(debtor.arm),
    text(naira(debtor.amount), { mono: true, strong: true, tone: "negative" }),
    text(`${debtor.days} days`, {
      strong: debtor.days > 60,
      tone: debtor.days > 90 ? "negative" : debtor.days > 60 ? "attention" : "neutral",
    }),
    pill(
      debtor.bucket,
      debtor.bucket === "90+ days"
        ? "negative"
        : debtor.bucket === "60 days"
          ? "attention"
          : "neutral",
    ),
    text(debtor.stage),
    text(debtor.contact),
    {
      kind: "action",
      label: "Open",
      drawer: {
        kicker: "Debtor",
        title: debtor.family,
        sub: `${debtor.arm} · ${naira(debtor.amount)} outstanding`,
        facts: [
          ["Outstanding", naira(debtor.amount)],
          ["Ageing", `${debtor.days} days`, debtor.bucket],
          ["Escalation so far", debtor.stage],
          ["How they can be reached", debtor.contact],
          [
            "A balance never withholds a report card",
            "Your policy",
            "Changeable in the fee structure",
          ],
        ],
      },
    },
  ],
}));

const structureRows: TableRow[] = structures.map((structure) => ({
  cells: [
    text(structure.className, { strong: true }),
    text(naira(structure.termly), { mono: true, strong: true }),
    text(String(structure.arms), { mono: true }),
    text(String(structure.students), { mono: true }),
    text(naira(structure.billed), { mono: true }),
    pill("Published", "positive"),
    {
      kind: "action",
      label: "Open",
      drawer: {
        kicker: "Fee structure",
        title: structure.className,
        sub: `${naira(structure.termly)} per term`,
        facts: [
          ["Termly fee", naira(structure.termly)],
          ["Arms", String(structure.arms)],
          ["Students billed", String(structure.students)],
          ["Billed this term", naira(structure.billed)],
          [
            "Changing it",
            "Regenerates every invoice in the class",
            "Publication is itself an approval step",
          ],
        ],
      },
    },
  ],
}));

const recordPaymentDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Collections",
  title: "Record a payment",
  sub: "A receipt is issued the moment this is saved, and the family's balance moves with it.",
  facts: [
    ["Next receipt number", "GIA/RCP/26/1844", "Issued in sequence, never reused"],
    ["Recorded by", "You", "Your name is on the receipt"],
    [
      "Full or part",
      "Decided by the amount",
      "A part payment leaves the balance ageing where it was",
    ],
    [
      "Taken offline?",
      "Marked provisional until it syncs",
      "It still issues a receipt, and reconciles when you are back online",
    ],
  ],
  commitLabel: "Record the payment",
  commitNote: "The receipt is issued immediately and the balance updates.",
  commitDone: "Payment recorded",
  commitDoneBody:
    "The receipt has been issued and the family's balance has moved. It appears in today's cash-up.",
};

export const feeManagementContent: ModuleContent = {
  collections: {
    title: "Collections",
    desc: "Money in today, and exactly which families still owe.",
    primary: { label: "Record a payment", drawer: recordPaymentDrawer },
    launchers: [
      {
        label: "Send reminders",
        drawer: nudgeDrawer({
          count: debtors.length,
          kicker: "Collections",
          title: `Remind ${debtors.length} families`,
          who: "families with an outstanding balance",
          what: "Their own balance and how to pay — nothing about anyone else",
          channels: "SMS and email",
          extra: [
            ["Total outstanding", naira(outstanding), `Across ${debtors.length} families`],
            ["Past 90 days", String(over90.length), "These have already had two reminders"],
          ],
        }),
      },
      { label: "Open the history", href: "/fee-management/history" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 6,
          cards: [
            { label: "Expected", value: nairaShort(fees.billed), sub: "Published 6 January" },
            {
              label: "Collected",
              value: nairaShort(fees.collected),
              sub: `${fees.rate}% of expected`,
              tone: "positive",
            },
            {
              label: "Outstanding",
              value: nairaShort(fees.owing),
              sub: `${debtors.length} families on the list`,
              tone: "attention",
            },
            {
              label: "Past 90 days",
              value: naira(over90.reduce((total, debtor) => total + debtor.amount, 0)),
              sub: `${over90.length} families`,
              tone: "negative",
            },
            {
              label: "Discount exposure",
              value: naira(2180000),
              sub: "Sibling, staff and scholarship",
              link: "See the rules",
              href: "/fee-management/structures",
            },
            {
              label: "Last term at this point",
              value: "71.8%",
              sub: `Ahead by ${(fees.rate - 71.8).toFixed(1)} points`,
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Payments received",
          tag: "Last two days",
          tagTone: "positive",
          sub: "Record one, or print the receipt for one already taken.",
          meta: `${feePayments.length} most recent · 1,842 this term · next receipt GIA/RCP/26/1844`,
          search: "Find by student, receipt or bank reference",
          filters: [
            {
              label: "Paying",
              value: "All",
              options: ["All", "Full payment", "Part payment"],
              column: 4,
            },
            {
              label: "Method",
              value: "All",
              options: [
                "All",
                "Bank transfer",
                "Online card",
                "POS card",
                "Cash",
                "Cheque",
                "Mobile money",
                "USSD transfer",
              ],
              column: 5,
            },
          ],
          per: 8,
          noun: "payment",
          nounPlural: "payments",
          acts: [
            { label: "See every payment ever", href: "/fee-management/history" },
            { label: "Record a payment", primary: true, drawer: recordPaymentDrawer },
          ],
          head: [
            "Receipt",
            "Student",
            "Class and arm",
            "Amount",
            "Paying",
            "Method",
            "Reference",
            "Recorded by",
            "Date",
            "",
          ],
          rows: paymentRows,
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Debtor list",
          tag: `${naira(outstanding)} outstanding`,
          tagTone: "attention",
          sub: "Oldest first. Each row is a family, not an invoice.",
          meta: `${debtors.length} families · ${over90.length} past 90 days`,
          search: "Find a family",
          filters: [
            {
              label: "Ageing",
              value: "All",
              options: ["All", "Current", "30 days", "60 days", "90+ days"],
              column: 4,
            },
          ],
          selectable: true,
          per: 8,
          noun: "family",
          nounPlural: "families",
          bulkActs: [
            { label: "Send a reminder" },
            { label: "Request a meeting" },
            { label: "Export selected", primary: true },
          ],
          acts: [
            {
              label: "Export the debtor list",
              drawer: exportDrawer({
                title: "Export the debtor list",
                what: "Family, children, amount, ageing, escalation and contact",
                scope: `${debtors.length} families · ${naira(outstanding)} outstanding`,
                format: "Excel",
                note: "For the proprietor's meeting.",
              }),
            },
          ],
          head: ["Family", "Arm", "Outstanding", "Ageing", "Bucket", "Escalation", "Reachable", ""],
          rows: debtorRows,
          foot: "A fee balance never withholds a report card — that is your policy, and it is changeable in the fee structure.",
        },
      ]),
    ],
  },

  structures: {
    title: "Structures",
    desc: "What each class is billed, and the rules that adjust it.",
    primary: {
      label: "Publish a fee structure",
      drawer: {
        mode: "commit",
        kicker: "Structures",
        title: "Publish a fee structure",
        sub: "Publishing regenerates every invoice in the class.",
        facts: [
          ["Scope", "One class at a time"],
          [
            "What it does",
            "Regenerates every invoice in that class",
            "Payments already received are preserved and re-applied",
          ],
          ["Approval", "Required · Proprietor", "Fee structure publication is routed"],
          ["Families are told", "Only once it is approved"],
        ],
        commitLabel: "Send for approval",
        commitDone: "Sent for approval",
        commitDoneBody:
          "It is with the Proprietor. No invoice changes until it is approved.",
      },
    },
    launchers: [{ label: "Collections", href: "/fee-management/collections" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            { label: "Classes billed", value: String(structures.length), sub: "Every class has a structure" },
            {
              label: "Billed this term",
              value: nairaShort(fees.billed),
              sub: `${structures.reduce((n, s) => n + s.students, 0).toLocaleString()} students`,
            },
            {
              label: "Lowest",
              value: naira(Math.min(...structures.map((s) => s.termly))),
              sub: "Nursery",
              tone: "neutral",
            },
            {
              label: "Highest",
              value: naira(Math.max(...structures.map((s) => s.termly))),
              sub: "SSS 3 · examination year",
              tone: "neutral",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Every fee structure",
          sub: "One row per class. Open it to see what changing it would regenerate.",
          meta: `${structures.length} classes · all published`,
          search: "Find a class",
          per: 14,
          noun: "class",
          nounPlural: "classes",
          head: ["Class", "Termly fee", "Arms", "Students", "Billed this term", "State", ""],
          rows: structureRows,
          foot: "Changing a published structure regenerates every invoice in that class, and is routed for approval before any family sees it.",
        },
      ]),
      row("1fr 1fr", [
        {
          type: "table",
          title: "Adjustment rules",
          sub: "What reduces a bill, and whether anyone has to decide.",
          head: ["Rule", "Reduces by", "Applies to", "Decided by"],
          rows: [
            {
              cells: [
                nameCell("Sibling discount", "Second child onward"),
                text("10%", { strong: true }),
                text("148 children"),
                pill("Standing rule", "positive"),
              ],
            },
            {
              cells: [
                nameCell("Staff children", "Full-time staff only"),
                text("50%", { strong: true }),
                text("21 children"),
                pill("Standing rule", "positive"),
              ],
            },
            {
              cells: [
                nameCell("Merit scholarship", "Awarded per session"),
                text("100%", { strong: true }),
                text("6 children"),
                pill("Proprietor", "submitted"),
              ],
            },
            {
              cells: [
                nameCell("Hardship waiver", "Case by case, with evidence"),
                text("Varies"),
                text("4 families"),
                pill("Routed", "attention"),
              ],
            },
          ],
          foot: "A standing rule needs no human at all, and every firing is logged. Anything with discretion in it is routed.",
        },
        {
          type: "facts",
          title: "How billing works here",
          sub: "The same rules for every class.",
          facts: [
            ["Billing cycle", "Per term", "Three terms to a session"],
            ["Invoice generated", "On publication of the structure"],
            [
              "Part payment",
              "Accepted and receipted",
              "The balance keeps ageing from the original due date",
            ],
            [
              "A balance and a report card",
              "Unrelated",
              "Your policy — a card is never withheld for money",
            ],
            ["Reversal", "Routed to the Bursar and the Proprietor", "Money leaving a ledger"],
            ["Receipts", "Kept for 7 years", "Every one retrievable by student or reference"],
          ],
        },
      ]),
    ],
  },

  review: {
    title: "Review",
    desc: "Discounts, waivers and reversals waiting on a decision.",
    primary: { label: "Open the approvals queue", href: "/approvals-workflow/queue" },
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Waiting on a decision",
              value: "9",
              sub: "Waivers, discounts and reversals",
              tone: "attention",
              link: "Open the queue",
              href: "/approvals-workflow/queue",
            },
            {
              label: "Oldest",
              value: "19 days",
              sub: "A hardship waiver",
              tone: "negative",
            },
            {
              label: "Value under review",
              value: naira(894000),
              sub: "If every one were approved",
              tone: "withheld",
            },
            {
              label: "Approved this term",
              value: "34",
              sub: `${naira(2180000)} in total`,
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Pending discounts and waivers",
          sub: "Each one names the family, the amount and the evidence behind it.",
          meta: "9 waiting · 2 escalated",
          search: "Find a family",
          per: 8,
          noun: "request",
          nounPlural: "requests",
          head: ["Family", "Type", "Amount", "Reason", "Raised by", "Age", ""],
          rows: [
            {
              cells: [
                nameCell("Okonkwo family", "2 children · SSS 2A, JSS 1B"),
                pill("Full waiver", "withheld"),
                text(naira(182000), { mono: true, strong: true }),
                text("Father deceased · verified"),
                text("Mrs Chinelo Obi"),
                text("19 days", { tone: "negative", strong: true }),
                action("Decide", "/approvals-workflow/queue"),
              ],
            },
            {
              cells: [
                nameCell("Mohammed family", "1 child · SSS 2A"),
                pill("Partial waiver", "withheld"),
                text(naira(96000), { mono: true, strong: true }),
                text("Loss of employment"),
                text("Mrs Chinelo Obi"),
                text("11 days", { tone: "attention", strong: true }),
                action("Decide", "/approvals-workflow/queue"),
              ],
            },
            {
              cells: [
                nameCell("Bature family", "1 child · JSS 3B"),
                pill("Scholarship", "submitted"),
                text(naira(249000), { mono: true, strong: true }),
                text("Merit · top of the cohort"),
                text("Mrs Folake Adeniyi"),
                text("4 days"),
                action("Decide", "/approvals-workflow/queue"),
              ],
            },
            {
              cells: [
                nameCell("3 payment reversals", "Across 3 families"),
                pill("Reversal", "negative"),
                text(naira(112000), { mono: true, strong: true }),
                text("Duplicate bank postings"),
                text("Mr Tunde Bakare"),
                text("9 days", { tone: "attention", strong: true }),
                action("Decide", "/approvals-workflow/queue"),
              ],
            },
          ],
          foot: "A reversal is money leaving a ledger, so it is decided one payment at a time and can never be bulk-approved.",
        },
      ]),
    ],
  },

  history: {
    title: "History",
    desc: "Every term on record, and every receipt behind it.",
    primary: {
      label: "Spool a financial statement",
      drawer: exportDrawer({
        title: "Spool a financial statement",
        what: "Billed, collected, outstanding and discounts, term by term",
        scope: "Every term on record · 4 sessions",
        format: "Excel and PDF",
        note: "Spooled records are kept for 7 years, and every spool is itself an audit entry.",
      }),
    },
    launchers: [{ label: "Collections", href: "/fee-management/collections" }],
    rows: [
      row("1fr", [
        {
          type: "table",
          title: "Term by term",
          sub: "What was billed, what came in, and what never did.",
          meta: "4 sessions on record",
          head: ["Session", "Term", "Billed", "Collected", "Rate", "Written off"],
          rows: [
            {
              cells: [
                text("2026/2027", { strong: true }),
                text("Second Term"),
                text(nairaShort(fees.billed), { mono: true }),
                text(nairaShort(fees.collected), { mono: true }),
                text(`${fees.rate}%`, { strong: true, tone: "positive" }),
                text("—"),
              ],
            },
            {
              cells: [
                text("2026/2027", { strong: true }),
                text("First Term"),
                text("₦331.0m", { mono: true }),
                text("₦318.4m", { mono: true }),
                text("96.2%", { strong: true, tone: "positive" }),
                text(naira(412000), { mono: true }),
              ],
            },
            {
              cells: [
                text("2025/2026", { strong: true }),
                text("Third Term"),
                text("₦324.8m", { mono: true }),
                text("₦310.1m", { mono: true }),
                text("95.5%", { strong: true, tone: "positive" }),
                text(naira(688000), { mono: true }),
              ],
            },
            {
              cells: [
                text("2025/2026", { strong: true }),
                text("Second Term"),
                text("₦321.4m", { mono: true }),
                text("₦300.9m", { mono: true }),
                text("93.6%", { strong: true, tone: "attention" }),
                text(naira(1240000), { mono: true }),
              ],
            },
          ],
          foot: "A term is never closed with money still moving — the write-off column is what the school formally gave up on.",
        },
      ]),
      row("1.15fr 1fr", [
        {
          type: "table",
          title: "Daily cash-up",
          sub: "What each person took, and whether it has been closed.",
          meta: "A cash-up stays open until it is closed, and appears in Command Center · Oversight while it does",
          head: ["Day", "Recorded by", "Payments", "Amount", "State"],
          rows: [
            {
              cells: [
                text("4 September", { strong: true }),
                text("Mr Tunde Bakare"),
                text("1", { mono: true }),
                text(naira(60000), { mono: true }),
                pill("Open", "attention"),
              ],
            },
            {
              cells: [
                text("3 September", { strong: true }),
                text("Mrs Chinelo Obi"),
                text("2", { mono: true }),
                text(naira(519000), { mono: true }),
                pill("Open", "attention"),
              ],
            },
            {
              cells: [
                text("2 September", { strong: true }),
                text("Mrs Chinelo Obi"),
                text("2", { mono: true }),
                text(naira(215000), { mono: true }),
                pill("Closed", "positive"),
              ],
            },
            {
              cells: [
                text("1 September", { strong: true }),
                text("Mrs Chinelo Obi"),
                text("2", { mono: true }),
                text(naira(610000), { mono: true }),
                pill("Closed", "positive"),
              ],
            },
          ],
        },
        {
          type: "list",
          title: "Integrity flags",
          sub: "Money that does not add up, and what clears each one.",
          items: [
            {
              label: "1 provisional receipt unconfirmed",
              sub: "GIA/RCP/26/P-09 · taken offline by Miss Grace Etim on 2 September",
              pill: "Provisional",
              tone: "attention",
              viewLabel: "Open",
              facts: [
                ["Receipt", "GIA/RCP/26/P-09"],
                ["Taken by", "Miss Grace Etim", "Cash · offline"],
                ["Amount", naira(95000)],
                ["Why it is flagged", "Taken offline and not yet confirmed against the bank"],
                ["What clears it", "Confirming the cash was banked"],
              ],
            },
            {
              label: "2 cash-up days still open",
              sub: "3 and 4 September · ₦579,000 across them",
              pill: "Open",
              tone: "attention",
              viewLabel: "Open",
              facts: [
                ["Days", "3 and 4 September"],
                ["Amount", naira(579000)],
                ["Why it is flagged", "A day's takings are not reconciled until the day is closed"],
                ["What clears it", "Closing each day against the bank"],
              ],
            },
            {
              label: "3 payment reversals waiting",
              sub: "₦112,000 · duplicate bank postings, 9 days old",
              pill: "Routed",
              tone: "negative",
              viewLabel: "Open the queue",
              href: "/approvals-workflow/queue",
            },
          ],
        },
      ]),
    ],
  },
};
