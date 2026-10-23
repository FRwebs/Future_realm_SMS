import { invoiceDocDrawer } from "@/lib/modules/live/documents";
import { apiGet } from "@/lib/api/server";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import { SB, cancelSwitchDrawer, invoiceDrawer, naira, payOneDrawer, renewDrawer, switchDrawer, topUpDrawer } from "@/lib/modules/live/m11-forms";
import type { Credits, InvoiceDoc, InvoiceRow, Plan } from "@/lib/modules/live/m11-types";
import { pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Plan: what Future Realm costs at the school's current roll, and how to change it. Priced per
 * student per term, so renewal is arithmetic — students × rate — and the estimate is the form.
 */

export const loadPlan = () => apiGet<Plan>(`${SB}/plan`);
export const loadCreditsForTopUp = () => apiGet<Credits>(`${SB}/credits`);
export const loadInvoice = (id: string) => apiGet<InvoiceDoc>(`${SB}/invoices/${encodeURIComponent(id)}`);

export const STATE_TONE: Record<string, PanelTone> = { Paid: "positive", Outstanding: "attention", Overdue: "negative", Active: "positive", Low: "attention", "No wallet": "negative", "Not included": "neutral", Completed: "neutral", ACTIVE: "positive", TRIAL: "attention" };
const accountTone = (state: string): PanelTone => (state === "Paid and current" ? "positive" : state === "Overdue" ? "negative" : "attention");

export function planTab(p: Plan, credits: Credits): TabContent {
  const renew = renewDrawer(p);
  const open = p.invoices.filter((invoice) => invoice.state !== "Paid");
  const latest = p.invoices[0];
  const payNow = open[0] ? payOneDrawer(open[0], p) : undefined;
  const trial = p.school.billingStatus === "TRIAL";

  const cards: KpiCard[] = [
    { label: "This term", value: naira(p.thisTerm.amount), sub: `${p.thisTerm.students.toLocaleString("en-NG")} students · ${naira(p.rate)} each${p.thisTerm.billed ? "" : " · estimate"}`, tone: "neutral" },
    { label: "Plan", value: p.tierName, sub: "Per student, per term", tone: "positive" },
    { label: "Students billed", value: p.roll.toLocaleString("en-NG"), sub: p.thisTerm.billed ? `On ${p.thisTerm.invoice}` : "Counted from the roll today" },
    { label: "Renews", value: p.next ? dayLabel(p.next.start) : "Not set", sub: p.next ? `${(p.daysToRenew ?? 0) >= 0 ? plural(p.daysToRenew ?? 0, "day") : `Began ${plural(-(p.daysToRenew ?? 0), "day")} ago`} · ${p.next.label}` : "No later term is set up yet", tone: p.daysToRenew !== null && p.daysToRenew < 30 ? "attention" : "neutral" },
    { label: "Account state", value: p.account.state, sub: p.account.outstandingCount ? `${plural(p.account.outstandingCount, "invoice")} unpaid` : p.account.lastSettled ? `Settled ${dayLong(p.account.lastSettled)}` : "Nothing invoiced yet", tone: accountTone(p.account.state) },
    { label: "Outstanding", value: naira(p.account.outstanding), sub: p.account.outstanding ? "Across unpaid invoices, with VAT" : "Settled", tone: p.account.outstanding ? "attention" : "positive", link: payNow ? "Pay it" : undefined, drawer: payNow },
  ];

  const running: TableRow[] = p.running.map((item) => ({
    cells: [
      text(item.name, { strong: true }),
      text(item.basis),
      item.units === null ? text("—") : text(item.units.toLocaleString("en-NG"), { mono: true }),
      item.rate === null ? text("—") : text(item.rate >= 100 ? naira(item.rate) : `₦${item.rate.toFixed(2)}`, { mono: true }),
      item.thisTerm === null ? text(item.name.includes("credits") ? "From the wallet" : "Included") : text(naira(item.thisTerm), { mono: true, strong: true }),
      text(item.renews ? dayLabel(item.renews) : item.name.includes("credits") ? "On top-up" : item.name.includes("portal") ? "With the plan" : "—"),
      pill(item.state, STATE_TONE[item.state] ?? "neutral"),
      item.action === "Switch" ? { kind: "action" as const, label: "Switch", drawer: switchDrawer(p) } : item.action === "Top up SMS" ? { kind: "action" as const, label: "Top up", drawer: topUpDrawer(credits, "SMS") } : item.action === "Top up WhatsApp" ? { kind: "action" as const, label: "Top up", drawer: topUpDrawer(credits, "WhatsApp") } : text("—"),
    ],
  }));

  const invoiceRows: TableRow[] = p.invoices.map((invoice: InvoiceRow) => ({
    drawer: invoiceDocDrawer(invoice.id, invoice.no),
    keywords: `${invoice.no} ${invoice.period} kind:${invoice.kindLabel} state:${invoice.state}`,
    cells: [text(invoice.no, { strong: true, mono: true }), text(invoice.period), text(naira(invoice.total), { mono: true, strong: true }), text(dayLabel(invoice.issued)), pill(invoice.state, STATE_TONE[invoice.state]), invoice.state === "Paid" ? { kind: "action" as const, label: "View invoice", drawer: invoiceDocDrawer(invoice.id, invoice.no) } : { kind: "action" as const, label: "Pay", drawer: payOneDrawer(invoice, p) }],
  }));

  const yes = (ok: boolean) => ({ kind: "mark" as const, ok });
  const comparison: TableRow[] = [
    { cells: [text("Per student, per term", { strong: true }), ...p.comparison.tiers.map((tier) => text(naira(tier.rate), { mono: true }))] },
    { cells: [text(`At ${p.comparison.roll.toLocaleString("en-NG")} students, a term`, { strong: true }), ...p.comparison.tiers.map((tier) => text(naira(tier.term), { mono: true }))] },
    { cells: [text("Across three terms", { strong: true }), ...p.comparison.tiers.map((tier) => text(naira(tier.session), { mono: true }))] },
    ...p.comparison.capabilities.map((capability) => ({ cells: [text(capability.label), yes(capability.standard), yes(capability.premium), yes(capability.elite)] })),
  ];

  return {
    title: "Plan",
    desc: "What Future Realm costs at your current roll, and how to change it.",
    primary: { label: p.next ? `Renew for ${p.next.label.split(" ").slice(0, 2).join(" ")}` : "Renew for next term", icon: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3", drawer: renew },
    launchers: [
      { label: "Switch plan", drawer: switchDrawer(p) },
      ...(payNow ? [{ label: "Pay by card", drawer: payNow }] : []),
      ...(latest ? [{ label: "Download an invoice", drawer: invoiceDrawer(latest) }] : []),
    ],
    rows: [
      ...(trial ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: "This account is on a trial", body: p.school.trialEndsAt ? `The trial ends on ${dayLong(p.school.trialEndsAt)}. Renew before then so nothing is interrupted.` : "Renew to move the school onto a paid plan.", acts: [{ label: "Renew now", drawer: renew }] }] }] : []),
      ...(p.pending ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "progress" as PanelTone, title: `A switch to ${p.pending.tier} is scheduled`, body: `It takes effect from ${dayLong(p.pending.from)}${p.pending.reason ? ` — you gave “${p.pending.reason.toLowerCase()}” as the reason` : ""}. Nothing changes for the rest of this term.`, acts: [{ label: "Change it", drawer: switchDrawer(p) }, { label: "Withdraw it", drawer: cancelSwitchDrawer(p) }] }] }] : []),
      ...(open.some((invoice) => invoice.state === "Overdue") ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: "An invoice is overdue", body: `${plural(open.filter((invoice) => invoice.state === "Overdue").length, "invoice")} past its due date. Pay it to keep the account current.`, acts: payNow ? [{ label: "Pay by card", drawer: payNow }] : [] }] }] : []),
      { cols: "1fr", panels: [{ type: "kpi", title: p.term?.label ?? "This term", per: 6, cards }] },
      { cols: "1fr", panels: [{ type: "table", title: "What is running on this account", tag: `${p.running.filter((item) => item.state === "Active").length} active`, tagTone: "positive", sub: "Everything currently billed to this school, and when each of them renews.", meta: `${p.tierName} · per student per term${p.next ? ` · next renewal ${dayLong(p.next.start)}` : ""}`, acts: [{ label: "Switch plan", drawer: switchDrawer(p) }, { label: p.next ? `Renew for ${p.next.label.split(" ").slice(0, 2).join(" ")}` : "Renew for next term", primary: true, drawer: renew }], head: ["What is running", "Basis", "Units", "Rate", "This term", "Renews", "State", ""], noun: "item", nounPlural: "items", noRowOpen: true, rows: running, foot: "A plan is billed per student per term, counted at term start. A child who joins mid-term is billed at the next renewal, never retrospectively." }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "tierChange" as const,
            title: "Change plan",
            sub: "Moving up takes effect at once and is charged only for the rest of this term. Moving down waits for next term, because this one is paid for.",
            currentTier: { key: p.tier, name: p.tierName, rate: p.rate },
            tiers: p.comparison.tiers.map((tier) => ({ key: tier.key, name: tier.name, rate: tier.rate })),
            previewEndpoint: `${SB}/plan/midterm/preview`,
            changeEndpoint: `${SB}/plan/midterm/change`,
            cancelEndpoint: `${SB}/plan/midterm/cancel-downgrade`,
            pending: p.pending ? { tier: p.pending.tier, from: p.pending.from } : null,
          },
        ],
      },
      { cols: "1fr", panels: [{ type: "facts", title: "Value this session", tag: "Presented without spin", tagTone: "neutral", sub: "What the school actually got for what it pays each term, read off the work done.", meta: "This session · to date", per: 5, facts: p.value }] },
      {
        cols: "1.05fr 1fr",
        panels: [
          { type: "table", title: "Invoices from Future Realm", sub: "Every invoice, with VAT. Open one to print it or save it as a PDF.", meta: `${plural(p.invoices.length, "invoice")} · ${naira(p.invoices.filter((invoice) => invoice.state === "Paid").reduce((sum, invoice) => sum + invoice.total, 0))} paid`, filters: [{ label: "Kind", value: "All", options: ["All", "Termly plan", "Credit top-up", "One-off"], match: { "Termly plan": "kind:Termly plan", "Credit top-up": "kind:Credit top-up", "One-off": "kind:One-off" } }, { label: "State", value: "All", options: ["All", "Paid", "Outstanding", "Overdue"], column: 4 }], head: ["Invoice", "Period", "Amount", "Issued", "State", "Get"], noun: "invoice", nounPlural: "invoices", per: 8, rows: invoiceRows, emptyTitle: "Nothing has been invoiced", emptyBody: "Renew for next term and the invoice appears here." },
          { type: "table", title: "Plan comparison", sub: `At ${p.comparison.roll.toLocaleString("en-NG")} students, per term. Switching takes effect next term.`, meta: `Per student, per term · you are on ${p.tierName}`, acts: [{ label: "Switch plan", primary: true, drawer: switchDrawer(p) }], head: ["Capability", "Standard", "Premium", "Elite"], noun: "capability", nounPlural: "capabilities", noRowOpen: true, rows: comparison },
        ],
      },
    ],
  };
}
