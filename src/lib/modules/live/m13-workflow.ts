import { apiGet } from "@/lib/api/server";
import { changeApproverDrawer, changeEscalationDrawer, createRouteDrawer, createRuleDrawer, editRouteDrawer, HUB, itemHref, resetManyDrawer, resetRouteDrawer, routeHref, ruleStateDrawer } from "@/lib/modules/live/m13-forms";
import type { RoutePage, RouteRow, WorkflowData } from "@/lib/modules/live/m13-types";
import { dayLong, plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Workflow — who approves what, how long it may sit, and what escalates. */

export const loadWorkflow = () => apiGet<WorkflowData>(`${HUB}/workflow`);
export const loadRoute = (type: string) => apiGet<RoutePage>(`${HUB}/routes/${encodeURIComponent(type)}`);

const PLUS = "M12 5.5v13M5.5 12h13";
const PEN = "M4 20h4L19 9l-4-4L4 16zM14.5 5.5l4 4";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const dayText = (days: number | null) => (days === null ? "—" : `${days} ${days === 1 ? "day" : "days"}`);
const slow = (route: Pick<RouteRow, "avgDays" | "escalateDays">) => route.avgDays !== null && route.avgDays > route.escalateDays;

export function workflowTab(d: WorkflowData): TabContent {
  const over = d.routes.filter((route) => route.overridden).length;
  const locked = d.routes.filter((route) => route.locked || !route.bulk).length;
  const active = d.rules.filter((rule) => rule.state === "Active").length;
  const createRoute = createRouteDrawer(d);
  const createRule = createRuleDrawer(d.options);
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "How work is routed", per: 5,
      cards: [
        { label: "Routes", value: String(d.routes.length), sub: `${over} ${over === 1 ? "is your own override" : "are your own overrides"}` },
        { label: "School overrides", value: String(over), sub: "On top of the defaults", tone: "submitted" },
        { label: "Standing rules", value: String(active), sub: `${d.rules.length - active} revoked · revocable instantly`, tone: "neutral" },
        { label: "Never bulk-approvable", value: String(locked), sub: "Locked, never hidden", tone: "withheld" },
        { label: "Slowest route", value: d.slowest ? dayText(d.slowest.avgDays) : "—", sub: d.slowest ? d.slowest.name : "Nothing decided yet", tone: d.slowest && (d.slowest.avgDays ?? 0) > 5 ? "negative" : "neutral", link: d.slowest ? "Open it" : undefined, href: d.slowest ? routeHref(d.slowest.type) : undefined },
      ],
    }],
  });
  const routeRows: TableRow[] = d.routes.map((route) => ({
    id: route.type,
    keywords: `${route.name} ${route.module} ${route.approver} ${route.second} module:${route.module} approver:${route.approver} source:${route.overridden ? "override" : "default"} second:${route.second ? "required" : "none"}`,
    cells: [nameCell(route.name, route.why), text(route.module), text(route.approver, { strong: true }), text(route.second || "Not required"), text(dayText(route.escalateDays)), route.open ? text(String(route.open), { mono: true, strong: true }) : text("—"), pill(route.overridden ? "School override" : "Default", route.overridden ? "submitted" : "neutral"), { kind: "action" as const, label: "Open", href: routeHref(route.type) }],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Approval routes", tag: `${d.routes.length} routes`, tagTone: "neutral", sub: "Open a route to see the full path, what it blocks, and how it is actually performing.",
      meta: `${d.routes.length} routes · ${over} school overrides · ${locked} never bulk-approvable`, search: "Find a route by name, approver or module",
      filters: [
        { label: "Module", value: "All", options: ["All", ...d.modules], match: Object.fromEntries(d.modules.map((module) => [module, `module:${module}`])) },
        { label: "Approver", value: "All", options: ["All", ...d.approvers], match: Object.fromEntries(d.approvers.map((approver) => [approver, `approver:${approver}`])) },
        { label: "Source", value: "All", options: ["All", "Default", "School override"], match: { Default: "source:default", "School override": "source:override" } },
        { label: "Second approval", value: "All", options: ["All", "Required", "Not required"], match: { Required: "second:required", "Not required": "second:none" } },
      ],
      acts: [{ label: "Export the routing map", export: true }, { label: "Create a route", primary: true, drawer: createRoute }],
      head: ["Approval type", "Module", "Approver", "Second approver", "Escalates", "Open", "Source", ""], noun: "route", nounPlural: "routes", per: 12, selectable: true,
      bulkActs: [{ label: "Change the approver", drawer: changeApproverDrawer(d.options), selection: { key: "types", noun: "route" } }, { label: "Change the escalation period", drawer: changeEscalationDrawer(d.options), selection: { key: "types", noun: "route" } }, { label: "Reset to the default", drawer: resetManyDrawer(), selection: { key: "types", noun: "route" } }, { label: "Export selected", primary: true, export: true }],
      rows: routeRows,
      foot: "A route decides who may decide. Nobody can approve their own submission, whatever any route says — that rule sits above routing and cannot be switched off.",
    }],
  });
  const ruleRows: TableRow[] = d.rules.map((rule) => ({
    keywords: `${rule.name} ${rule.state}`,
    cells: [nameCell(rule.name, rule.why), text(`${rule.fields.join(", ")} · at most ${rule.maxChars} ${rule.maxChars === 1 ? "character" : "characters"}`), text(String(rule.fired), { mono: true, strong: true }), nameCell(rule.by, "Created " + dayLong(rule.at)), pill(rule.state, rule.state === "Active" ? "positive" : "neutral"), { kind: "action" as const, label: rule.state === "Active" ? "Revoke" : "Reinstate", drawer: ruleStateDrawer(rule) }],
  }));
  rows.push({
    cols: "1.05fr 1fr",
    panels: [
      {
        type: "table", title: "Standing rules", tag: `${active} in force`, tagTone: "neutral", sub: "The decisions a school has agreed need no human at all.",
        meta: `${active} active · ${d.rules.length - active} revoked · every firing is logged`,
        acts: [{ label: "Create a standing rule", primary: true, drawer: createRule }],
        head: ["Rule", "Condition", "Fired", "Created by", "State", ""], noun: "rule", nounPlural: "rules", noRowOpen: true, rows: ruleRows,
        empty: "The school has no standing rule. Every decision waits for a person.",
        foot: "Only a small change to a student's record can be made a standing rule today — nothing involving money, marks or access.",
      },
      {
        type: "list", title: "Permanently excluded from bulk approval", sub: "These can never be bulk-approved, whatever a route says.",
        items: d.locked.map((entry) => ({ label: entry.name, sub: entry.why, pill: "Locked", tone: "withheld" as PanelTone })), readOnly: true,
      },
    ],
  });
  return { title: "Workflow", desc: "Who approves what, how long it may sit, and what escalates.", primary: { label: "Create a route", icon: PLUS, drawer: createRoute }, launchers: [{ label: "Standing rules", drawer: createRule }, { label: "Open the queue", href: "/approvals-workflow/queue" }], rows };
}

/* ───────────────────────── one route ───────────────────────── */

export type RoutePageView = { content: TabContent & { crumb: { label: string; href: string } } };

export function routePage(p: RoutePage): RoutePageView {
  const r = p.route;
  const edit = editRouteDrawer(p);
  const late = slow(r);
  const rows: PanelRow[] = [];
  if (late) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `This route takes ${dayText(r.avgDays)} on average but escalates after ${dayText(r.escalateDays)}`, body: "It escalates more often than it is decided on time, which means the escalation is doing the work the approver should be. Either the period is too short for a decision that genuinely needs thought, or the approver needs help.", acts: [{ label: "Lengthen the escalation period", drawer: edit }, { label: "Add a second approver", drawer: edit }, { label: "See who is holding them", href: "/approvals-workflow/performance" }] }] });
  rows.push({ cols: "1fr", panels: [{ type: "steps", title: "The path", steps: [{ label: "Submitted", sub: `Anyone with ${p.config.who === "Anyone with Create in the module" ? `Create in ${r.module}` : p.config.who.toLowerCase()}`, state: "done" }, { label: r.approver, sub: r.open ? `${r.open} here now` : "Clear", state: r.open ? "current" : "done" }, ...(r.second ? [{ label: r.second, sub: "Confirms", state: "todo" as const }] : []), { label: "Applied", sub: "By the module that holds it", state: "todo" }] }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "This route", per: 6,
      cards: [
        { label: "Approver", value: r.approver, sub: "By role, never by name", tone: "neutral" },
        { label: "Second approval", value: r.second ? "Required" : "Not required", sub: r.second || "One decision is enough", tone: r.second ? "submitted" : "neutral" },
        { label: "Escalates after", value: dayText(r.escalateDays), sub: p.config.escalateTo },
        { label: "Waiting now", value: String(r.open), sub: r.open ? "Open decisions" : "Nothing waiting", tone: r.open > 3 ? "negative" : r.open ? "attention" : "positive", link: r.open ? "Open the queue" : undefined, href: r.open ? "/approvals-workflow/queue" : undefined },
        { label: "Average decision", value: dayText(r.avgDays), sub: r.avgDays === null ? "Nothing decided yet" : late ? "Slower than it escalates" : "Inside the period", tone: r.avgDays === null ? "neutral" : late ? "negative" : "positive" },
        { label: "Bulk approval", value: r.bulk ? "Allowed" : "Never", sub: r.locked ? "Locked permanently" : r.bulk ? "Up to 20 at a time" : "Decided one at a time", tone: r.bulk ? "neutral" : "withheld" },
      ],
    }],
  });
  rows.push({
    cols: "1.15fr 1fr",
    panels: [
      {
        type: "facts", title: "The route as it stands", tag: r.overridden ? "School override" : "Default", tagTone: r.overridden ? "submitted" : "neutral", sub: "What exists today. Editing starts from exactly this.", meta: `${r.module}`,
        acts: [{ label: "Edit this route", primary: true, drawer: edit }], per: 2,
        facts: [
          ["Approval type", r.name, r.why],
          ["Module", r.module],
          ["Who may submit", p.config.who, r.enforces.who ? "Checked when someone submits it" : "Recorded for this kind"],
          ["Approver", r.approver, "By role, never by name — a role survives a resignation"],
          ["Second approver", r.second || "Not required", r.second ? "Both must agree" : "One decision is final"],
          ["Escalates after", dayText(r.escalateDays), `To ${p.config.escalateTo.replace(/^The /, "the ")}`],
          ["Self-approval", "Never permitted", "Above routing — cannot be switched off"],
          ["Bulk approval", r.bulk ? "Up to 20 at a time" : "Never permitted", r.locked ? "Locked for this type" : ""],
          ["Evidence", p.config.evidence ? "Required" : "Optional", r.enforces.evidence ? "A request with none is refused when it is submitted" : "Recorded; this kind's form cannot carry evidence yet"],
          ["Reason required to decline", "Always", "The requester is told why"],
          ["Notify the requester", p.config.notify],
          ["What it blocks", r.blocks, "While it waits"],
        ],
      },
      {
        type: "list", title: "What happens at each step", sub: "The path a request takes, in plain words.",
        items: [
          { label: "1 · Someone raises it", sub: `In ${r.module}. They are told who it went to.`, pill: "Automatic", tone: "neutral" },
          { label: `2 · ${r.approver} decides`, sub: "They see the request, the reason, the evidence and what it blocks. They can approve, return it with a comment, or decline it with a reason.", pill: r.open ? `${r.open} here now` : "Clear", tone: r.open ? ("attention" as const) : ("positive" as const) },
          ...(r.second ? [{ label: `3 · ${r.second} confirms`, sub: "A second pair of eyes. Both must agree; either can return it.", pill: "Required", tone: "submitted" as const }] : []),
          { label: `${r.second ? "4" : "3"} · It is applied`, sub: "The module that holds it applies the change, the requester is told, and the whole path is written to the audit log.", pill: "Automatic", tone: "neutral" },
          { label: `If nobody decides within ${dayText(r.escalateDays)}`, sub: `It escalates to ${p.config.escalateTo.replace(/^The /, "the ")}, who is told, and the thread says so.`, pill: "Escalation", tone: "negative" },
        ],
        readOnly: true,
      },
    ],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Recent decisions on this route", sub: "How it has actually behaved, rather than how it is configured.", meta: `Average ${dayText(r.avgDays)} · escalates after ${dayText(r.escalateDays)}`,
      head: ["Request", "Decided by", "Took", "Outcome", "Reason given"], noun: "decision", nounPlural: "decisions", per: 8,
      rows: p.recent.map((entry) => ({ cells: [text(entry.title, { strong: true }), text(entry.by ?? "—"), text(dayText(entry.tookDays)), pill(entry.outcome, entry.outcome === "Approved" ? "positive" : "attention"), text(entry.note ?? "—")], href: itemHref(entry.key) })),
      empty: "Nothing has been decided on this route yet.",
    }],
  });
  const reset = r.overridden ? [{ label: "Reset to the default", drawer: resetRouteDrawer(p) }] : [];
  return {
    content: {
      crumb: { label: "Back to Workflow", href: "/approvals-workflow/workflow" },
      title: r.name, desc: `${r.module} · ${r.why}. ${r.second ? "Two approvals" : "One approval"}, escalating after ${dayText(r.escalateDays)}. ${r.open ? `${plural(r.open, "decision")} waiting on it now.` : "Nothing waiting on it."}`,
      primary: { label: "Edit this route", icon: PEN, drawer: edit },
      launchers: [{ label: "See what is waiting", href: "/approvals-workflow/queue" }, ...reset, { label: "Create a route like this", drawer: createRouteDrawer({ routes: [r], modules: [], approvers: p.options.approvers, rules: [], locked: [], slowest: null, options: p.options }) }],
      rows,
    },
  };
}
