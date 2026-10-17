import { apiGet } from "@/lib/api/server";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { FEES, naira, nairaShort } from "@/lib/modules/live/m10-forms";
import type { History } from "@/lib/modules/live/m10-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * History: the ledger. Every term, every section, every receipt — and a statement a school can
 * hand a board, a bank or an auditor.
 */

export const loadHistory = () => apiGet<History>(`${FEES}/history`);

const STATEMENT = "/fee-management/history/statement";
const rateTone = (pct: number | null): PanelTone => (pct === null ? "neutral" : pct >= 90 ? "positive" : pct >= 80 ? "attention" : "negative");

export function historyTab(data: History): TabContent {
  const { kpis } = data;
  const cards: KpiCard[] = [
    { label: "Collected this session", value: nairaShort(kpis.collectedSession), sub: data.session || "The current session" },
    { label: "This term", value: nairaShort(kpis.collectedTerm), tone: "positive", sub: kpis.expectedTerm ? `${Math.round((kpis.collectedTerm / kpis.expectedTerm) * 100)}% of ${nairaShort(kpis.expectedTerm)}` : "Nothing billed yet" },
    { label: "Receipts issued", value: kpis.receipts.toLocaleString("en-NG"), sub: "Sequential · every one on file" },
    { label: "Reversals", value: String(kpis.reversals), tone: kpis.reversals ? "attention" : "positive", sub: kpis.reversals ? `${naira(kpis.reversalValue)} · each with a named reason` : "Nothing has been reversed" },
    { label: "Still outstanding", value: nairaShort(kpis.outstanding), tone: kpis.outstanding ? "attention" : "positive", sub: "Carried into the debtor list", link: "Open Collections", href: "/fee-management/collections" },
  ];
  const termRows: TableRow[] = data.terms.map((row) => ({
    id: row.id,
    cells: [
      text(row.session, { strong: true }),
      text(row.term),
      text(naira(row.expected), { mono: true }),
      text(naira(row.collected), { mono: true, strong: true }),
      row.rate === null ? text("—") : pill(`${row.rate}%`, rateTone(row.rate)),
      text(naira(row.never), { mono: true, tone: row.never ? "attention" : undefined }),
      text(String(row.receipts)),
      pill(row.state, row.state === "In progress" ? "progress" : "neutral"),
      { kind: "action", label: "Statement", href: `${STATEMENT}?period=${row.state === "In progress" ? "This+term" : "This+session"}` },
    ],
    keywords: `session:${row.session}| state:${row.state}|`,
  }));
  const sessions = Array.from(new Set(data.terms.map((row) => row.session)));
  const sectionRows: TableRow[] = data.sections.map((row) => ({
    id: row.name,
    cells: [text(row.name, { strong: true }), text(String(row.students)), text(naira(row.expected), { mono: true }), text(naira(row.collected), { mono: true, strong: true }), row.rate === null ? text("—") : pill(`${row.rate}%`, rateTone(row.rate)), text(naira(row.expected - row.collected), { mono: true, tone: "attention" }), { kind: "action", label: "Statement", href: `${STATEMENT}?scope=A+section&which=${encodeURIComponent(row.name)}&period=This+session` }],
    keywords: row.name,
  }));
  const receiptRows: TableRow[] = data.receipts.map((row) => ({
    id: row.id,
    cells: [text(row.ref, { strong: true, mono: true }), nameCell(row.student, row.adm), text(row.arm), text(naira(row.amount), { mono: true, strong: true }), text(row.mode), row.bankRef ? text(row.bankRef, { mono: true }) : text("—"), nameCell(row.by, "Bursary"), text(dayLabel(row.at)), { kind: "action", label: "Reprint", href: `/print/receipt/${row.id}?duplicate=1` }],
    keywords: `${row.mode} ${row.by} ${row.arm}`,
  }));
  const modes = Array.from(new Set(data.receipts.map((row) => row.mode)));
  const people = Array.from(new Set(data.receipts.map((row) => row.by)));
  return {
    title: "History",
    desc: "Every payment ever made, and the statement that proves it.",
    primary: { label: "Spool a statement", icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15", href: STATEMENT },
    launchers: [
      { label: "Statement for one section", href: `${STATEMENT}?scope=A+section` },
      { label: "Statement for one family", href: `${STATEMENT}?scope=One+family` },
      { label: "Open Collections", href: "/fee-management/collections" },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Every term on record", per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Term by term",
            tag: plural(data.terms.length, "term"),
            sub: "What each term expected, what came in, and what never did.",
            meta: "Open any row as a statement",
            noun: "term",
            nounPlural: "terms",
            filters: [
              { label: "Session", value: "All", options: ["All", ...sessions], match: Object.fromEntries(sessions.map((name) => [name, `session:${name}|`])) },
              { label: "State", value: "All", options: ["All", "Closed", "In progress"], match: { Closed: "state:Closed|", "In progress": "state:In progress|" } },
            ],
            acts: [{ label: "Spool a statement", primary: true, href: STATEMENT }],
            head: ["Session", "Term", "Expected", "Collected", "Rate", "Never collected", "Receipts", "State", ""],
            rows: termRows,
            noRowOpen: true,
            emptyTitle: "Nothing billed yet",
            emptyBody: "A term appears here once it has invoices.",
            foot: "Collected is money actually received against the term’s invoices, never money promised.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "By section, this session",
            sub: "Where the money comes from, and where it does not.",
            meta: data.session,
            noun: "section",
            nounPlural: "sections",
            filters: [{ label: "Section", value: "All", options: ["All", ...data.sections.map((row) => row.name)] }],
            acts: [{ label: "Spool a section statement", primary: true, href: `${STATEMENT}?scope=A+section` }],
            head: ["Section", "Students", "Expected", "Collected", "Rate", "Outstanding", ""],
            rows: sectionRows,
            noRowOpen: true,
            emptyTitle: "Nothing billed yet",
            emptyBody: "Sections appear once their students are invoiced.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Receipt archive",
            tag: plural(kpis.receipts, "receipt"),
            sub: "A reprint is stamped DUPLICATE on the document itself.",
            meta: `${data.receipts.length} most recent · newest first`,
            noun: "receipt",
            nounPlural: "receipts",
            search: "Find by receipt number, student or bank reference",
            filters: [
              { label: "Method", value: "All", options: ["All", ...modes] },
              { label: "Recorded by", value: "All", options: ["All", ...people] },
            ],
            acts: [{ label: "Export the archive", export: true }, { label: "Spool a statement", primary: true, href: STATEMENT }],
            head: ["Receipt", "Student", "Class and arm", "Amount", "Method", "Reference", "Recorded by", "Date", ""],
            rows: receiptRows,
            noRowOpen: true,
            per: 12,
            emptyTitle: "No receipt yet",
            emptyBody: "A receipt is issued when a payment is recorded with “Issue the receipt now”.",
            foot: "Opening a receipt shows the document itself. The original stays the only payment recorded.",
          },
        ],
      },
    ],
  };
}
