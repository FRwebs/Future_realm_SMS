import type { Compliance, ComplianceReturn, ReportsOverview } from "@/lib/modules/live/m14-types";
import { area, select, text } from "@/lib/modules/live/m7-forms";
import { dayLong } from "@/lib/modules/live/m7-format";
import type { DrawerSpec } from "@/lib/modules/panels";

/** Every modal in Analytics & Reports, as data. */

export const AR = "/api/v1/analytics-reports";
export const GOV = "/api/v1/governance";
export const downloadStandard = (code: string) => `${AR}/reports/generate/standard/${encodeURIComponent(code)}`;
export const downloadDataset = (code: string) => `${AR}/reports/generate/dataset/${encodeURIComponent(code)}`;
export const downloadCustom = (code: string) => `${AR}/reports/generate/custom/${encodeURIComponent(code)}`;
export const downloadReturn = (id: string) => `${AR}/compliance/${encodeURIComponent(id)}/generate`;
export const downloadArchived = (id: string) => `${AR}/reports/archive/${encodeURIComponent(id)}`;
const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));

/** Produce any document the school can make, from a form — the file is kept and handed back. */
export function generateDrawer(o: ReportsOverview): DrawerSpec {
  const options = [
    ...o.standard.map((report) => ({ value: `standard:${report.code}`, label: report.name })),
    ...o.datasets.map((dataset) => ({ value: `dataset:${dataset.code}`, label: `${dataset.name} · data export` })),
    ...o.definitions.map((definition) => ({ value: `custom:${definition.code}`, label: `${definition.name} · saved report` })),
  ];
  return {
    mode: "output",
    kicker: "Reports",
    title: "Generate a report",
    sub: "Built from the school's records at the moment you ask — never a cached figure.",
    commitLabel: "Produce it",
    commitDone: "Report produced",
    commitDoneBody: "It is kept with your name and the time, and every export is written to the audit log.",
    reviewNote: "A file with personal data in it leaves the system once it is downloaded. This page is where a name is put against it.",
    fields: [select("Report", options.map((option) => option.label), { required: true, span: 2 })],
    submit: { endpoint: `${AR}/reports/run`, method: "POST", map: { Report: "report" }, encode: { Report: pair(options) } },
  };
}

/** Define a saved report: a dataset, narrowed by a word in one column and grouped by another. */
export function buildReportDrawer(o: ReportsOverview): DrawerSpec {
  const options = o.datasetOptions.map((dataset) => ({ value: dataset.code, label: dataset.name }));
  const every = Array.from(new Set(o.datasetOptions.flatMap((dataset) => dataset.columns)));
  return {
    mode: "form",
    kicker: "Reports",
    title: "Build a report",
    sub: "Pick the data, say how to narrow it and how to group it, and it can be run any time.",
    commitLabel: "Save the report",
    commitDone: "Report saved",
    commitDoneBody: "It is under Custom reports. Running it reads today's records, and each run is logged.",
    reviewNote: "A saved report holds the question, not the answer — it is rebuilt from live data every time it runs.",
    fields: [
      text("Name", { required: true, span: 2, placeholder: "Outstanding fees by arm" }),
      select("Built from", options.map((option) => option.label), { required: true, span: 2 }),
      select("Group by", ["Do not group", ...every], { hint: "Shows how many rows fall under each value." }),
      select("Narrow by", ["Do not narrow", ...every], { hint: "Keeps only rows whose value contains the word below." }),
      text("The word it must contain", { optional: true, span: 2, placeholder: "JSS 1" }),
      select("When it runs", o.schedules, { required: true, hint: "On a schedule the report runs by itself at that time (West Africa Time) and is kept under Recent; you can still run it any time." }),
    ],
    submit: { endpoint: `${AR}/reports/definitions`, method: "POST", map: { Name: "name", "Built from": "dataset", "Group by": "groupBy", "Narrow by": "filterColumn", "The word it must contain": "filterValue", "When it runs": "schedule" }, encode: { "Built from": pair(options), "Group by": { "Do not group": "" }, "Narrow by": { "Do not narrow": "" } } },
  };
}

export function removeDefinitionDrawer(code: string, name: string): DrawerSpec {
  return { mode: "commit", kicker: "Reports", title: `Remove · ${name}`, sub: "The definition is removed; what it produced before stays in the log.", facts: [["Report", name], ["Past runs", "Kept", "Each one is in the audit log"]], commitLabel: "Remove it", commitDone: "Report removed", commitDoneBody: "It is gone from Custom reports.", submit: { endpoint: `${AR}/reports/definitions/${encodeURIComponent(code)}`, method: "DELETE" } };
}

/* ───────────────────────── compliance ───────────────────────── */

export const STATE_LABEL: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", BLOCKED: "Blocked", FILED: "Filed", AMENDED: "Amended" };

export function returnDrawer(r: ComplianceReturn): DrawerSpec {
  return {
    mode: "output",
    kicker: `Compliance · ${r.body}`,
    title: `Generate · ${r.name}`,
    sub: r.ready ? "Built from live data at the moment you generate it." : "This return cannot be generated yet.",
    facts: [
      ["Return", r.name, r.body],
      ["Period", r.period],
      ["Due", dayLong(r.dueOn), r.status === "FILED" ? "Filed" : `${r.days} days`],
      ["Format", r.format, "Produced as a file you can open in a spreadsheet"],
      ["Covers", r.covers],
      ["Source", "Live data at the moment you generate", "Never a cached figure"],
      ["State", r.ready ? "Ready to generate" : "Blocked", r.blocker ?? "Everything it needs is on file"],
      ["Responsible", r.ownerRole ?? "Not named"],
      ["Kept", "Every generated return is archived", "With who generated it and when"],
    ],
    commitLabel: "Generate it",
    commitDone: "Return generated",
    commitDoneBody: "It is archived with your name and the time. Mark it filed once it has gone to the body.",
    ...(r.ready ? { submit: { endpoint: `${AR}/compliance/${r.id}/run`, method: "POST" as const } } : { readOnly: true, readOnlyNote: r.blocker ?? undefined }),
  };
}

export function fileReturnDrawer(r: ComplianceReturn): DrawerSpec {
  return {
    mode: "commit",
    kicker: `Compliance · ${r.body}`,
    title: `Mark filed · ${r.name}`,
    sub: "Say it has gone to the body. The copy you generated stays in the archive.",
    facts: [["Return", r.name, r.period], ["Goes to", r.body], ["State after", "Filed", "A refiling is versioned; the original is never overwritten"]],
    commitLabel: "Mark it filed",
    commitDone: "Return filed",
    commitDoneBody: "It is on the filed list, with its archived copy.",
    submit: { endpoint: `${GOV}/compliance-returns/${r.id}`, method: "PATCH", body: { action: "FILE" } },
  };
}

export function addReturnDrawer(): DrawerSpec {
  return {
    mode: "form",
    kicker: "Compliance",
    title: "Add a return",
    sub: "A return the school owes that is not on the list.",
    commitLabel: "Track it",
    commitDone: "Return tracked",
    commitDoneBody: "It is on the compliance calendar, with its deadline and who answers for it.",
    fields: [
      text("Name", { required: true, span: 2, placeholder: "Boarding house inspection return" }),
      text("Goes to", { required: true, span: 2, placeholder: "The body it is filed with" }),
      text("Period", { required: true, placeholder: "Second Term 2025/2026" }),
      text("Due on", { type: "date", required: true }),
      text("Format", { required: true, placeholder: "Board portal · CSV" }),
      select("Responsible", ["Principal", "Registrar", "Exam Officer", "Bursar", "Data Protection Officer"], { required: true }),
      area("What it covers", { required: true, span: 2, placeholder: "What the body asks for, in a sentence." }),
    ],
    submit: { endpoint: `${GOV}/compliance-returns`, method: "POST", map: { Name: "name", "Goes to": "body", Period: "period", "Due on": "dueOn", Format: "format", Responsible: "ownerRole", "What it covers": "covers" } },
  };
}

export function evidenceDrawer(c: Compliance): DrawerSpec {
  return {
    mode: "output",
    kicker: "Compliance",
    title: "Evidence pack for an inspection",
    sub: "What the school can show today, and what it could not.",
    facts: [
      ["Returns tracked", String(c.stats.tracked), `${c.stats.filed} filed · ${c.stats.blocked} blocked`],
      ["Archived copies", String(c.archive.length), "Each with who made it and when"],
      ["Record gaps", String(c.gaps.reduce((sum, gap) => sum + gap.count, 0)), c.gaps.length ? c.gaps.map((gap) => gap.what).slice(0, 3).join(", ") : "None found"],
      ["Audit log", "Every generated copy is in it", "Open Audit & Security for the full log"],
    ],
    readOnly: true,
    readOnlyNote: "This is the index of what exists. Each return's file is generated from the table, and the audit log is exported from Reports.",
  };
}
