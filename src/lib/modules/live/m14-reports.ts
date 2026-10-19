import { apiGet } from "@/lib/api/server";
import { AR, buildReportDrawer, downloadCustom, downloadDataset, downloadStandard, generateDrawer, removeDefinitionDrawer } from "@/lib/modules/live/m14-forms";
import type { ReportsOverview } from "@/lib/modules/live/m14-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, text, type PanelRow, type TabContent } from "@/lib/modules/panels";

/** Reports — every document this school issues, and all of its data. */

export const loadReports = () => apiGet<ReportsOverview>(`${AR}/reports`);

const PLUS = "M12 5.5v13M5.5 12h13";
const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not yet");

export function reportsTab(o: ReportsOverview): TabContent {
  const k = o.kpis;
  const generate = generateDrawer(o);
  const build = buildReportDrawer(o);
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", per: 4,
      cards: [
        { label: "Standard reports", value: String(k.standard), sub: "Built from live records, dated and logged" },
        { label: "Custom definitions", value: String(k.custom), sub: k.scheduled ? `${k.scheduled} run on their own schedule` : "Saved questions, run on demand" },
        { label: "Datasets exportable", value: String(k.datasets), sub: "Every one opens in Excel as CSV", tone: "positive" },
        { label: "Exports this session", value: String(k.exports), sub: "Every one written to the audit log" },
      ],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "note", tone: "positive", icon: DOWNLOAD,
      title: "This school owns its data. You can export all of it, at any time, without asking anyone's permission.",
      body: "Every dataset in this workspace exports as CSV, which Excel opens — students, staff, guardians, scores, attendance, payments, messages, consents and the full audit log. Each export keeps a copy with your name and the time against it.",
      acts: [{ label: "Export a dataset", drawer: generate }],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Standard reports", meta: "CSV · opens in Excel · never a PDF as a data export", search: "Find a report",
      head: ["Report", "What it answers", "Last generated", "By", "Get"], noun: "report", nounPlural: "reports", per: 12, noRowOpen: true,
      rows: o.standard.map((report) => ({ keywords: `${report.name} ${report.answers}`, cells: [nameCell(report.name, report.answers), text(report.covers), text(stamp(report.lastAt)), text(report.lastBy ?? "—"), { kind: "action" as const, label: "Generate", href: downloadStandard(report.code) }] })),
    }],
  });
  rows.push({
    cols: "1.05fr 1fr",
    panels: [
      {
        type: "table", title: "Custom reports", meta: `${plural(k.custom, "saved report")}${k.scheduled ? ` · ${k.scheduled} scheduled` : ""}`,
        acts: [{ label: "Build a report", primary: true, drawer: build }],
        head: ["Definition", "Grouped by", "Schedule", "Owner", "Run"], noun: "definition", nounPlural: "definitions", noRowOpen: true,
        rows: o.definitions.map((definition) => ({ cells: [nameCell(definition.name, `${definition.datasetName}${definition.filterColumn && definition.filterValue ? ` · ${definition.filterColumn} contains “${definition.filterValue}”` : ""}`), text(definition.groupBy || "Not grouped"), text(definition.schedule), text(definition.owner), { kind: "action" as const, label: "Run", href: downloadCustom(definition.code) }] })),
        empty: "No report has been saved yet. Build one: pick the data, how to narrow it and how to group it.",
        foot: o.definitions.length ? "Remove a saved report from its drawer — what it produced before stays in the log." : undefined,
      },
      {
        type: "table", title: "Data export", sub: "Every dataset, as CSV for Excel.", meta: `${plural(k.exports, "export")} taken this session · each one logged`,
        head: ["Dataset", "Rows", "Last taken", "Export"], noun: "dataset", nounPlural: "datasets", per: 9, noRowOpen: true,
        rows: o.datasets.map((dataset) => ({ cells: [text(dataset.name, { strong: true }), text(dataset.rows.toLocaleString("en-NG"), { mono: true }), text(dataset.lastAt ? `${stamp(dataset.lastAt)} · ${dataset.lastBy ?? ""}` : "Never taken"), { kind: "action" as const, label: "CSV", href: downloadDataset(dataset.code) }] })),
      },
    ],
  });
  if (o.definitions.length) rows.push({ cols: "1fr", panels: [{ type: "list", title: "Remove a saved report", sub: "Taking one off the list does not erase what it produced.", items: o.definitions.map((definition) => ({ label: definition.name, sub: definition.datasetName, viewLabel: "Remove", drawer: removeDefinitionDrawer(definition.code, definition.name) })) }] });
  if (o.recent.length) rows.push({ cols: "1fr", panels: [{ type: "list", title: "Recently produced", sub: "Every file made from this school's records, with whose name is against it.", items: o.recent.map((run) => ({ label: run.title, sub: `${run.rows ?? 0} rows · ${run.by ?? "Someone"} · ${stamp(run.at)}`, pill: run.kept ? "Kept" : "Not kept", tone: run.kept ? ("positive" as const) : ("neutral" as const), ...(run.kept ? { viewLabel: "Download", href: `${AR}/reports/archive/${run.id}` } : {}) })) }] });
  return { title: "Reports", desc: "Every document this school issues, and all of its data.", primary: { label: "Generate report", icon: PLUS, drawer: generate }, launchers: [{ label: "Compliance returns", href: "/analytics-reports/compliance" }, { label: "Audit log", href: "/audit-security/audit-log" }], rows };
}
