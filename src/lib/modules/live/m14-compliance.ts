import { apiGet } from "@/lib/api/server";
import { AR, addReturnDrawer, downloadArchived, evidenceDrawer, fileReturnDrawer, returnDrawer, STATE_LABEL } from "@/lib/modules/live/m14-forms";
import type { Compliance, ComplianceReturn } from "@/lib/modules/live/m14-types";
import { dayLong, plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent } from "@/lib/modules/panels";

/** Compliance — every return this school owes, and whether it can be filed today. */

export const loadCompliance = () => apiGet<Compliance>(`${AR}/compliance`);

const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const STATE_TONE: Record<string, PanelTone> = { NOT_STARTED: "neutral", IN_PROGRESS: "progress", BLOCKED: "negative", FILED: "positive", AMENDED: "attention" };
/** Where each kind of gap is put right. */
const FIX: Record<string, string> = { "Student Records · Registry": "/student-records/registry", "Parents & Guardians": "/parents-guardians/consent", "Staff & Access · Directory": "/staff-access/directory" };

export function complianceTab(c: Compliance): TabContent {
  const s = c.stats;
  const blocked = c.returns.filter((item) => !item.ready);
  const open = c.returns.filter((item) => item.status !== "FILED");
  const first = open.find((item) => item.ready) ?? c.returns[0];
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "Returns this school owes", per: 6,
      cards: [
        { label: "Returns tracked", value: String(s.tracked), sub: `Across ${plural(s.bodies, "body", "bodies")}` },
        { label: "Due within 35 days", value: String(s.dueSoon), sub: s.nextDays !== null && s.dueSoon ? `Soonest in ${s.nextDays} days` : "Nothing imminent", tone: s.dueSoon ? "attention" : "positive" },
        { label: "Blocked", value: String(s.blocked), sub: "Missing data on file", tone: s.blocked ? "negative" : "positive" },
        { label: "Ready to generate", value: String(s.ready), sub: "One click each", tone: "positive" },
        { label: "Filed this session", value: String(s.filed), sub: "Archived with its source", tone: "positive" },
        { label: "Next deadline", value: s.nextDays === null ? "—" : `${s.nextDays} days`, sub: open.length ? open.slice().sort((a, b) => a.days - b.days)[0].name : "Nothing outstanding", tone: s.nextDays !== null && s.nextDays <= 14 ? "negative" : "attention" },
      ],
    }],
  });
  if (blocked.length) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `${plural(blocked.length, "return")} cannot be produced from the data on file today`, body: `${blocked.map((item) => `${item.name} — ${item.blocker}`).join(". ")}. None of this is a reporting problem; it is missing data, and it is fixable now rather than the week the return is due.`, acts: [{ label: "Fix the record gaps", href: "/student-records/registry" }, { label: "Fix the staff gaps", href: "/staff-access/directory" }] }] });
  const owners = Array.from(new Set(c.returns.map((item) => item.ownerRole).filter((role): role is string => Boolean(role))));
  const bodies = Array.from(new Set(c.returns.map((item) => item.body)));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Compliance returns", tag: `${s.tracked} tracked`, tagTone: "neutral", sub: "Each one names its recipient, its deadline, its format and whether it can be produced today.",
      meta: `${plural(s.tracked, "return")} · ${s.filed} filed · ${s.blocked} blocked${s.nextDays === null ? "" : ` · next due in ${s.nextDays} days`}`, search: "Find a return or a body",
      filters: [
        { label: "Body", value: "All", options: ["All", ...bodies], match: Object.fromEntries(bodies.map((body) => [body, `body:${body}`])) },
        { label: "State", value: "All", options: ["All", "Not started", "In progress", "Blocked", "Filed"], match: { "Not started": "state:NOT_STARTED", "In progress": "state:IN_PROGRESS", Blocked: "state:BLOCKED", Filed: "state:FILED" } },
        { label: "Due", value: "All", options: ["All", "Within 14 days", "Within 35 days"], match: { "Within 14 days": "due:14", "Within 35 days": "due:35" } },
        { label: "Responsible", value: "All", options: ["All", ...owners], match: Object.fromEntries(owners.map((owner) => [owner, `owner:${owner}`])) },
      ],
      acts: [{ label: "Export the compliance calendar", export: true }, { label: "Add a return", primary: true, drawer: addReturnDrawer() }],
      head: ["Return", "Goes to", "Due", "Days", "Period", "Responsible", "State", ""], noun: "return", nounPlural: "returns", per: 10, selectable: true,
      bulkActs: [{ label: "Export the calendar", export: true, primary: true }],
      rows: c.returns.map((item) => ({
        id: item.id,
        keywords: `${item.name} ${item.body} body:${item.body} state:${item.status} owner:${item.ownerRole ?? ""} ${item.days <= 14 ? "due:14" : ""} ${item.days <= 35 ? "due:35" : ""}`,
        cells: [nameCell(item.name, item.covers), text(item.body), text(dayLong(item.dueOn), { strong: true, tone: item.status === "FILED" ? "positive" : item.days <= 14 ? "negative" : item.days <= 35 ? "attention" : undefined }), item.status === "FILED" ? text("—") : text(String(item.days), { mono: true }), text(item.period), item.ownerRole ? nameCell(item.ownerRole, "Responsible", { avatar: false }) : text("Not named"), pill(STATE_LABEL[item.status] ?? item.status, STATE_TONE[item.status] ?? "neutral"), item.status === "FILED" ? { kind: "action" as const, label: "Download", href: archiveFor(c, item) } : item.ready ? { kind: "action" as const, label: "Generate", drawer: returnDrawer(item) } : { kind: "action" as const, label: "See what is missing", href: "/student-records/registry" }],
      })),
      foot: "A return is built from live data at the moment you generate it, never from a cached figure — and every generated copy is archived with who produced it.",
    }],
  });
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "table", title: "What is missing before a return can be filed", sub: "Each row names the return it blocks, so the gap has a consequence.",
        meta: `${plural(blocked.length, "return")} blocked by ${plural(c.gaps.reduce((sum, gap) => sum + gap.count, 0), "record gap")}`,
        acts: [{ label: "Open the registry", href: "/student-records/registry" }],
        head: ["What is missing", "Count", "Blocks", "Where to fix it", ""], noun: "gap", nounPlural: "gaps", noRowOpen: true,
        rows: c.gaps.map((gap) => ({ cells: [text(gap.what, { strong: true }), text(String(gap.count), { mono: true }), text(gap.blocks), text(gap.fix), { kind: "action" as const, label: "Fix", href: FIX[gap.fix] ?? "/student-records/registry" }] })),
        empty: "Nothing is missing. Every return can be produced from what is on file.",
        foot: "A missing photograph is not a filing problem — it is a record problem that only becomes urgent the week a return is due.",
      },
      {
        type: "facts", title: "How a return is produced here", tuck: "How a return is produced", sub: "The same for every body.", per: 1,
        facts: [
          ["Built from", "Live data at the moment you generate it", "Never a cached or rounded figure"],
          ["Format", "A file you can open in a spreadsheet", "Upload it to the body's portal or template"],
          ["Validation", "Run before anything is produced", "A return with a gap tells you rather than filing short"],
          ["Archived", "Every generated copy is kept", "With who generated it and when"],
          ["Filing", "You mark it filed once it has gone", "Refused while a gap is open"],
          ["Safeguarding checks", "Not kept in this system", "The audit file says so rather than inventing them"],
        ],
      },
    ],
  });
  const waiting = c.returns.filter((item) => item.status !== "FILED" && c.archive.some((copy) => copy.returnId === item.id));
  if (waiting.length) rows.push({ cols: "1fr", panels: [{ type: "list", title: "Generated, not yet filed", sub: "A copy has been made. Once it has gone to the body, say so here.", items: waiting.map((item) => ({ label: `${item.name} · ${item.body}`, sub: `Due ${dayLong(item.dueOn)} · ${item.days} days`, pill: "Copy kept", tone: "progress" as const, viewLabel: "Mark filed", drawer: fileReturnDrawer(item) })) }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "list", title: "Filed and archived", sub: "Every return this school has produced, with who made it and when.",
      items: c.archive.map((copy) => ({ label: copy.title, sub: `${copy.rows ?? 0} rows · ${copy.by ?? "Someone"} · ${dayLong(copy.at)}`, pill: copy.kept ? "Archived" : "Not kept", tone: copy.kept ? ("positive" as const) : ("neutral" as const), ...(copy.kept ? { viewLabel: "Download", href: downloadArchived(copy.id) } : {}) })),
      foot: c.archive.length ? undefined : "Nothing has been generated yet. Generate a return and its copy is kept here.",
    }],
  });
  return {
    title: "Compliance", desc: "Every return this school owes, and whether it can be filed today.",
    primary: first && first.ready ? { label: "Generate a return", icon: DOWNLOAD, drawer: returnDrawer(first) } : { label: "Add a return", icon: DOWNLOAD, drawer: addReturnDrawer() },
    launchers: [{ label: "Add a return", drawer: addReturnDrawer() }, { label: "Evidence pack for an inspection", drawer: evidenceDrawer(c) }],
    rows,
  };
}

/** The most recent archived copy of a return, for download; where none was kept, the drawer that makes one. */
function archiveFor(c: Compliance, item: ComplianceReturn): string {
  const copy = c.archive.find((entry) => entry.returnId === item.id && entry.kept);
  return copy ? downloadArchived(copy.id) : `${AR}/compliance/${item.id}/generate`;
}
