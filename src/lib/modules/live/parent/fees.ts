import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DocumentSpec, DrawerSpec, FormField, ListItem, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { PW, dLong, dShort, loadMe, money } from "@/lib/modules/live/parent/shared";
import type { ParentContent, ParentMe } from "@/lib/modules/live/parent/shared";

type FeeChild = {
  id: string; name: string; first: string; arm: string; invoiceNo: string; invoiceId: string | null; payInvoiceId: string | null; payAmount: number; term: string;
  billed: number; paid: number; balance: number; outstanding: number; fromEarlier: number; oldestDue: string | null;
  status: string; tone: PanelTone;
};
type FeeInvoice = {
  id: string; childId: string; child: string; number: string; term: string; termId: string | null; current: boolean;
  issued: string; due: string; total: number; discount: number; fine: number; balance: number; status: string;
  lines: Array<{ description: string; amount: number; quantity: number; waived: boolean }>;
};
type FeePayment = {
  id: string; childId: string; child: string; invoiceId: string; invoice: string; term: string; termId: string | null; reference: string; bankRef: string; receipt: string | null;
  amount: number; method: string; channel: string; status: string; by: string; paidAt: string | null;
};
type FeePlan = {
  id: string; childId: string; child: string; number: string; total: number; balance: number; status: string;
  items: Array<{ id: string; due: string; amount: number; paid: number; status: string }>;
};
type FeeReport = { id: string; childId: string | null; amount: number; method: string; date: string; reference: string; owner: string | null; sent: string };
type Fees = { children: FeeChild[]; invoices: FeeInvoice[]; payments: FeePayment[]; plans: FeePlan[]; reports: FeeReport[] };

const TABS = ["This term", "Payments and receipts", "Earlier terms"];
const METHOD: Record<string, string> = { CASH: "Cash", TRANSFER: "Bank transfer", BANK_TRANSFER: "Bank transfer", POS: "POS", ONLINE: "Online", USSD: "USSD", CHEQUE: "Cheque", SCHOLARSHIP: "Scholarship", WAIVER: "Waiver" };
const word = (method: string) => METHOD[method] ?? method;
const today = () => new Date().toISOString().slice(0, 10);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the family owes, and the proof of what they have paid.
 *
 * The whole-family view exists because a parent with two children is billed twice and wants one answer to "how much do I owe". Opening a
 * child gives the invoice behind the figure, every receipt, the payment plan if the school approved one, and the three ways to pay —
 * which is what a parent reaches for when a payment seems to have gone missing.
 */
export async function feesPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data] = await Promise.all([loadMe(), apiGet(`${PW}/fees?child=${encodeURIComponent(child)}`, observe<Fees>(localContracts["src/lib/modules/live/parent/fees.ts#a95ca495"]))]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childFees(one, data, query, me) : familyFees(data, me);
}

/* ───────────────────────── what a family can do ───────────────────────── */

type Kid = { id: string; first: string };
/** A question for the bursar, or a request for a plan: a request to the bursary like any other, with an owner and a clock. */
function askTheBursar(kids: Kid[], chosen: Kid | null, kind: "question" | "plan" = "question"): DrawerSpec {
  const fields: FormField[] = [
    ...(chosen || kids.length < 2 ? [] : [{ kind: "select", label: "Which child?", required: true, value: kids[0]!.first, options: kids.map((kid) => kid.first) } as FormField]),
    { kind: "area", label: kind === "plan" ? "Tell the bursar what would work" : "What do you need to ask?", required: true, value: kind === "plan" ? "I would like to pay this bill in instalments. " : "", placeholder: kind === "plan" ? "For example: half now and half at the end of the month" : "A question about an invoice, a payment, or a plan" },
  ];
  const label = kind === "plan" ? "Tell the bursar what would work" : "What do you need to ask?";
  const target = chosen ?? (kids.length === 1 ? kids[0]! : null);
  return {
    kicker: "Fees", title: kind === "plan" ? "Ask for a payment plan" : "Ask the bursar", mode: "form",
    sub: "It goes to the school’s bursary as a request you can follow under Requests. The school decides, and answers in writing.",
    fields, confirmTitle: "Send this to the bursary?", commitLabel: "Send to the bursary", commitDone: "Sent to the bursary", commitDoneBody: "You can follow it under Requests.",
    submit: {
      endpoint: "/api/v1/parent-portal/submissions", method: "POST",
      map: { [label]: "detail", ...(target ? {} : { "Which child?": "child" }) }, body: { type: "Fee query", ...(target ? { child: target.id } : {}) },
      ...(target ? {} : { encode: { "Which child?": Object.fromEntries(kids.map((kid) => [kid.first, kid.id])) } }),
    },
  };
}

/** Pay now, by card, bank or USSD, through the school's payment gateway; the family is taken to its page to finish. */
function payOnline(entry: FeeChild): DrawerSpec | null {
  if (!entry.payInvoiceId || entry.payAmount <= 0) return null;
  return {
    kicker: "Fees", title: `Pay ${money(entry.payAmount)} for ${entry.first}`, mode: "form",
    sub: "You are taken to the payment page to finish. The balance and the receipt update the moment the school’s payment provider confirms it.",
    fields: [
      { kind: "text", label: "Amount to pay (₦)", required: true, value: String(entry.payAmount), hint: "The whole balance, or part of it." },
      { kind: "select", label: "How will you pay?", required: true, value: "Card", options: ["Card", "Bank transfer", "USSD"] },
    ],
    confirmTitle: "Go to the payment page?", commitLabel: "Continue to payment", commitDone: "Ready to pay", commitDoneBody: "Open the payment page to finish. Nothing is paid until you do.",
    submit: {
      endpoint: "/api/v1/finance/payments", method: "POST",
      map: { "Amount to pay (₦)": "amount", "How will you pay?": "paymentChannel" },
      encode: { "How will you pay?": { Card: "card", "Bank transfer": "bank_transfer", USSD: "ussd" } },
      body: { invoiceId: entry.payInvoiceId, method: "ONLINE", provider: "PAYSTACK" },
    },
  };
}

/** Paid by bank transfer or at the bursary counter: tell the bursar here, so it can be matched and receipted. */
function reportPaid(kids: FeeChild[], chosen: FeeChild | null): DrawerSpec {
  const target = chosen ?? (kids.length === 1 ? kids[0]! : null);
  const fields: FormField[] = [
    ...(target ? [] : [{ kind: "select", label: "Which child?", required: true, value: kids[0]?.first ?? "", options: kids.map((kid) => kid.first) } as FormField]),
    { kind: "text", label: "Amount you paid (₦)", required: true, value: target?.payAmount ? String(target.payAmount) : "" },
    { kind: "choice", label: "How did you pay?", required: true, value: "Bank transfer", options: ["Bank transfer", "At the bursary"] },
    { kind: "text", type: "date", label: "Day you paid", required: true, value: today() },
    { kind: "text", label: "Bank reference", optional: true, value: "", placeholder: "From your transfer receipt or bank app", hint: "It helps the bursar find it on the statement." },
    { kind: "area", label: "Anything the bursar should know?", optional: true, value: "" },
  ];
  return {
    kicker: "Fees", title: "Tell the bursar you have paid", mode: "form",
    sub: "The bursar matches it to the bank statement and issues the receipt, usually within two school days. Until then it shows here as reported — your balance does not change.",
    fields, confirmTitle: "Send this to the bursary?", commitLabel: "Send to the bursary", commitDone: "Sent to the bursary", commitDoneBody: "It shows as reported until the bursar has matched it. You can follow it under Requests.",
    submit: {
      endpoint: `${PW}/fees/report`, method: "POST",
      map: { "Amount you paid (₦)": "amount", "How did you pay?": "method", "Day you paid": "date", "Bank reference": "reference", "Anything the bursar should know?": "note", ...(target ? {} : { "Which child?": "child" }) },
      body: target ? { child: target.id } : {},
      ...(target ? {} : { encode: { "Which child?": Object.fromEntries(kids.map((kid) => [kid.first, kid.id])) } }),
    },
  };
}

/**
 * What one child still owes, and the two ways out of it, for a page that is not Fees.
 *
 * A report card held over an unpaid balance is the case this exists for: the
 * page that tells a parent their child's card is held is the page where they
 * will want to clear it, and sending them to Fees to find the same bill is a
 * step that teaches them nothing. It is read straight from the fee position, so
 * the figure is the school's, never this page's guess. A school that does not
 * show fees to parents gets nothing back rather than an error.
 */
export async function payableFor(childId: string): Promise<{ amount: number; pay: DrawerSpec | null; plan: DrawerSpec } | null> {
  const data = await apiGet(`${PW}/fees?child=${encodeURIComponent(childId)}`, observe<Fees>(localContracts["src/lib/modules/live/parent/fees.ts#a95ca495"])).catch(() => null);
  const entry = data?.children.find((child) => child.id === childId);
  if (!entry || entry.outstanding <= 0) return null;
  return { amount: entry.outstanding, pay: payOnline(entry), plan: askTheBursar([{ id: entry.id, first: entry.first }], { id: entry.id, first: entry.first }, "plan") };
}

/* ───────────────────────── the paper ───────────────────────── */

const letterhead = (me: ParentMe) => ({ name: me.office.name || me.school, place: me.office.where ?? undefined, contact: [me.office.phone, me.office.website].filter(Boolean).join(" · ") || undefined });

function invoicePaper(invoice: FeeInvoice, entry: FeeChild, paid: FeePayment[], me: ParentMe): DrawerSpec {
  const settled = invoice.balance <= 0;
  const doc: DocumentSpec = {
    heading: "Invoice preview", state: settled ? { label: "Settled", tone: "positive" } : { label: "Balance owed", tone: invoice.due < today() ? "negative" : "attention" },
    meta: `${invoice.number} · ${entry.name} · ${money(invoice.total)}`, letterhead: letterhead(me),
    kicker: "INVOICE", title: `Invoice ${invoice.number}`, ref: invoice.term || `Issued ${dLong(invoice.issued)}`,
    stamp: settled ? { text: "PAID", tone: "positive" } : undefined,
    idents: [["Billed to", me.name], ["For", entry.name], ["Class", entry.arm], ["Term", invoice.term || "Not tied to a term"], ["Issued", dLong(invoice.issued)], ["Due", dLong(invoice.due)]],
    tables: [{
      heads: [{ label: "Item", align: "left" }, { label: "Qty", align: "center" }, { label: "Amount", align: "right" }],
      rows: invoice.lines.map((line) => [line.description + (line.waived ? " (waived)" : ""), { text: String(line.quantity) }, { text: money(line.amount * line.quantity), mono: true, tone: line.waived ? "positive" : undefined }]),
    }],
    summary: [
      ...(invoice.discount ? [{ label: "Discount", value: `−${money(invoice.discount)}` }] : []),
      ...(invoice.fine ? [{ label: "Late fee", value: money(invoice.fine) }] : []),
      { label: "Total billed", value: money(invoice.total), strong: true },
      { label: "Paid to date", value: `−${money(invoice.total - invoice.balance)}` },
      { label: "Balance", value: money(invoice.balance), strong: true },
    ],
    list: { title: "Payments against this invoice", empty: "Nothing has been paid against it yet.", items: paid.map((payment) => ({ left: `${payment.receipt ?? payment.reference} · ${payment.paidAt ? dLong(payment.paidAt) : ""}`, right: money(payment.amount) })) },
    footNote: "An invoice is the school’s statement of what is owed. Discounts and late fees are lines of their own, never a quietly changed total.",
    footRef: `${invoice.number}\n${me.office.name || me.school}`,
    acts: [{ label: "Print", print: true, primary: true }],
  };
  return { mode: "document", kicker: invoice.term || "Invoice", title: `Invoice ${invoice.number}`, doc };
}

function receiptPaper(payment: FeePayment, invoice: FeeInvoice | undefined, entry: FeeChild, me: ParentMe): DrawerSpec {
  const ref = payment.receipt ?? payment.reference;
  const doc: DocumentSpec = {
    heading: "Receipt preview", state: { label: "Receipt issued", tone: "positive" }, meta: `${ref} · ${entry.name} · ${money(payment.amount)}`, letterhead: letterhead(me),
    kicker: "OFFICIAL RECEIPT", title: `Receipt ${ref}`, ref: `${payment.paidAt ? dLong(payment.paidAt) : ""}${payment.term ? ` · ${payment.term}` : ""}`,
    idents: [["Received from", me.name], ["On behalf of", entry.name], ["Class", entry.arm], ["Payment mode", word(payment.method)], ["Reference", payment.bankRef || payment.reference || "—"], ["Date received", payment.paidAt ? dLong(payment.paidAt) : "—"], ["Against", payment.invoice], ...(payment.by ? [["Recorded by", `${payment.by} · Bursary`] as [string, string]] : [])],
    totals: [
      { label: "This payment", value: money(payment.amount), sub: word(payment.method), tone: "positive" },
      ...(invoice ? [{ label: "Invoice total", value: money(invoice.total), sub: payment.invoice }, { label: "Still owed on it", value: money(invoice.balance), sub: invoice.balance > 0 ? "After every payment so far" : "Settled in full", tone: (invoice.balance > 0 ? "attention" : "positive") as PanelTone }] : []),
    ],
    footNote: "A receipt is a record of money received. It is never edited — a correction is a new entry.",
    footRef: `Receipt ${ref}\n${me.office.name || me.school}`,
    acts: [{ label: "Print", print: true, primary: true }],
  };
  return { mode: "document", kicker: "Receipt", title: `Receipt ${ref}`, doc };
}

function statementPaper(invoice: FeeInvoice, entry: FeeChild, paid: FeePayment[], me: ParentMe): DrawerSpec {
  const doc: DocumentSpec = {
    heading: "Statement preview", state: invoice.balance > 0 ? { label: "Balance owed", tone: "attention" } : { label: "Settled", tone: "positive" },
    meta: `${invoice.term || invoice.number} · ${entry.name}`, letterhead: letterhead(me), kicker: "STATEMENT OF ACCOUNT", title: `${invoice.term || invoice.number} · ${entry.name}`, ref: invoice.number,
    idents: [["For", entry.name], ["Class", entry.arm], ["Invoice", invoice.number], ["Issued", dLong(invoice.issued)], ["Due", dLong(invoice.due)]],
    tables: [{
      title: "Payments", heads: [{ label: "Receipt", align: "left" }, { label: "Date" }, { label: "Method" }, { label: "Amount", align: "right" }],
      rows: paid.map((payment) => [payment.receipt ?? payment.reference, payment.paidAt ? dShort(payment.paidAt) : "—", word(payment.method), { text: money(payment.amount), mono: true }]),
    }],
    summary: [{ label: "Billed", value: money(invoice.total) }, { label: "Paid", value: money(invoice.total - invoice.balance) }, { label: "Balance", value: money(invoice.balance), strong: true }],
    footNote: "Every payment the bursar recorded against this invoice, as the school holds it.",
    footRef: `${invoice.number}\n${me.office.name || me.school}`, acts: [{ label: "Print", print: true, primary: true }],
  };
  return { mode: "document", kicker: invoice.term || "Statement", title: `Statement · ${invoice.number}`, doc };
}

/* ───────────────────────── the whole family ───────────────────────── */

function familyFees(data: Fees, me: ParentMe): ParentContent {
  const kids = data.children.map((entry) => ({ id: entry.id, first: entry.first }));
  const owed = data.children.reduce((sum, entry) => sum + entry.outstanding, 0);
  const earlier = data.children.reduce((sum, entry) => sum + entry.fromEarlier, 0);
  const billed = data.children.reduce((sum, entry) => sum + entry.billed, 0);
  const paid = data.children.reduce((sum, entry) => sum + entry.paid, 0);
  const worst = data.children.find((entry) => entry.tone === "negative");
  const payable = data.children.filter((entry) => entry.payAmount > 0);
  const onlyPayable = payable.length === 1 ? payable[0]! : null;
  const reported = data.reports.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    eyebrow: "Whole family", title: "Fees and payments",
    desc: `What ${me.school} has billed, and what is still owed. It updates the moment the bursar records a payment.`,
    ...(onlyPayable && payOnline(onlyPayable) ? { primary: { label: `Pay ${money(onlyPayable.payAmount)}`, drawer: payOnline(onlyPayable)! } } : {}),
    launchers: [
      { label: "I have paid", drawer: reportPaid(payable.length ? payable : data.children, null) },
      { label: "Ask the bursar", drawer: askTheBursar(kids, null) },
    ],
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: 4,
        cards: [
          { label: "Owed now", value: owed > 0 ? money(owed) : "Nothing owed", sub: earlier > 0 ? `${money(earlier)} of it from an earlier bill` : worst ? `${worst.first}’s balance is overdue` : owed > 0 ? "Part paid" : "Every bill settled", tone: owed > 0 ? (worst ? "negative" : "attention") : "positive", icon: "wallet" },
          { label: "Billed this term", value: money(billed), sub: billed ? `for ${plural(data.children.length, "child", "children")}` : "Nothing billed yet", tone: "neutral" as PanelTone, icon: "receipt" },
          { label: "Paid this term", value: money(paid), sub: billed ? `${Math.round((paid / billed) * 100)}% of what was billed` : "Nothing to pay", tone: "positive" as PanelTone, icon: "check" },
          { label: "Receipts on record", value: String(data.payments.length), sub: reported ? `${money(reported)} reported, waiting for the bursar` : data.payments.length ? "Every payment the bursar has recorded" : "None yet", tone: reported ? "submitted" : ("neutral" as PanelTone), icon: "doc" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "This term, child by child", sub: "Open a child for the invoice, every receipt and earlier terms.",
        noun: "child", nounPlural: "children", head: ["Child", "Invoice", "Billed", "Paid", "Owed in all", "Status", ""], dense: true,
        rows: data.children.map((entry): TableRow => ({
          href: `/portals/parent/fees?child=${entry.id}`, keywords: `${entry.name} ${entry.invoiceNo}`,
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

/* ───────────────────────── one child ───────────────────────── */

function childFees(entry: FeeChild, data: Fees, query: Record<string, string | undefined>, me: ParentMe): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const kid = { id: entry.id, first: entry.first };
  const invoices = data.invoices.filter((invoice) => invoice.childId === entry.id);
  const current = invoices.filter((invoice) => invoice.current);
  const earlier = invoices.filter((invoice) => !invoice.current);
  const payments = data.payments.filter((payment) => payment.childId === entry.id);
  const paidOn = (invoice: FeeInvoice) => payments.filter((payment) => payment.invoiceId === invoice.id);
  const plan = data.plans.find((item) => item.childId === entry.id) ?? null;
  const reports = data.reports.filter((report) => report.childId === entry.id);
  const invoice = current[0] ?? null;
  const pay = payOnline(entry);
  const owedNow = entry.payAmount > 0;

  const head = {
    eyebrow: `${entry.name} · ${entry.arm}`, title: "Fees and payments",
    desc: "Billed in Nigerian naira (NGN). Updates the moment the bursar records a payment.",
    tabs: TABS.map((label) => ({ label })), tab,
    ...(pay ? { primary: { label: `Pay ${money(entry.payAmount)}`, drawer: pay } } : {}),
    launchers: [
      ...(invoice ? [{ label: "Download invoice", drawer: invoicePaper(invoice, entry, paidOn(invoice), me) }] : []),
      ...(owedNow ? [{ label: "I have paid", drawer: reportPaid([entry], entry) }] : []),
      { label: "Ask the bursar", drawer: askTheBursar([kid], kid) },
    ],
  };

  /* ───────── payments and receipts ───────── */
  if (tab === TABS[1]) {
    const methods = [...new Set(payments.map((payment) => word(payment.method)))];
    const termsOf = [...new Set(payments.map((payment) => payment.term || "No term"))];
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const reportedRows: TableRow[] = reports.map((report) => ({
      noRowOpen: true,
      cells: [nameCell("Reported by you", `Waiting for ${report.owner ?? "the bursar"}`, { avatar: false }), nameCell(entry.term || "—", entry.arm, { avatar: false }), text(dLong(report.date)), { kind: "text", text: money(report.amount), strong: true, mono: true }, text(report.method), text(report.reference || "—"), pill("Reported", "submitted")],
    } as TableRow));
    const paidRows = payments.map((payment): TableRow => {
      const paper = receiptPaper(payment, invoices.find((candidate) => candidate.id === payment.invoiceId), entry, me);
      return {
        drawer: paper, keywords: `${payment.reference} ${payment.receipt ?? ""} ${payment.bankRef} ${payment.amount} term:${payment.term || "No term"} method:${word(payment.method)}`,
        cells: [
          nameCell(payment.receipt ?? payment.reference, payment.by ? `Recorded by ${payment.by}` : `Against ${payment.invoice}`, { avatar: false }),
          nameCell(payment.term || payment.invoice, entry.arm, { avatar: false }),
          text(payment.paidAt ? dLong(payment.paidAt) : "—"), { kind: "text", text: money(payment.amount), strong: true, mono: true }, text(word(payment.method)),
          text(payment.bankRef || "—", { mono: Boolean(payment.bankRef) }), { kind: "action", label: "Receipt", drawer: paper },
        ],
      };
    });
    return {
      ...head,
      rows: [row("1fr", [{
        type: "table", title: "Every receipt", sub: `${plural(payments.length, "receipt", "receipts")}${payments.length ? ` · ${money(total)}` : ""}. Open one to view or print it.`,
        noun: "receipt", nounPlural: "receipts", dense: true, per: 10, search: "Receipt no., bank reference or amount",
        filters: [
          ...(termsOf.length > 1 ? [{ label: "Term", value: "All terms", options: ["All terms", ...termsOf], match: Object.fromEntries(termsOf.map((term) => [term, `term:${term}`])) }] : []),
          ...(methods.length > 1 ? [{ label: "Method", value: "All methods", options: ["All methods", ...methods], match: Object.fromEntries(methods.map((method) => [method, `method:${method}`])) }] : []),
        ],
        head: ["Receipt", "Term", "Date", "Amount", "Method", "Bank reference", ""], rows: [...reportedRows, ...paidRows],
        empty: "No receipt has been issued yet. If you have paid, tell the bursar with “I have paid”.",
        foot: "A receipt is issued when the bursar matches a payment. Each prints exactly as the school issued it.",
      }])],
    };
  }

  /* ───────── earlier terms ───────── */
  if (tab === TABS[2]) {
    if (!earlier.length) {
      return { ...head, rows: [row("1fr", [{ type: "note", tone: "neutral", title: `This is ${entry.first}’s first bill at ${me.school}`, body: "Earlier invoices and receipts appear here once a term closes." }])] };
    }
    const billedAll = earlier.reduce((sum, item) => sum + item.total, 0);
    const paidAll = earlier.reduce((sum, item) => sum + (item.total - item.balance), 0);
    const carried = earlier.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
    const receipts = earlier.reduce((sum, item) => sum + paidOn(item).length, 0);
    const summaryRows: TableCellKind[][] = [
      [text("Billed across them", { strong: true }), text(""), text(money(billedAll), { mono: true, strong: true }), text(""), text(""), text(""), text(""), text("")],
      [text("Paid", { strong: true }), text(""), text(""), text(money(paidAll), { mono: true, strong: true }), text(""), text(""), text(""), text("")],
      [text("Carried forward", { strong: true }), text(""), text(""), text(""), { kind: "text", text: money(carried), mono: true, strong: true, ...(carried ? { tone: "negative" as PanelTone } : {}) }, text(""), text(""), text("")],
    ];
    return {
      ...head,
      rows: [
        row("1fr", [{
          type: "kpi", bare: true, per: 4,
          cards: [
            { label: "Earlier bills", value: String(earlier.length), sub: `Since ${dShort(earlier[earlier.length - 1]!.issued)}`, tone: "neutral" as PanelTone, icon: "calendar" },
            { label: "Paid across them", value: money(paidAll), sub: `Of ${money(billedAll)} billed`, tone: "positive" as PanelTone, icon: "check" },
            { label: "Receipts issued", value: String(receipts), sub: "Open a statement to print them", tone: "neutral" as PanelTone, icon: "receipt" },
            { label: "Carried forward", value: carried ? money(carried) : "Nothing", sub: carried ? "Unpaid from earlier bills" : "Every earlier bill settled", tone: (carried ? "negative" : "positive") as PanelTone, icon: "wallet" },
          ],
        }]),
        row("1fr", [{
          type: "table", title: "Every earlier bill", sub: "Newest first. Open the statement for its payments and receipts, or the invoice as it was issued.",
          noun: "bill", nounPlural: "bills", dense: true,
          head: ["Term", "Invoice", "Billed", "Paid", "Balance", "Receipts", "Status", ""],
          rows: earlier.map((item): TableRow => {
            const statement = statementPaper(item, entry, paidOn(item), me);
            return {
              drawer: statement, keywords: `${item.number} ${item.term}`,
              cells: [
                nameCell(item.term || "Not tied to a term", `${entry.arm} · issued ${dShort(item.issued)}`, { avatar: false }), text(item.number, { mono: true }),
                text(money(item.total), { mono: true }), text(money(item.total - item.balance), { mono: true }),
                { kind: "text", text: money(item.balance), strong: true, mono: true, ...(item.balance > 0 ? { tone: "negative" as PanelTone } : {}) }, text(String(paidOn(item).length), { mono: true }),
                pill(item.balance > 0 ? "Balance owed" : "Settled", item.balance > 0 ? "negative" : "positive"),
                { kind: "action", label: "Statement", drawer: statement },
              ],
            };
          }),
          summaryRows, empty: "This is the first bill this child has had.",
          footActs: earlier.slice(0, 1).map((item) => ({ label: "Open the latest invoice", drawer: invoicePaper(item, entry, paidOn(item), me) })),
        }]),
      ],
    };
  }

  /* ───────── this term ───────── */
  const rows: ParentContent["rows"] = [];
  if (invoice) {
    const billed = current.reduce((sum, item) => sum + item.total, 0);
    const balance = current.reduce((sum, item) => sum + item.balance, 0);
    const paidTo = billed - balance;
    const overdue = balance > 0 && invoice.due < today();
    const receiptCount = current.reduce((sum, item) => sum + paidOn(item).length, 0);
    rows.push(row("1fr", [{
      type: "kpi", bare: true, per: 4,
      cards: [
        { label: "Billed this term", value: money(billed), sub: `${invoice.number} · issued ${dShort(invoice.issued)}`, tone: "neutral" as PanelTone, icon: "receipt" },
        { label: "Paid", value: money(paidTo), sub: `${plural(receiptCount, "receipt", "receipts")} · tap to view`, tone: "positive" as PanelTone, icon: "check", href: `/portals/parent/fees?child=${entry.id}&tab=Payments+and+receipts` },
        { label: "Balance", value: money(balance), sub: balance > 0 ? (overdue ? `Was due ${dLong(invoice.due)}` : plan ? "Under the payment plan" : `Due ${dLong(invoice.due)}`) : "Nothing owed", tone: (balance > 0 ? (overdue ? "negative" : "attention") : "positive") as PanelTone, icon: "wallet" },
        { label: "Status", value: balance <= 0 ? "Paid in full" : overdue ? "Overdue" : "Part paid", sub: entry.fromEarlier > 0 ? `${money(entry.fromEarlier)} more from earlier bills` : balance > 0 ? "Pay, report a payment, or ask for a plan" : "Nothing more to do", tone: (balance <= 0 ? "positive" : overdue ? "negative" : "attention") as PanelTone, icon: "listCheck" },
      ],
    }]));
    if (reports.length) {
      const latest = reports[0]!;
      rows.push(row("1fr", [{
        type: "note", tone: "submitted", title: `You reported a payment of ${money(latest.amount)} on ${dLong(latest.date)}`,
        body: `${latest.owner ?? "The bursar"} matches it to the bank statement, usually within two school days. Your balance and receipt update the moment it is recorded.`,
        acts: [{ label: "Open the request", href: "/portals/parent/requests" }],
      }]));
    }
    const lineRows: TableRow[] = [
      ...invoice.lines.map((line): TableRow => ({ noRowOpen: true, cells: [text(line.description + (line.quantity > 1 ? ` × ${line.quantity}` : ""), { strong: true }), text(line.waived ? "Waived" : "Fee"), { kind: "text", text: money(line.amount * line.quantity), strong: true, mono: true }] } as TableRow)),
      ...(invoice.discount ? [{ noRowOpen: true, cells: [text("Discount", { strong: true, tone: "positive" }), text("Discount"), { kind: "text", text: `−${money(invoice.discount)}`, strong: true, mono: true, tone: "positive" as PanelTone }] } as TableRow] : []),
      ...(invoice.fine ? [{ noRowOpen: true, cells: [text("Late fee", { strong: true }), text("Fine"), { kind: "text", text: money(invoice.fine), strong: true, mono: true }] } as TableRow] : []),
    ];
    const planItems: ListItem[] = plan ? plan.items.map((item, index) => {
      const done = item.status === "PAID";
      const late = !done && item.due < today();
      return { lead: { value: String(index + 1), tone: (done ? "positive" : late ? "negative" : "attention") as PanelTone }, label: `${dLong(item.due)} · ${money(item.amount)}`, sub: item.paid > 0 && !done ? `${money(item.paid)} paid so far` : done ? "Paid" : "Not paid yet", pill: done ? "Paid" : late ? "Overdue" : "Due", tone: (done ? "positive" : late ? "negative" : "attention") as PanelTone };
    }) : [];
    rows.push(row(plan ? "minmax(0,1.4fr) minmax(0,1fr)" : "1fr", [
      {
        type: "table", title: `Invoice ${invoice.number}`, sub: `${invoice.term || `Issued ${dLong(invoice.issued)}`} · every item, discount and payment as its own line.`,
        noun: "line", nounPlural: "lines", head: ["Item", "Type", "Amount"], dense: true, per: 0, noRowOpen: true, rows: lineRows,
        summaryRows: [
          [text("Total billed", { strong: true }), text(""), { kind: "text", text: money(billed), strong: true, mono: true }],
          [text("Paid to date", { strong: true }), text(""), { kind: "text", text: `−${money(paidTo)}`, strong: true, mono: true }],
          [text("Balance", { strong: true }), text(""), { kind: "text", text: money(balance), strong: true, mono: true, ...(balance > 0 && overdue ? { tone: "negative" as PanelTone } : {}) }],
        ],
        empty: "The school has not itemised this invoice.",
      },
      ...(plan ? [{ type: "list" as const, title: "Payment plan", sub: `${plan.number} · the school approved paying this bill in instalments.`, items: planItems, empty: "The plan has no instalments on it yet." }] : []),
    ]));
  } else {
    rows.push(row("1fr", [{
      type: "note", tone: (entry.outstanding > 0 ? "attention" : "neutral") as PanelTone,
      title: entry.outstanding > 0 ? `Nothing is billed this term, but ${money(entry.outstanding)} is still owed` : "Nothing is billed this term",
      body: entry.outstanding > 0
        ? `${me.school} has not issued an invoice for ${entry.first} this term. What is owed is from an earlier bill — open Earlier terms to see it, or ask the bursar.`
        : `${me.school} has not issued an invoice for ${entry.first} this term. Earlier bills are under the Earlier terms tab.`,
    }]));
  }

  if (owedNow && !reports.length) {
    rows.push(row("1fr", [{
      type: "note", tone: "neutral", title: "Three ways to pay",
      body: "Pay now by card, bank transfer or USSD. Or pay into the school’s account or at the bursary, then tell the bursar here so it can be matched and receipted. Or ask for a payment plan if the whole bill at once is difficult.",
      acts: [
        ...(pay ? [{ label: `Pay ${money(entry.payAmount)}`, primary: true, drawer: pay }] : []),
        { label: "I have paid", drawer: reportPaid([entry], entry) },
        ...(plan ? [] : [{ label: "Ask for a payment plan", drawer: askTheBursar([kid], kid, "plan") }]),
      ],
    }]));
  }
  return { ...head, rows };
}
