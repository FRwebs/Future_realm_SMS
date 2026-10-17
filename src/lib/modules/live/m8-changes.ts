import { apiGet } from "@/lib/api/server";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { decideChangeDrawer, listDrawer, migrationDrawer, requestChangeDrawer, SR } from "@/lib/modules/live/m8-forms";
import { studentHref } from "@/lib/modules/live/m8-registry";
import type { Changes, Registry } from "@/lib/modules/live/m8-types";
import { name as nameCell, pill, text, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Changes: what has been asked of a child's record, what is pending, what is incomplete. A change
 * is never made quietly — it is asked for with the before and the after, and decided by someone
 * who did not ask.
 */

export const loadChanges = () => apiGet<Changes>(`${SR}/changes`);

const ageText = (item: { age: number; hours: number }) => (item.age >= 1 ? plural(item.age, "day") : `${item.hours} ${item.hours === 1 ? "hour" : "hours"}`);

export function changesTab(data: Changes, registry: Registry | null): TabContent {
  const request = { label: "Request a change", drawer: requestChangeDrawer(data.fields, registry?.rows ?? []) };
  const incomplete = data.completeness.reduce((sum, item) => sum + item.count, 0);

  const pending: TableRow[] = data.pending.map((item) => ({
    id: item.id,
    drawer: decideChangeDrawer(item),
    cells: [nameCell(item.student, item.adm), text(item.field, { strong: true }), text(item.before), text(item.after), nameCell(item.by.name, item.by.role, { avatar: false }), text(ageText(item)), { kind: "action" as const, label: item.ownRequest ? "Yours" : "Decide", drawer: decideChangeDrawer(item) }],
    keywords: `${item.student} ${item.adm} ${item.field}`,
  }));
  const approved: TableRow[] = data.approved.map((item) => ({
    href: studentHref(item.studentId, "/records"),
    cells: [nameCell(item.student, item.adm), text(item.field, { strong: true }), text(item.before), text(item.after), nameCell(item.decidedBy.name, item.decidedBy.role, { avatar: false }), pill(item.status === "APPROVED" ? "Approved" : "Declined", item.status === "APPROVED" ? "positive" : "neutral"), text(item.decidedAt ? dayLabel(item.decidedAt) : "—")],
    keywords: `${item.student} ${item.field} ${item.before} ${item.after}`,
  }));
  const approvedCount = data.approved.filter((item) => item.status === "APPROVED").length;

  return {
    title: "Changes",
    desc: "What changed, what is pending, what is incomplete.",
    primary: data.pending.length ? { label: `Review ${plural(data.pending.length, "pending change")}`, icon: "M5 12.5l4.5 4.5 9-10", drawer: decideChangeDrawer(data.pending[0]) } : { label: "Request a change", icon: "M12 5.5v13M5.5 12h13", drawer: request.drawer },
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", per: 4, cards: [{ label: "Pending approval", value: String(data.pending.length), sub: "Each carries its evidence", tone: data.pending.length ? "attention" : "positive" }, { label: "Approved this term", value: String(approvedCount), sub: "Before and after kept on record" }, { label: "Incomplete records", value: String(incomplete), sub: `Across ${data.completeness.length} completeness checks`, tone: incomplete ? "attention" : "positive" }, { label: "Suspected duplicates", value: String(data.duplicates.length), sub: "A merge preserves every link", tone: data.duplicates.length ? "attention" : "positive" }] }] },
      {
        cols: "1fr",
        panels: [
          { type: "table", title: "Pending changes", tag: `${data.pending.length} awaiting approval`, tagTone: data.pending.length ? "attention" : "positive", sub: "Requester, field, before and after, and age.", head: ["Student", "Field", "Before", "After", "Requested by", "Age", "Decide"], noun: "change", nounPlural: "changes", noRowOpen: true, acts: [request], rows: pending, emptyTitle: "Nothing is waiting on a decision", emptyBody: "A correction someone asks for appears here, with its evidence." },
        ],
      },
      {
        cols: "1fr",
        panels: [{ type: "table", title: "Decided this term", meta: `${data.approved.length} decided · ${data.term?.label ?? "this term"}`, search: "Search by student, field or value", head: ["Student", "Field", "Before", "After", "Decided by", "Outcome", "When"], noun: "change", nounPlural: "changes", per: 6, rows: approved, emptyTitle: "Nothing has been decided this term", emptyBody: "Every decision is kept with the before, the after and the reason." }],
      },
      {
        cols: "1fr 1fr 1fr",
        panels: [
          { type: "list", title: "Record completeness", sub: "Each count opens the named records.", items: data.completeness.map((item) => ({ label: item.label, sub: `${plural(item.count, "student")} · ${item.sub}`, pill: String(item.count), tone: (item.count ? item.tone : "positive") as PanelTone, viewLabel: item.count ? "Open" : undefined, drawer: item.count ? listDrawer("Changes · completeness", item.label, item.sub, item.items.map((entry) => ({ label: entry.label, sub: entry.sub })), item.count > item.items.length ? `Showing ${item.items.length} of ${item.count}. Open any student from the registry.` : undefined) : undefined })) },
          { type: "list", title: "Suspected duplicates", sub: "Matched on name and date of birth.", items: data.duplicates.length ? data.duplicates.slice(0, 8).map((item) => ({ label: item.label, sub: item.sub, pill: "Review", tone: "attention" as PanelTone, viewLabel: "Review", drawer: listDrawer("Changes · duplicates", item.label, item.sub, [{ label: "What to do", sub: "Open each record, compare them, and ask for a change to one if they are the same child." }], "A merge never deletes — the school asks for a correction and someone else decides.") })) : [{ label: "No suspected duplicates", sub: "No two students share a name and a date of birth.", pill: "None", tone: "positive" as PanelTone }] },
          { type: "facts", title: "Migration state", tag: data.migration ? (data.migration.rolledBack ? "Rolled back" : "Signed off") : "No migration", tagTone: data.migration ? (data.migration.rolledBack ? "attention" : "positive") : "neutral", sub: "The reconciliation report is a customer-facing document, not a log file.", per: 1, acts: data.migration ? [{ label: "Open report", drawer: migrationDrawer(data.migration) }] : undefined, facts: data.migration ? [["Job", data.migration.job], ["Records presented", data.migration.presented === null ? "Not recorded" : data.migration.presented.toLocaleString("en-NG")], ["Signed off by", data.migration.signedOffBy ?? "—", data.migration.signedOffOn ?? undefined], ["Rollback", data.migration.rolledBack ? "Rolled back" : "No longer available — sign-off completed"]] : [["Job", "None signed off"], ["What this means", "This school's records were entered here, not migrated", "A migration appears here once a specialist has signed it off"]] },
        ],
      },
    ],
  };
}
