import { apiGet } from "@/lib/api/server";
import { cardDrawer, printDrawer, RC, reissueDrawer } from "@/lib/modules/live/m6-forms";
import type { ArchiveOverview } from "@/lib/modules/live/m6-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Archive — every card ever issued, and the card itself as the family received it. */

export const loadArchive = (query: { term?: string; arm?: string }) => {
  const params = new URLSearchParams();
  if (query.term) params.set("term", query.term);
  if (query.arm) params.set("arm", query.arm);
  return apiGet<ArchiveOverview>(`${RC}/archive${params.toString() ? `?${params.toString()}` : ""}`);
};

const PRINTER = "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z";
const DELIVERY: Record<string, PanelTone> = { Delivered: "positive", "Not sent": "attention", Undelivered: "negative" };
const KIND: Record<string, string> = { CORRECTION: "Corrected result", REISSUE: "Reissued", ISSUE: "Issued" };
const BATCH: Record<string, string> = { PRINT: "Printed", PUBLISH: "Published", SEND: "Sent", UNPUBLISH: "Taken back" };
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function archiveTab(a: ArchiveOverview): TabContent {
  const k = a.kpis;
  const params = (term: string | null, arm: string | null) => {
    const list = new URLSearchParams();
    if (term) list.set("term", term);
    if (arm) list.set("arm", arm);
    return `/report-cards/archive${list.toString() ? `?${list.toString()}` : ""}`;
  };
  const reissue = reissueDrawer(a);
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "The archive", sub: a.filters.term || a.filters.arm ? "Narrowed by the strips below" : "Every term the school has issued", per: 4,
      cards: [
        { label: "Cards issued", value: String(k.issued), sub: k.issued ? "Each one opens as the family had it" : "Nothing has been issued yet", tone: k.issued ? "positive" : "neutral" },
        { label: "Sessions on record", value: String(k.sessions), sub: "Retrievable by child, arm and term", tone: "neutral" },
        { label: "Revisions", value: String(k.revisions), sub: k.revisions ? "A correction is stored beside the original" : "No card has been corrected", tone: k.revisions ? "attention" : "positive" },
        { label: "Not delivered", value: String(k.undelivered), sub: k.undelivered ? "Nobody on the record can open it" : "Every family can open theirs", tone: k.undelivered ? "negative" : "positive" },
      ],
    }],
  });
  rows.push({ cols: "1fr", panels: [{ type: "days", title: "Choose the term", sub: "Cards are kept for every term on record.", days: [{ label: "Every term", href: params(null, a.filters.arm), state: a.filters.term ? "plain" : "now" }, ...a.terms.map((term) => ({ label: `${term.name} ${term.session}`, sub: term.current ? "Current" : undefined, href: params(term.id, a.filters.arm), state: a.filters.term === term.id ? ("now" as const) : ("plain" as const) }))] }] });
  rows.push({ cols: "1fr", panels: [{ type: "days", title: "Choose the arm", days: [{ label: "Every arm", href: params(a.filters.term, null), state: a.filters.arm ? "plain" : "now" }, ...a.arms.map((arm) => ({ label: arm.name, href: params(a.filters.term, arm.id), state: a.filters.arm === arm.id ? ("now" as const) : ("plain" as const) }))] }] });
  const tableRows: TableRow[] = a.rows.map((row) => ({
    id: `${row.studentId}|${row.termId}`,
    keywords: `${row.name} ${row.adm} ${row.arm} ${row.term} state:${row.state} delivery:${row.delivery}`,
    cells: [
      nameCell(row.name, row.arm), text(row.adm, { mono: true }), text(row.term), text(row.published ? day(row.published) : "—"), text(row.reference ?? "—", { mono: true }),
      pill(row.revision > 1 ? `Revision ${row.revision}` : "Original", row.revision > 1 ? "attention" : "neutral"), pill(row.delivery, DELIVERY[row.delivery] ?? "neutral"),
      { kind: "action" as const, label: "Open the card", drawer: cardDrawer(row.studentId, row.termId, row.name) },
    ],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Every card issued", tag: `${a.rows.length} on this view`, tagTone: "neutral", sub: "Open one to see the document exactly as it was handed over.",
      meta: `${k.issued} issued · ${k.revisions} revisions · ${k.undelivered} not delivered${k.withheld ? ` · ${k.withheld} withheld` : ""}`, search: "Find a child, an admission number or a reference",
      filters: [
        { label: "Delivery", value: "All", options: ["All", "Delivered", "Not sent", "Undelivered"], match: { Delivered: "delivery:Delivered", "Not sent": "delivery:Not sent", Undelivered: "delivery:Undelivered" } },
        { label: "State", value: "All", options: ["All", "Published", "Revised"], match: { Published: "state:Published", Revised: "state:Revised" } },
      ],
      acts: [{ label: "Reissue a card", primary: true, drawer: reissue }],
      head: ["Child", "Admission no", "Term", "Issued", "Reference", "Version", "Delivery", ""], noun: "card", nounPlural: "cards", per: 12, selectable: true,
      bulkActs: [
        { label: "Print the selection", drawer: { ...printDrawer({ label: "the cards you ticked", total: 0, drafts: 0, scope: {} }), title: "Print the selected cards", facts: [["Scope", "The cards you ticked"], ["Paper", "A4 · portrait"]] }, selection: { key: "students", noun: "card" } },
        { label: "Export selected", primary: true, export: true },
      ],
      rows: tableRows, empty: "No card has been issued for this view.",
      foot: "A card a family holds is revised, never replaced. The earlier version stays on the record.",
    }],
  });
  const revisionItems = a.revisions.slice(0, 8).map((entry) => ({ label: `${entry.name} · ${entry.term}`, sub: `${entry.reason} · ${day(entry.at)}${entry.notified ? " · family told" : ""}`, pill: `${KIND[entry.kind] ?? entry.kind} · r${entry.revision}`, tone: (entry.kind === "CORRECTION" ? "attention" : "neutral") as PanelTone, viewLabel: "Open", drawer: cardDrawer(entry.studentId, entry.termId, entry.name) }));
  const takeBack = (batch: ArchiveOverview["batches"][number]): DrawerSpec => ({ mode: "commit", kicker: batch.term, title: `Take back the ${batch.scope} publish`, sub: `Possible for ${a.policy.reversibleMinutes} minutes after publishing, and only before a correction.`, facts: [["Scope", batch.scope, plural(batch.cards, "card")], ["Effect", "Back to drafts in both portals"], ["Families", "Told in-app when they were published; nothing recalls that message"]], commitLabel: "Take it back", commitDone: "Cards taken back", commitDoneBody: "They are drafts again, and the history shows who did it.", submit: { endpoint: `${RC}/unpublish`, method: "POST", body: { batch: batch.id } } });
  const batchItems = a.batches.slice(0, 8).map((batch) => ({ label: `${BATCH[batch.kind] ?? batch.kind} · ${batch.scope}`, sub: `${plural(batch.cards, "card")} · ${batch.by} · ${batch.at}${batch.channels.length ? ` · ${batch.channels.join(", ")}` : ""}`, pill: batch.reversible ? `Reversible · ${batch.term}` : batch.term, tone: (batch.reversible ? "attention" : "neutral") as PanelTone, ...(batch.reversible ? { viewLabel: "Take back", drawer: takeBack(batch) } : {}) }));
  rows.push({
    cols: "1fr 1fr",
    panels: [
      { type: "list", title: "Corrections and reissues", sub: "Every card that changed after a family had it.", items: revisionItems, foot: revisionItems.length ? undefined : "No card has been corrected or reissued." },
      { type: "list", title: "Print and send history", sub: "Every run, under the name of whoever started it.", items: batchItems, foot: batchItems.length ? undefined : "Nothing has been published, printed or sent yet." },
    ],
  });
  return {
    title: "Archive", desc: "Every card ever issued, by child, arm and term — and the card as the family received it.",
    primary: { label: "Reissue a card", icon: PRINTER, drawer: reissue },
    launchers: k.withheld ? [{ label: `${k.withheld} withheld ${k.withheld === 1 ? "card" : "cards"}`, href: "/report-cards/completion" }] : [],
    rows,
  };
}
