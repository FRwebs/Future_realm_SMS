import type { ItemPage, ItemView, RoutePage, RouteRow, RuleRow, WorkflowData } from "@/lib/modules/live/m13-types";
import { area, checks, choice, fixed, select, text, toggle } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { DrawerSpec } from "@/lib/modules/panels";

/** Every modal in Approvals & Workflow, as data. */

export const HUB = "/api/v1/approvals-hub";

export const itemHref = (key: string, section = "") => `/approvals-workflow/queue/${encodeURIComponent(key)}${section ? `/${section}` : ""}`;
export const routeHref = (type: string) => `/approvals-workflow/workflow/${encodeURIComponent(type)}`;
const days = (value: number) => `${value} ${value === 1 ? "day" : "days"}`;
const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));

/* ───────────────────────── deciding ───────────────────────── */

type Deciding = Pick<ItemView, "key" | "title" | "typeName" | "approver" | "second" | "step"> & { requester: { name: string } | null };

/** Approve, return or decline one decision — the comment is required for everything but an approval. */
export function decideDrawer(item: Deciding, decision: "approve" | "return" | "decline", next: string | null): DrawerSpec {
  const approve = decision === "approve";
  const verb = approve ? "Approve" : decision === "return" ? "Return" : "Decline";
  return {
    mode: "form",
    kicker: item.typeName,
    title: `${verb} · ${item.title}`,
    sub: approve ? "The module that holds this decision applies it, and the person who asked is told." : decision === "return" ? "It goes back to the person who raised it, with what you write." : "It is refused, and the person who asked reads your reason.",
    commitLabel: approve ? "Approve and advance" : decision === "return" ? "Return it" : "Decline it",
    commitDone: approve ? "Approved" : decision === "return" ? "Returned" : "Declined",
    commitDoneBody: approve ? "The decision has been applied where it lives." : "The requester has been told why.",
    reviewNote: approve ? "A decision is written to the audit log under your name." : "A return or a refusal without a reason cannot be acted on — so it cannot be sent without one.",
    fields: [
      fixed("Decision", item.title, { span: 2, hint: `${item.typeName}${item.requester ? ` · raised by ${item.requester.name}` : ""}` }),
      area(approve ? "Comment" : "What you want them to know", { span: 2, required: !approve, optional: approve, placeholder: approve ? "Optional — kept with the decision." : "Written to them in your own words." }),
    ],
    next: next ? { label: "Open the next decision", href: itemHref(next) } : { label: "Back to the queue", href: "/approvals-workflow/queue" },
    submit: { endpoint: `${HUB}/item/${encodeURIComponent(item.key)}/decide`, method: "POST", body: { decision }, map: { Comment: "note", "What you want them to know": "note" } },
  };
}

export function bulkDrawer(decision: "approve" | "return"): DrawerSpec {
  const approve = decision === "approve";
  return {
    mode: "form",
    kicker: "Queue",
    title: approve ? "Approve the ticked decisions" : "Return the ticked decisions",
    sub: "Up to 20 at a time. Anything that is decided one at a time — a score correction, a waiver — is left for you, and named.",
    commitLabel: approve ? "Approve them" : "Return them",
    commitDone: approve ? "Decisions approved" : "Decisions returned",
    commitDoneBody: "Each one was decided by its own module, under your name.",
    reviewNote: "A bulk decision is still logged one decision at a time.",
    fields: [area("Comment", { span: 2, required: !approve, optional: approve, placeholder: approve ? "Optional — kept with every decision." : "Sent with every one you return." })],
    submit: { endpoint: `${HUB}/bulk`, method: "POST", body: { decision }, map: { Comment: "note" } },
  };
}

export function messageDrawer(item: Pick<ItemPage, "key" | "title" | "requester" | "approver">): DrawerSpec {
  return {
    mode: "form",
    kicker: "Conversation",
    title: `Write on · ${item.title}`,
    sub: "Everyone on this decision reads it, in order, with the rest of the thread.",
    commitLabel: "Send it",
    commitDone: "Message sent",
    commitDoneBody: "It is on the thread, and the other side has been told.",
    fields: [area("Message", { span: 2, required: true, placeholder: "Ask what you need to know, or say what you found." })],
    submit: { endpoint: `${HUB}/item/${encodeURIComponent(item.key)}/messages`, method: "POST", map: { Message: "text" } },
  };
}

/* ───────────────────────── routes ───────────────────────── */

const SECOND = (labels: string[]) => ["Not required", ...labels];

/** Editing a route starts from what exists — a routing screen that opens on blank fields is how a school loses its chain. */
export function editRouteDrawer(page: RoutePage): DrawerSpec {
  const { route, config, options } = page;
  return {
    mode: "form",
    kicker: "Workflow · route",
    title: `Edit · ${route.name}`,
    sub: "What exists today, then what you change.",
    commitLabel: "Save the route",
    commitDone: "Route saved",
    commitDoneBody: "The queue reads it from now on. Decisions already made are untouched.",
    reviewNote: "Changing a route never changes a decision already taken. It changes who the queue offers the next ones to, and when it escalates them.",
    fields: [
      fixed("What exists today", `${route.approver}${route.second ? `, then ${route.second}` : " alone"} · escalates after ${days(route.escalateDays)}`, { span: 2, hint: `${route.overridden ? "Your own route" : "The default"} · ${plural(route.open, "decision")} waiting on it now${route.avgDays === null ? "" : ` · averages ${route.avgDays} days`}` }),
      fixed("What it blocks while it waits", route.blocks, { span: 2 }),
      select("Approver", options.approvers, { value: config.approver, required: true, hint: "A role, never a person — a role survives a resignation." }),
      select("Second approver", SECOND(options.approvers), { value: config.second || "Not required", hint: "Only for decisions that are irreversible or involve money." }),
      select("Escalates after", options.days.map(days), { value: days(config.escalateDays), required: true }),
      select("Escalates to", options.escalateTo, { value: config.escalateTo, required: true }),
      toggle("Evidence required", config.evidence, "A request without evidence is worth a question", "Evidence optional", { span: 2, hint: "Recorded for the route. Each module's own form decides what it asks for." }),
      choice("Bulk approval", route.locked ? ["Never — locked for this type"] : ["Never", "Up to 20 at a time"], { span: 2, value: route.locked ? "Never — locked for this type" : config.bulk ? "Up to 20 at a time" : "Never", hint: route.locked ? "This type can never be bulk-approved, whatever is set here." : "Used by the queue's bulk bar." }),
      select("Who may submit", options.who, { value: config.who }),
      select("Notify the requester", options.notify, { value: config.notify, hint: "Recorded for the route." }),
    ],
    submit: { endpoint: `/api/v1/approvals-hub/routes/${encodeURIComponent(route.type)}`, method: "PUT", map: { Approver: "approver", "Second approver": "second", "Escalates after": "escalateDays", "Escalates to": "escalateTo", "Evidence required": "evidence", "Bulk approval": "bulk", "Who may submit": "who", "Notify the requester": "notify" }, encode: { "Escalates after": Object.fromEntries(options.days.map((value) => [days(value), String(value)])) } },
  };
}

export function createRouteDrawer(data: WorkflowData): DrawerSpec {
  const labels = data.routes.map((route) => ({ value: route.type, label: route.name }));
  return {
    mode: "form",
    kicker: "Workflow",
    title: "Create an approval route",
    sub: "Each kind of decision has one route. Setting one here replaces the default for it.",
    commitLabel: "Create the route",
    commitDone: "Route created",
    commitDoneBody: "It is your own route for that kind of decision from now on, and can be reset to the default any time.",
    reviewNote: "Decisions already waiting are not moved. They keep deciding under the route they were raised under.",
    fields: [
      select("Approval type", labels.map((entry) => entry.label), { required: true, span: 2, hint: "Every kind the school decides, whichever module raises it." }),
      select("Approver", data.options.approvers, { required: true, hint: "A role, never a person." }),
      select("Second approver", SECOND(data.options.approvers), { hint: "Only for decisions that are irreversible or involve money." }),
      select("Escalates after", data.options.days.map(days), { value: days(5), required: true }),
      select("Escalates to", data.options.escalateTo, { required: true }),
      toggle("Evidence required", false, "A request without evidence is worth a question", "Evidence optional", { span: 2 }),
      choice("Bulk approval", ["Never", "Up to 20 at a time"], { span: 2, hint: "Types that change a number a family has seen, or money, stay locked whatever is chosen." }),
      select("Who may submit", data.options.who),
      select("Notify the requester", data.options.notify),
    ],
    submit: { endpoint: `${HUB}/routes`, method: "POST", map: { "Approval type": "type", Approver: "approver", "Second approver": "second", "Escalates after": "escalateDays", "Escalates to": "escalateTo", "Evidence required": "evidence", "Bulk approval": "bulk", "Who may submit": "who", "Notify the requester": "notify" }, encode: { "Approval type": pair(labels), "Escalates after": Object.fromEntries(data.options.days.map((value) => [days(value), String(value)])) } },
  };
}

export function resetRouteDrawer(page: RoutePage): DrawerSpec {
  const { route, defaults } = page;
  return {
    mode: "commit",
    kicker: "Workflow",
    title: `Reset ${route.name} to the default`,
    sub: "Your own route is removed; the default takes its place.",
    facts: [
      ["Route", route.name, route.module],
      ["Your route", `${route.approver}${route.second ? ` then ${route.second}` : ""}`, `Escalates after ${days(route.escalateDays)}`],
      ["The default", `${defaults.approver}${defaults.second ? ` then ${defaults.second}` : ""}`, `Escalates after ${days(defaults.escalateDays)}`],
      ["Decisions waiting", String(route.open), route.open ? "They are offered to whoever the default names" : "Nothing is affected"],
      ["Reversible", "Yes, any time", ""],
    ],
    commitLabel: "Reset it",
    commitDone: "Route reset",
    commitDoneBody: `${route.name} is back on the default route.`,
    submit: { endpoint: `${HUB}/routes/${encodeURIComponent(route.type)}`, method: "DELETE" },
  };
}

export function changeApproverDrawer(options: WorkflowData["options"]): DrawerSpec {
  return {
    mode: "form",
    kicker: "Workflow",
    title: "Change the approver",
    sub: "Every route you ticked is moved to this role. The second approver and the period are left alone.",
    commitLabel: "Change the approver",
    commitDone: "Approver changed",
    commitDoneBody: "The queue offers each route's next decisions to the role you chose.",
    fields: [select("Approver", options.approvers, { required: true })],
    submit: { endpoint: `${HUB}/routes/bulk`, method: "POST", map: { Approver: "approver" } },
  };
}

export function changeEscalationDrawer(options: WorkflowData["options"]): DrawerSpec {
  return {
    mode: "form",
    kicker: "Workflow",
    title: "Change the escalation period",
    sub: "How long each ticked route may sit before it escalates.",
    commitLabel: "Change the period",
    commitDone: "Period changed",
    commitDoneBody: "Anything past the new period is escalated the next time the queue is read.",
    fields: [select("Escalates after", options.days.map(days), { value: days(5), required: true })],
    submit: { endpoint: `${HUB}/routes/bulk`, method: "POST", map: { "Escalates after": "escalateDays" }, encode: { "Escalates after": Object.fromEntries(options.days.map((value) => [days(value), String(value)])) } },
  };
}

export const resetManyDrawer = (): DrawerSpec => ({
  mode: "commit",
  kicker: "Workflow",
  title: "Reset the ticked routes to their defaults",
  sub: "Your own routes are removed; the defaults take their place.",
  facts: [["Effect", "Back to the default approver and period", "A route that was already the default is left as it is"], ["Decisions waiting", "Keep deciding", "They are offered to whoever the default names"], ["Reversible", "Yes, any time", ""]],
  commitLabel: "Reset them",
  commitDone: "Routes reset",
  commitDoneBody: "Each is back on its default.",
  submit: { endpoint: `${HUB}/routes/bulk`, method: "POST", body: { reset: true } },
});

/* ───────────────────────── standing rules ───────────────────────── */

export function createRuleDrawer(options: WorkflowData["options"]): DrawerSpec {
  return {
    mode: "form",
    kicker: "Workflow · standing rule",
    title: "Create a standing rule",
    sub: "A decision the school has agreed needs no human at all.",
    commitLabel: "Create the rule",
    commitDone: "Rule created",
    commitDoneBody: "It decides the next small change by itself, says so on the record, and counts every firing.",
    reviewNote: "A standing rule decides with no person present. It is logged every time, and it can be revoked at once.",
    fields: [
      text("Name", { required: true, span: 2, placeholder: "Auto-approve spelling corrections to names" }),
      fixed("What it decides", "Record changes only", { span: 2, hint: "A change to a student's record so small it can only be a correction. Nothing involving money, marks or access can be made a standing rule." }),
      checks("Fields it covers", options.ruleFields, ["Given name", "Surname"], { required: true, span: 2 }),
      select("A change of at most", ["1 character", "2 characters", "3 characters", "4 characters", "5 characters"], { value: "3 characters", required: true, hint: "Counted as the characters that differ — a letter added, dropped or changed." }),
      area("Why the school agreed this", { span: 2, required: true, placeholder: "Read in the log whenever the rule fires." }),
    ],
    submit: { endpoint: `${HUB}/rules`, method: "POST", map: { Name: "name", "Fields it covers": "fields", "A change of at most": "maxChars", "Why the school agreed this": "why" }, encode: { "A change of at most": Object.fromEntries([1, 2, 3, 4, 5].map((value) => [`${value} ${value === 1 ? "character" : "characters"}`, String(value)])) } },
  };
}

export function ruleStateDrawer(rule: RuleRow): DrawerSpec {
  const revoke = rule.state === "Active";
  return {
    mode: "commit",
    kicker: "Standing rule",
    title: `${revoke ? "Revoke" : "Reinstate"} · ${rule.name}`,
    sub: revoke ? "From now on, what it covered waits for a person again." : "It decides what it covers by itself again.",
    facts: [["Rule", rule.name, `${rule.fields.join(", ")} · at most ${rule.maxChars} ${rule.maxChars === 1 ? "character" : "characters"}`], ["Fired so far", String(rule.fired), "Every one is in the audit log"], ["Created by", rule.by, rule.why], ["Reversible", "Yes, instantly", ""]],
    commitLabel: revoke ? "Revoke it" : "Reinstate it",
    commitDone: revoke ? "Rule revoked" : "Rule reinstated",
    commitDoneBody: revoke ? "It no longer fires." : "It fires again from the next change.",
    submit: { endpoint: `${HUB}/rules/${encodeURIComponent(rule.code ?? rule.id)}/${revoke ? "revoke" : "reinstate"}`, method: "POST" },
  };
}

export type { RouteRow };
