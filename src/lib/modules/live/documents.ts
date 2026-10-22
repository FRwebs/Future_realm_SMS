import { naira } from "@/lib/modules/live/m10-forms";
import type { InvoiceDoc } from "@/lib/modules/live/m11-types";
import type { ReceiptDoc, StructureDetail } from "@/lib/modules/live/m10-types";
import type { CardView } from "@/lib/modules/live/m6-types";
import type { DocumentSpec, DrawerSpec, PanelTone } from "@/lib/modules/panels";

/**
 * The documents the school hands over — a report card, a receipt, a fee schedule, an invoice — as data.
 *
 * The mockup opens each in a modal over the page it was opened from, and prints the same paper. These
 * builders make that paper once; the modal and the print page both draw it, so they cannot differ.
 */

export type DocumentKind = "card" | "receipt" | "structure" | "invoice";

/** Where a document's spec is read from when its modal opens. */
export const documentUrl = (kind: DocumentKind, id: string, query: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return `/documents/${kind}/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ""}`;
};

/** A trigger that opens a document in its modal. */
export const documentDrawer = (kind: DocumentKind, id: string, o: { title: string; kicker?: string; query?: Record<string, string | undefined> }): DrawerSpec => ({
  mode: "document",
  kicker: o.kicker,
  title: o.title,
  load: documentUrl(kind, id, o.query),
});

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

/* ───────────────────────── the report card ───────────────────────── */

const CARD_STATE: Record<CardView["state"], PanelTone> = { Published: "positive", Revised: "attention", Withheld: "withheld", Draft: "neutral" };

/** The card as a family holds it. An unpublished card is stamped so it can never be handed out by mistake. */
export function cardPaper(view: CardView): DocumentSpec {
  const card = view.card;
  const components = card.subjects[0]?.components ?? [];
  const scored = card.subjects.filter((subject) => subject.total !== null);
  return {
    heading: "Report card preview",
    state: { label: view.state, tone: CARD_STATE[view.state] },
    meta: `${card.studentName} · ${card.arm} · ${card.term} ${card.session}`,
    letterhead: { name: view.school.name, place: view.school.place, contact: view.school.contact },
    kicker: "TERMINAL REPORT",
    title: `${card.term} · ${card.session}`,
    ref: `Card ref ${view.reference}${view.revision > 1 ? ` · revision ${view.revision}` : ""}`,
    stamp: view.state === "Draft" ? { text: "DRAFT", tone: "attention" } : view.state === "Withheld" ? { text: "WITHHELD", tone: "withheld" } : undefined,
    idents: [
      ["Student", card.studentName],
      ["Admission no", card.admissionNumber],
      ["Class / arm", card.arm],
      ["Form master", card.formMaster ?? "Not named"],
      ["Date of birth", card.dob ? day(card.dob) : "—"],
      ["Gender", card.gender],
      ["Days present", card.attendance.days ? `${card.attendance.present} of ${card.attendance.days}` : "Not marked"],
      ["Attendance", card.attendance.pct === null ? "Not marked" : `${card.attendance.pct}%`],
    ],
    tables: [
      {
        heads: [
          { label: "Subject", align: "left" },
          ...components.map((component) => ({ label: `${component.short || component.name} /${component.max}`, align: "center" as const })),
          { label: "Total", align: "center" },
          { label: "Grade", align: "center" },
          { label: "Pos", align: "center" },
          { label: "Class avg", align: "center" },
          { label: "Remark", align: "left" },
          ...(card.subjects.some((subject) => subject.comment) ? [{ label: "Teacher’s comment", align: "left" as const }] : []),
        ],
        rows: card.subjects.map((subject) => [
          subject.subject,
          ...components.map((component) => {
            const hit = subject.components.find((entry) => entry.name === component.name);
            return hit ? String(hit.score === null ? "—" : hit.score === "ABS" ? "ABS" : hit.score) : "—";
          }),
          { text: subject.total === null ? "—" : String(subject.total), bold: true },
          { text: subject.grade ?? "—", bold: true, tone: subject.total === null ? "negative" : subject.total >= 50 ? "positive" : "negative" },
          subject.pos ? `${subject.pos}/${subject.outOf}` : "—",
          subject.classAvg === null ? "—" : String(subject.classAvg),
          { text: subject.total === null ? "Awaiting the score sheet" : subject.remark || "—" },
          ...(card.subjects.some((entry) => entry.comment) ? [subject.comment ?? "—"] : []),
        ]),
      },
    ],
    totals: [
      { label: "Subjects", value: `${scored.length} of ${card.subjects.length}`, sub: `${card.passed} at pass mark or above` },
      { label: "Total scored", value: String(card.total), sub: `Out of ${scored.length * 100}` },
      { label: "Average", value: card.average === null ? "—" : String(card.average), sub: card.gradeRemark ?? undefined, tone: "positive" },
      { label: "Position", value: card.position ? String(card.position) : "—", sub: `In a class of ${card.outOf}` },
      { label: "Grade", value: card.grade ?? "—", sub: card.gradeRemark ?? undefined },
    ],
    groups: card.traits.map((group) => ({ title: group.title, items: group.items.map((item): [string, string] => [item.label, item.value]) })),
    blocks: [
      { label: "Form master’s remark", body: card.classTeacherRemark || "Not yet written.", by: card.classTeacherBy ? `${card.classTeacherBy} · Form master` : undefined },
      { label: "Principal’s remark", body: card.principalRemark || "Not yet written.", by: card.principalBy ? `${card.principalBy} · Principal` : undefined },
    ],
    footNote: `${card.resumption ? `Next term begins ${day(card.resumption)}. ` : "The date the next term begins has not been set. "}${card.frameworkNote} ${card.traits.length ? "" : "No character record was entered for this term. "}This card is invalid without the school stamp. A dash is a component nobody entered; ABS is an absence — excluded, never scored zero.`,
    footRef: `${view.published ? `Issued ${day(view.published)}` : "Issued on publication"}\n${view.school.name}`,
  };
}

/* ───────────────────────── a receipt ───────────────────────── */

/** A reprint is stamped DUPLICATE on the paper itself — the original stays the only payment recorded. */
export function receiptPaper(receipt: ReceiptDoc, duplicate: boolean): DocumentSpec {
  return {
    heading: "Receipt preview",
    state: duplicate ? { label: "Duplicate", tone: "attention" } : { label: "Receipt issued", tone: "positive" },
    meta: `${receipt.ref} · ${receipt.student} · ${naira(receipt.paid)}`,
    letterhead: { name: receipt.school.name, place: receipt.school.address, contact: [receipt.school.phone, receipt.school.email].filter(Boolean).join(" · ") },
    kicker: duplicate ? "DUPLICATE RECEIPT" : "OFFICIAL RECEIPT",
    title: `Receipt ${receipt.ref}`,
    ref: `${day(receipt.date)}${receipt.term ? ` · ${receipt.term}` : ""}`,
    stamp: duplicate ? { text: "DUPLICATE", tone: "negative" } : undefined,
    idents: [
      ["Received from", receipt.payer],
      ["On behalf of", receipt.student],
      ["Admission number", receipt.adm],
      ["Class / arm", receipt.arm],
      ["Payment mode", receipt.mode],
      ["Reference", receipt.bankRef || "—"],
      ["Date received", day(receipt.date)],
      ["Received by", `${receipt.by} · Bursary`],
    ],
    tables: [
      {
        heads: [{ label: "Fee item", align: "left" }, { label: "Billed" }, { label: "Previously paid" }, { label: "This payment" }, { label: "Balance" }],
        rows: receipt.items.map((item) => [item.label, { text: naira(item.billed), mono: true }, { text: naira(item.previously), mono: true }, { text: naira(item.applied), mono: true, bold: true, tone: "positive" as const }, { text: naira(item.balance), mono: true, tone: item.balance > 0 ? ("attention" as const) : ("positive" as const) }]),
      },
    ],
    totals: [
      { label: "Billed this term", value: naira(receipt.billed), sub: receipt.invoice ?? `${receipt.items.length} fee items` },
      { label: "This payment", value: naira(receipt.paid), sub: receipt.mode, tone: "positive" },
      { label: "Paid to date", value: naira(receipt.paidToDate), sub: "Including this payment" },
      { label: "Still outstanding", value: naira(receipt.balance), sub: receipt.balance ? receipt.ageing : "Settled in full", tone: receipt.balance ? "attention" : "positive" },
    ],
    blocks: [
      {
        label: "Note",
        by: `Issued by ${receipt.by} · ${day(receipt.date)}`,
        body: receipt.balance ? `Thank you. A balance of ${naira(receipt.balance)} remains on this account${receipt.term ? ` for ${receipt.term}` : ""}. Payment may be made by transfer, card, POS or at the bursary.` : `Thank you. This account is settled in full${receipt.term ? ` for ${receipt.term}` : ""}.`,
      },
    ],
    footNote: duplicate ? "DUPLICATE — this is a reprint of a receipt already issued. The original remains the only payment recorded." : "A receipt is a record of money received. It is never edited — a mistake is corrected by a named reversal. Keep it until the end of the session.",
    footRef: `Receipt ${receipt.ref}\n${receipt.school.name}`,
    note: receipt.balance ? `${naira(receipt.balance)} still outstanding on this account.` : "This account is settled in full.",
    acts: [{ label: "Open the family", href: "/parents-guardians/guardians" }, { label: "Print", print: true, primary: true }],
  };
}

/* ───────────────────────── a fee schedule ───────────────────────── */

/** A fee structure as a family would read it: the classes, and every line with its price. */
export function structurePaper(structure: StructureDetail, school: { name: string; place?: string; contact?: string }): DocumentSpec {
  const groups = ["Termly", "Sessional", "Once"].map((freq) => ({ freq, items: structure.items.filter((item) => item.freq === freq) })).filter((group) => group.items.length);
  return {
    heading: "Fee schedule preview",
    state: { label: structure.state, tone: structure.state === "Published" ? "positive" : structure.state === "Draft" ? "attention" : "neutral" },
    meta: `${structure.name} · ${structure.ref}`,
    letterhead: school,
    kicker: "FEE SCHEDULE",
    title: structure.name,
    ref: `${structure.ref}${structure.termLabel ? ` · ${structure.termLabel}` : ""}`,
    stamp: structure.state === "Draft" ? { text: "DRAFT", tone: "attention" } : undefined,
    idents: [
      ["Structure", structure.name],
      ["Reference", structure.ref],
      ["For", structure.classes.join(", ") || "Classes to be confirmed"],
      ["Term", structure.termLabel ?? "—"],
    ],
    tables: groups.map((group) => ({
      title: group.freq,
      heads: [{ label: group.freq === "Termly" ? "Charged each term" : group.freq === "Sessional" ? "Charged once a session" : "Charged once", align: "left" as const }, { label: "Type", align: "left" as const }, { label: "Amount" }],
      rows: group.items.map((item) => [item.name, { text: item.type, tone: "neutral" as const }, { text: naira(item.amount), mono: true, bold: true }]),
    })),
    totals: [
      { label: "Compulsory each term", value: naira(structure.termly), sub: "Mandatory items only", tone: "positive" },
      { label: "Every item, each term", value: naira(structure.termlyAll), sub: "If every optional item is taken" },
      { label: "Charged once a session", value: naira(structure.sessional), sub: "Sessional items" },
      { label: "Classes", value: String(structure.classes.length), sub: structure.classes.slice(0, 3).join(", ") },
    ],
    blocks: structure.rules.length ? [{ label: "What is deducted from this", body: structure.rules.map((rule) => `${rule.name} (${rule.appliesTo})`).join(". ") + ".", by: "Applied automatically at invoice time" }] : undefined,
    footNote: "An optional item is billed only to the families who elect it. Discounts and concessions appear as their own line on the invoice.",
    footRef: `${structure.ref}\n${school.name}`,
    note: structure.state === "Published" ? "Published — invoices have been generated on it." : "Draft — nobody has been billed on it yet.",
    acts: [{ label: "Back to the structure", href: `/fee-management/structures/${structure.id}` }, { label: "Print", print: true, primary: true }],
  };
}

/* ───────────────────────── an invoice ───────────────────────── */

/** An invoice: who issued it, who it is for, what each line is, the VAT, and every payment against it. */
export function invoicePaper(invoice: InvoiceDoc): DocumentSpec {
  const paid = invoice.state === "Paid";
  const tone: PanelTone = paid ? "positive" : invoice.state === "Overdue" ? "negative" : "attention";
  return {
    heading: "Invoice preview",
    state: { label: invoice.state, tone },
    meta: `${invoice.no} · ${naira(invoice.total)}`,
    letterhead: { name: "Future Realm", place: "School management platform" },
    kicker: `${invoice.kind} INVOICE`,
    title: invoice.no,
    ref: `Issued ${day(invoice.issued)}`,
    stamp: { text: paid ? "PAID" : invoice.state === "Overdue" ? "OVERDUE" : "UNPAID", tone },
    idents: [
      ["Billed to", invoice.billTo.name],
      ["Attention", invoice.billTo.attention || "—"],
      ["Address", invoice.billTo.address || "—"],
      ["Email", invoice.billTo.email || "—"],
      ["Issued", day(invoice.issued)],
      ["Due", day(invoice.due)],
      ["State", invoice.state],
      ["Paid on", day(invoice.paidAt)],
    ],
    tables: [{ heads: [{ label: "Description", align: "left" }, { label: "Quantity" }, { label: "Rate" }, { label: "Amount" }], rows: invoice.lines.map((line) => [line.description, line.qty, { text: line.rate, mono: true }, { text: naira(line.amount), mono: true }]) }],
    summary: [{ label: "Subtotal", value: naira(invoice.subtotal) }, { label: "VAT", value: naira(invoice.tax) }, { label: "Total", value: naira(invoice.total), strong: true }],
    list: {
      title: "Payments against this invoice",
      empty: `No payment has been made against it yet. Pay by card from the Plan tab, or by bank transfer quoting ${invoice.no}.`,
      items: invoice.payments.map((payment) => ({ left: `${day(payment.at)} · ${payment.method} · ${payment.reference} · ${payment.status}`, right: naira(payment.amount) })),
    },
    footNote: "An invoice is never edited; a correction is a new invoice.",
    footRef: invoice.no,
    note: paid ? "Paid in full." : `${naira(invoice.total - invoice.paid)} to pay${invoice.due ? `, due ${day(invoice.due)}` : ""}.`,
    acts: [...(paid ? [] : [{ label: "Pay from the Plan tab", href: "/subscription-billing/plan" }]), { label: "Print", print: true, primary: true }],
  };
}

/* ───────────────────────── the triggers ───────────────────────── */

export const receiptDrawer = (id: string, ref: string, duplicate = false): DrawerSpec => documentDrawer("receipt", id, { title: `Receipt ${ref}`, kicker: "Payments", query: { duplicate: duplicate ? "1" : undefined } });
export const structureDrawer = (id: string, name: string): DrawerSpec => documentDrawer("structure", id, { title: `${name} · fee schedule`, kicker: "Fee structures" });
export const invoiceDocDrawer = (id: string, no: string): DrawerSpec => documentDrawer("invoice", id, { title: `Invoice ${no}`, kicker: "Subscription & Billing" });
