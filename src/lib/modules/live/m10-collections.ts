import { receiptDrawer } from "@/lib/modules/live/documents";
import { apiGet } from "@/lib/api/server";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import { FEES, adjustDrawer, meetingDrawer, naira, nairaShort, planDrawer, recordPaymentDrawer, remindersDrawer, writeOffDrawer } from "@/lib/modules/live/m10-forms";
import type { Collections, FamilyDetail, FamilyRow, FormClass } from "@/lib/modules/live/m10-types";
import {
  bar,
  name as nameCell,
  pill,
  text,
  type KpiCard,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableCellKind,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * Collections: money in today, and exactly which families still owe. A family is one row and one
 * conversation — never a row for each child.
 */

export const loadCollections = () => apiGet<Collections>(`${FEES}/collections`);
export const loadFormClass = () => apiGet<FormClass>(`${FEES}/collections/form-class`);
export const loadFamily = (id: string) => apiGet<FamilyDetail>(`${FEES}/families/${encodeURIComponent(id)}`);

export const BUCKET_TONE: Record<string, PanelTone> = { Current: "positive", "30 days": "submitted", "60 days": "attention", "90+ days": "negative" };
export const STAGE_TONE: Record<string, PanelTone> = { "Not started": "neutral", "First reminder": "attention", "Second reminder": "attention", "Meeting requested": "progress", "On a payment plan": "positive" };
const KIND_TONE: Record<string, PanelTone> = { "Full payment": "positive", "Part payment": "attention" };
const token = (kind: string, value: string) => `${kind}:${value}|`;

export const familyHref = (id: string) => `/fee-management/collections/families/${encodeURIComponent(id)}`;

export function collectionsTab(data: Collections): TabContent {
  const { totals, debtors, payments, bars } = data;
  const record = recordPaymentDrawer(data);
  const remind = remindersDrawer({ count: debtors.length, amount: totals.outstanding });
  const over90 = debtors.filter((family) => family.days > 90);
  const rate = totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const ahead = totals.lastTermRate === null ? null : rate - Math.round(totals.lastTermRate);

  const cards: KpiCard[] = [
    { label: "Expected", value: nairaShort(totals.expected), sub: data.term ? `Billed for ${data.term.name}` : "Everything billed" },
    { label: "Collected", value: nairaShort(totals.collected), tone: "positive", sub: `${rate}% of expected` },
    { label: "Outstanding", value: nairaShort(totals.outstanding), tone: totals.outstanding ? "attention" : "positive", sub: plural(totals.families, "family", "families") },
    {
      label: "Past 90 days",
      value: nairaShort(totals.over90),
      tone: totals.over90 ? "negative" : "positive",
      sub: plural(totals.over90Families, "family", "families"),
      ...(totals.over90Families
        ? { link: "Open them", drawer: { mode: "view" as const, kicker: "Collections", title: `Past 90 days · ${plural(over90.length, "family", "families")}`, sub: "The oldest balances on the books.", facts: over90.slice(0, 10).map((family) => [family.name, naira(family.owing), `${family.days} days · ${family.stage}`] as PanelFact), readOnly: true, readOnlyNote: "Open a family from the debtor list to act on it." } }
        : {}),
    },
    { label: "Discount exposure", value: nairaShort(totals.discount), sub: "Sibling, staff and scholarship, as billed", link: "See the rules", href: "/fee-management/structures" },
    {
      label: "Last term at this point",
      value: totals.lastTermRate === null ? "No earlier term" : `${totals.lastTermRate}%`,
      tone: ahead === null ? "neutral" : ahead >= 0 ? "positive" : "attention",
      sub: ahead === null ? "Nothing billed in the term before" : `${ahead >= 0 ? "Ahead" : "Behind"} by ${Math.abs(ahead)} points`,
    },
  ];

  const paymentRows: TableRow[] = payments.map((payment) => ({
    id: payment.id,
    cells: [
      text(payment.ref, { strong: true, mono: true }),
      nameCell(payment.student, payment.adm),
      text(payment.arm),
      text(naira(payment.amount), { mono: true, strong: true }),
      pill(payment.kind, KIND_TONE[payment.kind]),
      text(payment.mode),
      payment.bankRef ? text(payment.bankRef, { mono: true }) : text("—"),
      nameCell(payment.by, "Bursary"),
      text(payment.at ? dayLabel(payment.at) : "—"),
      { kind: "action", label: "Print receipt", drawer: receiptDrawer(payment.id, payment.ref) },
    ],
    keywords: `${payment.kind} ${payment.mode} ${payment.arm}`,
  }));

  const debtorRows: TableRow[] = debtors.map((family) => ({
    id: family.id,
    cells: [
      nameCell(family.name, `${family.relation} · ${family.phone}`),
      text(family.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join("  ·  ")),
      text(naira(family.owing), { mono: true, strong: true, tone: family.days > 90 ? "negative" : "attention" }),
      pill(family.bucket, BUCKET_TONE[family.bucket]),
      text(String(family.days)),
      pill(family.stage, STAGE_TONE[family.stage]),
      pill(family.portal, family.portal === "Active" ? "positive" : "attention"),
      { kind: "action", label: "Open", href: familyHref(family.id) },
    ],
    href: familyHref(family.id),
    keywords: `${token("age", family.bucket)}${token("stage", family.stage)}${token("portal", family.portal)} ${family.children.map((child) => `${child.name} ${child.arm}`).join(" ")} ${family.phone}`,
  }));

  const sectionBars = bars.sections.map((section) => {
    const pct = section.billed ? Math.round((section.paid / section.billed) * 100) : 0;
    return { label: section.name, value: pct, display: `${nairaShort(section.paid)} of ${nairaShort(section.billed)}`, tone: (pct >= 80 ? "positive" : pct >= 60 ? "attention" : "negative") as PanelTone };
  });
  const methodTotal = bars.methods.reduce((sum, method) => sum + method.amount, 0);
  const methodBars = bars.methods.sort((a, b) => b.amount - a.amount).map((method) => ({ label: method.name, value: methodTotal ? Math.round((method.amount / methodTotal) * 100) : 0, display: naira(method.amount), tone: "progress" as PanelTone }));

  return {
    title: "Collections",
    desc: "Money in today, and exactly which families still owe.",
    primary: { label: "Record a payment", drawer: record },
    launchers: [
      { label: "Send reminders", drawer: remind },
      { label: "Export the debtor list", href: "/fee-management/collections/export" },
      { label: "Open the history", href: "/fee-management/history" },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: data.term?.label ?? "This term", sub: "Read off invoices and payments — never typed", per: 6, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Payments received",
            tag: `${naira(data.recent.amount)} in the last two days`,
            tagTone: "positive",
            sub: "Record one, or print the receipt for one already taken.",
            meta: `${payments.length} most recent · ${totals.receipts.toLocaleString("en-NG")} on record`,
            noun: "payment",
            nounPlural: "payments",
            search: "Find by student, receipt or bank reference",
            filters: [
              { label: "Class", value: "All", options: ["All", ...data.options.levels] },
              { label: "Arm", value: "All", options: ["All", ...data.options.arms] },
              { label: "Paying", value: "All", options: ["All", "Full payment", "Part payment"] },
              { label: "Method", value: "All", options: ["All", ...data.options.methods] },
            ],
            acts: [{ label: "See every payment ever", href: "/fee-management/history" }, { label: "Record a payment", primary: true, drawer: record }],
            head: ["Receipt", "Student", "Class and arm", "Amount", "Paying", "Method", "Reference", "Recorded by", "Date", ""],
            rows: paymentRows,
            noRowOpen: true,
            per: 8,
            emptyTitle: "No payment has been recorded",
            emptyBody: "Record the first one and its receipt appears here.",
            foot: "A part payment leaves a balance on the child’s account, and the family stays on the debtor list until it clears.",
          },
        ],
      },
      ...(over90.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${naira(totals.over90)} is more than 90 days old, across ${plural(over90.length, "family", "families")}`,
                  body: "Past 90 days your policy asks for a meeting rather than another reminder — a third SMS to a family that has ignored two is not a collection strategy. Nothing here withholds a report card; that is a separate decision this school has not taken.",
                  acts: [
                    { label: `Request meetings with all ${over90.length}`, drawer: { ...meetingDrawer({ selection: true }), submit: { ...meetingDrawer({ selection: true }).submit!, body: { families: over90.map((family) => family.id) } } } },
                    { label: "Export for the proprietor", href: "/fee-management/collections/export" },
                  ],
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Debtor list",
            tag: plural(debtors.length, "family", "families"),
            tagTone: debtors.length ? "attention" : "positive",
            sub: "Open a family for what was billed, what came in, and every conversation about it.",
            meta: `${plural(debtors.length, "family", "families")} · ${naira(totals.outstanding)} outstanding · ${over90.length} past 90 days`,
            noun: "family",
            nounPlural: "families",
            search: "Find by family, child, phone or admission number",
            filters: [
              { label: "Ageing", value: "All", options: ["All", "Current", "30 days", "60 days", "90+ days"], match: Object.fromEntries(["Current", "30 days", "60 days", "90+ days"].map((name) => [name, token("age", name)])) },
              { label: "Class", value: "All", options: ["All", ...data.options.levels] },
              { label: "Arm", value: "All", options: ["All", ...data.options.arms] },
              { label: "Escalation", value: "All", options: ["All", "Not started", "First reminder", "Second reminder", "Meeting requested", "On a payment plan"], match: Object.fromEntries(["Not started", "First reminder", "Second reminder", "Meeting requested", "On a payment plan"].map((name) => [name, token("stage", name)])) },
              { label: "Portal", value: "All", options: ["All", "Active", "Not activated"], match: { Active: token("portal", "Active"), "Not activated": token("portal", "Not activated") } },
            ],
            acts: [{ label: "Export for the meeting", href: "/fee-management/collections/export" }, { label: "Record a payment", drawer: record }, { label: "Send reminders", primary: true, drawer: remind }],
            selectable: true,
            bulkActs: [
              { label: "Send a reminder", drawer: remindersDrawer({ count: 0, amount: 0, selection: true }), selection: { key: "families", noun: "family" } },
              { label: "Request a meeting", drawer: meetingDrawer({ selection: true }), selection: { key: "families", noun: "family" } },
              { label: "Export for the meeting", primary: true, export: true },
            ],
            head: ["Family", "Children · class and arm", "Outstanding", "Ageing", "Days", "Escalation", "Portal", ""],
            rows: debtorRows,
            per: 12,
            emptyTitle: "Nobody owes anything",
            emptyBody: "Every family is settled — the debtor list is empty.",
            foot: "Escalation runs first reminder → second → meeting requested, read from what was actually sent. A family with three children here is one row and one conversation, never three.",
          },
        ],
      },
      {
        cols: "1fr 1fr 1fr",
        panels: [
          { type: "bars", title: "Collection rate by level", sub: "Where the shortfall actually is.", rows: sectionBars.length ? sectionBars : [{ label: "Nothing billed yet", value: 0, display: "—" }] },
          { type: "bars", title: "By payment method", sub: `Method distribution across ${plural(totals.receipts, "payment")} on record.`, rows: methodBars.length ? methodBars : [{ label: "No payment yet", value: 0, display: "—" }] },
          {
            type: "list",
            title: "Fee item breakdown",
            sub: "Every amount in ₦, the school’s configured currency.",
            items: bars.items.map((item) => ({ label: item.name, sub: `${naira(item.expected)} expected · ${naira(item.collected)} collected`, pill: `${item.expected ? Math.round((item.collected / item.expected) * 100) : 0}%`, tone: "neutral" as PanelTone })),
            foot: bars.items.length ? undefined : "Nothing has been billed yet.",
          },
        ],
      },
    ],
  };
}

/** A form master sees whether a family has paid — never what they owe. */
export function formClassTab(data: FormClass): TabContent {
  const rows: TableRow[] = data.rows.map((row) => ({
    id: row.id,
    cells: [nameCell(row.name, row.adm), pill(row.status, row.status === "Paid" ? "positive" : row.status === "Not billed" ? "neutral" : "attention"), text(row.guardian), row.status === "Outstanding" || row.status === "Part paid" ? { kind: "action", label: "Refer to Bursar", drawer: { mode: "view", kicker: "Collections", title: `Refer ${row.name} to the Bursar`, sub: "The Bursar sees the amount and takes it from here.", facts: [["Student", row.name, row.adm], ["Status", row.status], ["Guardian", row.guardian]], readOnly: true, readOnlyNote: "Referring is a conversation, not a message from this screen: tell the Bursar in person, or use Communication." } } : text("—")],
  }));
  return {
    title: `Collections · ${data.className}`,
    desc: "Fee status for your own form class — never amounts.",
    rows: [
      { cols: "1fr", panels: [{ type: "note", tone: "offline", icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z", title: "Amounts are not shown to a form master", body: "You can see whether a family is paid, part-paid or outstanding — enough to know who to be gentle with, and who to send to the Bursar." }] },
      { cols: "1fr", panels: [{ type: "table", title: "Fee status · your form class", sub: "Status only.", meta: `${plural(data.rows.length, "student")} · ${data.outstanding} outstanding`, search: "Find a student", noun: "student", nounPlural: "students", head: ["Student", "Status", "Primary guardian", "Action"], rows, per: 12, emptyTitle: "No form class", emptyBody: "You are not named as a form master for any class." }] },
    ],
  };
}

/* ───────────────────────────── one family ───────────────────────────── */

/** A reminder to this one family, and nobody else. */
function reminderFor(family: FamilyRow) {
  const base = remindersDrawer({ count: 1, amount: family.owing });
  return { ...base, submit: { ...base.submit!, body: { families: [family.id] } } };
}

export type FeePage = TabContent & { crumb: { label: string; href: string } };

export function familyPage(detail: FamilyDetail, data: Collections): FeePage {
  const { family, children } = detail;
  const owing = family.owing;
  const first = children[0];
  const record = recordPaymentDrawer({ ...data, payers: data.payers.filter((payer) => payer.guardian === family.id || payer.family === family.name) }, { studentId: first?.id });
  const settled = owing <= 0;
  const cards: KpiCard[] = [
    { label: "Outstanding", value: naira(owing), tone: settled ? "positive" : family.days > 90 ? "negative" : "attention", sub: settled ? "Settled in full" : `${family.bucket} · ${family.days} days` },
    { label: "Billed", value: naira(family.billed), sub: plural(children.length, "child", "children") },
    { label: "Received", value: naira(family.paid), tone: "positive", sub: plural(detail.receipts.length, "receipt") },
    { label: "Settled", value: `${family.billed ? Math.round((family.paid / family.billed) * 100) : 0}%`, tone: family.paid / Math.max(1, family.billed) > 0.7 ? "positive" : "attention", sub: "Of the bill on record" },
    { label: "Escalation", value: family.stage, tone: STAGE_TONE[family.stage], sub: detail.contacts[0] ? `Last: ${dayLabel(detail.contacts[0].at)}` : "Nothing sent yet" },
    { label: "Plan", value: detail.plans.some((plan) => plan.status !== "PAID" && plan.status !== "CANCELLED") ? "In place" : "None", tone: detail.plans.length ? "positive" : "neutral", sub: detail.plans[0] ? `${detail.plans[0].number}` : "No instalment plan" },
  ];

  const lines: TableRow[] = children.map((child) => ({
    id: child.id,
    cells: [
      nameCell(child.name, child.boarding ? "Boarder" : "Day student"),
      text(child.arm),
      text(child.structures.join(" + ") || "—", { strong: child.structures.length === 1 }),
      text(naira(child.billed), { mono: true }),
      text(naira(child.paid), { mono: true }),
      text(naira(child.owing), { mono: true, strong: true, tone: child.owing ? "attention" : "positive" }),
      pill(child.state, child.state === "Paid" ? "positive" : "attention"),
      { kind: "action", label: "Open", href: `/student-records/registry` },
    ],
  }));
  const totalsRow: TableCellKind[] = [text("Total", { strong: true }), text(""), text(""), text(naira(family.billed), { mono: true, strong: true }), text(naira(family.paid), { mono: true, strong: true }), text(naira(owing), { mono: true, strong: true, tone: owing ? "attention" : "positive" }), pill(owing ? family.bucket : "Settled", owing ? BUCKET_TONE[family.bucket] : "positive"), text("")];

  const receiptRows: TableRow[] = detail.receipts.map((receipt) => ({
    id: receipt.id,
    cells: [text(receipt.ref, { mono: true, strong: true }), text(naira(receipt.amount), { mono: true, strong: true }), text(receipt.mode), text(receipt.bankRef ?? "—", { mono: true }), text(receipt.at ? dayLong(receipt.at) : "—"), { kind: "action", label: "View receipt", drawer: receiptDrawer(receipt.id, receipt.ref) }],
  }));

  const aged = (bucket: string) => (family.bucket === bucket && owing > 0 ? naira(owing) : naira(0));
  const conversation = [
    ...detail.contacts.map((contact) => ({ label: contact.summary, sub: `${dayLong(contact.at)}${contact.channel ? ` · ${contact.channel}` : ""}${contact.meetingAt ? ` · meeting ${dayLong(contact.meetingAt)}` : ""}`, pill: contact.kind === "REMINDER" ? "Sent" : contact.kind === "MEETING" ? "Awaiting" : contact.kind === "PLAN" ? "Agreed" : "Recorded", tone: (contact.kind === "MEETING" ? "attention" : "neutral") as PanelTone })),
    ...children.flatMap((child) => child.invoices.map((invoice) => ({ label: `Invoice ${invoice.number}`, sub: `${dayLong(invoice.issuedOn)} · ${naira(invoice.total)} · ${invoice.structure}`, pill: "Issued", tone: "neutral" as PanelTone }))),
  ];

  const facts: PanelFact[] = [
    ["Report cards", "Never withheld for debt", "This school’s policy — changeable in School Configuration · Policies"],
    ["Payment plan", "Available", "Up to 3 instalments within the term"],
    ["Adjustment or waiver", "Needs approval", `The bursary to ${naira(detail.policy.approvalLimit)}; the Proprietor or Principal above`],
    ["Write-off", detail.policy.writeOffBy, "Recorded permanently against the family"],
    ["Sibling discount", children.length > 1 ? "Applied by rule at publication" : "Not applicable", ""],
    ["Next escalation", family.days > 90 ? "Meeting, then the Proprietor" : "A reminder, then a second", "Read from what has been sent"],
  ];

  return {
    title: family.name,
    desc: `${plural(children.length, "child", "children")} · ${naira(owing)} outstanding · ${family.days} days.`,
    crumb: { label: "Back to the debtor list", href: "/fee-management/collections" },
    primary: { label: "Record a payment", drawer: record },
    launchers: [
      { label: "Send a reminder", drawer: reminderFor(family) },
      { label: "Agree a payment plan", drawer: planDrawer(detail) },
      { label: "Apply an adjustment", drawer: adjustDrawer(detail) },
      { label: "Open the family record", href: "/parents-guardians/guardians" },
    ],
    rows: [
      ...(family.days > 90 && owing > 0
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `This balance is ${family.days} days old`,
                  body: "Past 90 days your policy asks for a meeting rather than a third reminder. Nothing here withholds a report card — that is a separate decision, and this school does not take it automatically.",
                  acts: [{ label: "Request a meeting", drawer: meetingDrawer({ family }) }, { label: "Agree a payment plan", drawer: planDrawer(detail) }, { label: "Write off with approval", drawer: writeOffDrawer(detail) }],
                },
              ],
            },
          ]
        : []),
      { cols: "1fr", panels: [{ type: "kpi", title: `This family · ${data.term?.label ?? "this term"}`, per: 6, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "What this family was billed, child by child",
            tag: `${naira(owing)} outstanding`,
            tagTone: owing ? "attention" : "positive",
            sub: "A family pays once — this is the same balance split across the children it covers.",
            meta: `${plural(children.length, "child", "children")} · ${naira(family.billed)} billed · ${naira(family.paid)} received`,
            noun: "child",
            nounPlural: "children",
            acts: [{ label: "Print the statement", href: `/fee-management/history/statement?scope=One+family&which=${encodeURIComponent(family.id)}&period=This+session` }, { label: "Record a payment", primary: true, drawer: record }],
            head: ["Child", "Arm", "Fee structure", "Billed", "Paid", "Outstanding", "State", ""],
            rows: lines,
            summaryRows: [totalsRow],
            foot: "One balance, one conversation — a family with three children here is never chased three times. A boarder carries their class structure plus the boarding supplement.",
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "table",
            title: "Every payment this family has made",
            sub: "With its mode, its reference and the receipt it produced.",
            meta: `${plural(detail.receipts.length, "receipt")} · ${naira(family.paid)} received`,
            noun: "receipt",
            nounPlural: "receipts",
            acts: [{ label: "Record a payment", primary: true, drawer: record }],
            head: ["Receipt", "Amount", "Mode", "Reference", "Date", ""],
            rows: receiptRows,
            emptyTitle: "Nothing has been received",
            emptyBody: `The full ${naira(family.billed)} is outstanding.`,
          },
          {
            type: "bars",
            title: "How this balance aged",
            sub: "Where the outstanding amount sits.",
            rows: [
              { label: "Current · under 30 days", value: family.bucket === "Current" && owing > 0 ? 100 : 0, display: aged("Current"), tone: "positive" },
              { label: "30 days", value: family.bucket === "30 days" ? 100 : 0, display: aged("30 days"), tone: "submitted" },
              { label: "60 days", value: family.bucket === "60 days" ? 100 : 0, display: aged("60 days"), tone: "attention" },
              { label: "90+ days", value: family.bucket === "90+ days" ? 100 : 0, display: aged("90+ days"), tone: "negative" },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          { type: "list", title: "Every conversation about this balance", sub: "What was sent, when, and whether it was answered.", items: conversation, foot: conversation.length ? undefined : "Nothing has been sent about this account." },
          {
            type: "facts",
            title: "What the school may do about this",
            tuck: "What the school may do",
            tag: "Policy",
            tagTone: "neutral",
            sub: "The decisions available, and the ones this school has chosen not to take.",
            per: 1,
            acts: [{ label: "Agree a payment plan", drawer: planDrawer(detail) }, { label: "Request a meeting", primary: true, drawer: meetingDrawer({ family }) }],
            facts,
          },
        ],
      },
      ...(detail.plans.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "list" as const,
                  title: "Payment plans",
                  sub: "Each instalment, and whether it has been met.",
                  items: detail.plans.flatMap((plan) => plan.items.map((item) => ({ label: `${plan.number} · ${naira(item.amount)}`, sub: `Due ${dayLong(item.dueOn)} · ${naira(item.paid)} paid`, pill: item.status === "PAID" ? "Paid" : item.status === "OVERDUE" ? "Overdue" : "Due", tone: (item.status === "PAID" ? "positive" : item.status === "OVERDUE" ? "negative" : "neutral") as PanelTone }))),
                },
              ],
            },
          ]
        : []),
    ],
  };
}

export const barRow = bar;
