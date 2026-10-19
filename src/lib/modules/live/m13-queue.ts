import { apiGet } from "@/lib/api/server";
import { bulkDrawer, decideDrawer, HUB, itemHref, messageDrawer, routeHref } from "@/lib/modules/live/m13-forms";
import type { ItemPage, ItemView, QueueOverview } from "@/lib/modules/live/m13-types";
import { dayLong, plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Queue — every decision waiting on anyone, read where it lives and decided where it is held. */

export const loadQueue = (query: { scope?: string; type?: string; state?: string } = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return apiGet<QueueOverview>(`${HUB}/queue${params.toString() ? `?${params.toString()}` : ""}`);
};
export const loadItem = (key: string) => apiGet<ItemPage>(`${HUB}/item/${encodeURIComponent(key)}`);

const CHECK = "M5 12.5l4.5 4.5 9-10";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
export const stateTone = (state: string): PanelTone => (state === "Escalated" ? "negative" : state === "In review" ? "submitted" : state === "Approved" ? "positive" : state === "Returned" || state === "Declined" ? "attention" : "attention");
const TYPE_TONE: Record<string, PanelTone> = { SCORE_CORRECTION: "submitted", SCORE_SHEET: "progress", FEE_WAIVER: "attention", RECORD_CHANGE: "neutral", LEAVE: "neutral", ATTENDANCE_CORRECTION: "progress" };
const ageText = (days: number) => (days <= 0 ? "Today" : plural(days, "day"));
export const dueText = (item: Pick<ItemView, "overdue" | "escalatesIn">) => (item.overdue ? (item.escalatesIn < 0 ? `past its period by ${plural(-item.escalatesIn, "day")}` : "past its period") : item.escalatesIn <= 0 ? "escalates today" : `escalates in ${plural(item.escalatesIn, "day")}`);

function rowOf(item: ViewLike): TableRow {
  const sub = [item.evidence ? "Evidence attached" : null, dueText(item)].filter(Boolean).join(" · ");
  return {
    id: item.key,
    keywords: `${item.title} ${item.requester?.name ?? ""} type:${item.type} state:${item.state}`,
    cells: [
      nameCell(item.title, sub),
      pill(item.typeName, TYPE_TONE[item.type] ?? "neutral"),
      item.requester ? nameCell(item.requester.name, item.requester.role) : text("—"),
      item.blocking ? text(item.blocking, { tone: "negative", strong: true }) : text("—"),
      item.overdue ? text(ageText(item.age), { tone: "negative", strong: true }) : text(ageText(item.age)),
      pill(item.state, stateTone(item.state)),
      { kind: "action" as const, label: item.mine ? "Decide" : "Open", href: itemHref(item.key) },
    ],
  };
}
type ViewLike = ItemView;

export function queueTab(o: QueueOverview): TabContent {
  const k = o.kpis;
  const rows: PanelRow[] = [];
  const link = (scope: string) => `/approvals-workflow/queue${scope === "me" ? "" : `?scope=${scope}`}`;
  const first = o.featured;
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "What is waiting", sub: `${plural(k.inFlight, "decision")} in flight across the school`, per: 5,
      cards: [
        { label: "Waiting on me", value: String(k.waiting), sub: "Priority, then age", tone: k.waiting ? "attention" : "positive" },
        { label: "Escalating today", value: String(k.escalating), sub: "Past their routing period", tone: k.escalating ? "negative" : "positive" },
        { label: "Oldest item", value: k.oldest ? ageText(k.oldest.days) : "—", sub: k.oldest ? k.oldest.type : "Nothing is waiting", tone: k.oldest && k.oldest.days > 7 ? "negative" : k.oldest ? "attention" : "positive" },
        { label: "Work blocked", value: String(k.blocked.items), unit: k.blocked.items === 1 ? "decision" : "decisions", sub: k.blocked.text || "Nothing is held up", tone: k.blocked.items ? "negative" : "positive" },
        { label: "Decided this session", value: String(k.decided.count), sub: k.decided.avgDays === null ? "Nothing decided yet" : `Average ${k.decided.avgDays} days`, tone: "positive", link: "Open performance", href: "/approvals-workflow/performance" },
      ],
    }],
  });
  rows.push({ cols: "1fr", panels: [{ type: "days", title: "Whose decisions", sub: "At the scope you are entitled to.", days: [{ label: "Waiting on me", sub: String(k.waiting), href: link("me"), state: o.scope === "me" ? "now" : "plain" }, { label: "Raised by me", sub: String(o.raised.length), href: link("raised"), state: o.scope === "raised" ? "now" : "plain" }, ...(o.canSeeAll ? [{ label: "All · in flight", sub: String(k.inFlight), href: link("all"), state: o.scope === "all" ? ("now" as const) : ("plain" as const) }] : [])] }] });

  if (first) {
    const dec = { key: first.key, title: first.title, typeName: first.typeName, approver: first.approver, second: first.second, step: first.step, requester: first.requester };
    rows.push({
      cols: "1fr",
      panels: [{
        type: "facts", title: first.title, tag: first.blocking ? `Blocking · ${first.blocking}` : first.typeName, tagTone: first.blocking ? "negative" : "neutral",
        sub: "The context needed to judge it — not just the change.",
        meta: `Raised ${first.age <= 0 ? "today" : `${plural(first.age, "day")} ago`} · ${dueText(first)}`,
        acts: [{ label: "Return with a comment", drawer: decideDrawer(dec, "return", null) }, { label: "Open the decision", href: itemHref(first.key) }, { label: "Approve and advance", primary: true, drawer: decideDrawer(dec, "approve", null) }],
        per: 3, facts: first.facts.slice(0, 9),
      }],
    });
  }

  const bulkable = o.list.some((item) => item.bulk);
  const label = o.scope === "me" ? "Waiting on me" : o.scope === "raised" ? "Raised by me" : "All · in flight";
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: label, tag: plural(o.list.length, "item"), tagTone: o.list.length && o.scope === "me" ? "attention" : "neutral",
      sub: "Priority then age, with escalation deadlines. Open one to see the whole decision.",
      meta: `${plural(o.list.length, "decision")} in this view · ${k.decided.count} decided this session`, search: "Find a decision, a person or a type",
      filters: [
        { label: "Type", value: "All", options: ["All", ...o.types.filter((entry) => (o.counts[entry.type] ?? 0) > 0).map((entry) => entry.name)], match: Object.fromEntries(o.types.map((entry) => [entry.name, `type:${entry.type}`])) },
        { label: "State", value: "All", options: ["All", "Awaiting", "In review", "Escalated"], match: { Awaiting: "state:Awaiting", "In review": "state:In review", Escalated: "state:Escalated" } },
      ],
      head: ["Decision", "Type", "Requester", "Blocking", "Age", "State", ""], noun: "decision", nounPlural: "decisions", per: 10, selectable: bulkable && o.scope === "me",
      ...(bulkable && o.scope === "me" ? { bulkActs: [{ label: "Approve the ticked", drawer: bulkDrawer("approve"), selection: { key: "keys", noun: "decision" } }, { label: "Return the ticked", drawer: bulkDrawer("return"), selection: { key: "keys", noun: "decision" } }] } : {}),
      rows: o.list.map(rowOf), empty: o.scope === "me" ? "Nothing is waiting on you." : "Nothing is in this view.",
      foot: "A score correction, a waiver or an access grant is decided one at a time — it cannot be ticked into a batch.",
    }],
  });

  rows.push({
    cols: "1fr 1fr",
    panels: [
      {
        type: "list", title: "Raised by me", sub: "Where everything I submitted currently sits, and who it is waiting on.",
        items: o.raised.map((entry) => ({ label: entry.title, sub: entry.line, pill: entry.state, tone: stateTone(entry.state), viewLabel: "Open", href: itemHref(entry.key) })),
        foot: o.raised.length ? undefined : "Nothing you raised is waiting, and nothing you raised was decided lately.",
      },
      {
        type: "list", title: "How decisions are made here", sub: "The rules above routing, which no route can switch off.",
        items: [
          { label: "Nobody approves their own request", sub: "A person who raised something never sees it as waiting on them.", pill: "Always", tone: "withheld" },
          { label: "A return or a refusal always says why", sub: "It cannot be sent without a reason the requester can read.", pill: "Always", tone: "withheld" },
          { label: "The module that holds it applies it", sub: "A mark, a balance, a record — the queue never writes them itself.", pill: "By design", tone: "neutral" },
          { label: "Past its period, it escalates", sub: "Once, to the person the route names, with a line on the thread.", pill: "Routed", tone: "attention", viewLabel: "See the routes", href: "/approvals-workflow/workflow" },
        ],
      },
    ],
  });

  const next = first ? itemHref(first.key) : undefined;
  return {
    title: "Queue", desc: "Every approval item, at the scope you are entitled to.",
    primary: next ? { label: "Decide the first", icon: CHECK, href: next } : { label: "Nothing waiting on you", icon: CHECK, href: "/approvals-workflow/performance" },
    launchers: [{ label: "How work is routed", href: "/approvals-workflow/workflow" }, { label: "Are decisions being made", href: "/approvals-workflow/performance" }],
    rows,
  };
}

/* ───────────────────────── one decision ───────────────────────── */

export const SECTIONS = [
  { section: "request", label: "Request", path: "" },
  { section: "context", label: "Context", path: "/context" },
  { section: "conversation", label: "Conversation", path: "/conversation" },
] as const;
export type Section = (typeof SECTIONS)[number]["section"];

export type ItemPageView = { content: TabContent & { crumb: { label: string; href: string } }; tabs: Array<{ href: string; label: string; count?: string }> };

const clock = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function itemPage(p: ItemPage, section: Section): ItemPageView {
  const decided = p.decided;
  const dec = { key: p.key, title: p.title, typeName: p.typeName, approver: p.approver, second: p.second, step: p.step, requester: p.requester };
  const rows: PanelRow[] = [];
  if (decided) rows.push({ cols: "1fr", panels: [{ type: "note", tone: decided.outcome === "Approved" ? "positive" : "attention", icon: CHECK, title: `${decided.outcome} by ${decided.by ?? "the system"}`, body: `${dayLong(decided.at)} · it took ${decided.tookDays} ${decided.tookDays === 1 ? "day" : "days"}.${decided.note ? ` “${decided.note}”` : ""}` }] });
  else if (p.overdue) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: p.escalated ? "This has been escalated" : "This is past its routing period", body: `It has waited ${plural(p.age, "day")}; the route escalates after ${plural(p.route.escalateDays, "day")}.` }] });

  if (section === "request") {
    const path = [{ label: "Submitted", sub: p.requester ? p.requester.name : "Raised", state: "done" as const }, { label: p.route.approver, sub: decided ? decided.outcome : p.step === 1 ? "Deciding now" : "Done", state: decided ? ("done" as const) : p.step === 1 ? ("current" as const) : ("done" as const) }, ...(p.route.second ? [{ label: p.route.second, sub: decided ? undefined : p.step === 2 ? "Deciding now" : "Then", state: decided ? ("done" as const) : p.step === 2 ? ("current" as const) : ("todo" as const) }] : []), { label: "Applied", sub: "By the module that holds it", state: decided?.outcome === "Approved" ? ("done" as const) : ("todo" as const) }];
    rows.push({ cols: "1fr", panels: [{ type: "steps", title: "Where it stands", steps: path }] });
    rows.push({ cols: "1fr", panels: [{ type: "facts", title: "The request, in plain language", tag: p.blocking ? `Blocking · ${p.blocking}` : p.typeName, tagTone: p.blocking ? "negative" : "neutral", meta: `Raised ${dayLong(p.requestedAt)} · ${decided ? "decided" : dueText(p)}`, per: 3, facts: p.context.request }] });
    if (!decided) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "A comment is required to return or decline", body: p.next ? "Deciding advances you to the next decision in the queue — working a queue of many should be that many decisions, not that many navigations." : "This is the last decision waiting on you." }] });
  } else if (section === "context") {
    if (p.context.table) rows.push({ cols: "1fr", panels: [{ type: "table", title: p.context.table.title, sub: p.context.table.sub, head: p.context.table.head, noun: "row", nounPlural: "rows", noRowOpen: true, rows: p.context.table.rows.map((cells) => ({ cells: cells.map((value, index) => (index === 0 ? text(value, { strong: true }) : text(value, { mono: index < cells.length - 1 }))) })) }] });
    rows.push({ cols: "1fr 1fr", panels: [
      { type: "facts", title: "Downstream effect", sub: "What deciding it does, either way.", per: 1, facts: p.context.downstream.length ? p.context.downstream : [["What it blocks", p.blocking ?? "Nothing is recorded as blocked"]] },
      { type: "facts", title: "Evidence and standing", sub: "Attached at the point of request.", per: 1, facts: [...p.context.evidence, ...(p.context.context.length ? p.context.context : []), ["Route", `${p.route.approver}${p.route.second ? ` then ${p.route.second}` : ""}`, `Escalates after ${plural(p.route.escalateDays, "day")} · ${p.route.bulk ? "may be bulk-approved" : "never bulk-approved"}`]] },
    ] });
  } else {
    rows.push({
      cols: "1fr",
      panels: [{
        type: "list", title: "Threaded conversation", sub: "Every message on this decision, in order.",
        acts: p.can.comment ? [{ label: "Write a message", primary: true, drawer: messageDrawer(p) }] : [],
        items: [
          { label: `${p.requester?.name ?? "Raised"} · ${clock(p.requestedAt)}`, sub: p.summary ?? p.title, pill: "Request", tone: "neutral" },
          ...p.messages.map((message) => ({ label: `${message.by ?? "The queue"} · ${clock(message.at)}`, sub: message.body, pill: message.kind === "SYSTEM" ? "Queue" : message.role ?? "Comment", tone: (message.kind === "SYSTEM" ? "attention" : message.mine ? "progress" : "neutral") as PanelTone })),
          ...(decided ? [{ label: `${decided.by ?? "Decided"} · ${clock(decided.at)}`, sub: `${decided.outcome}${decided.note ? ` — ${decided.note}` : ""}`, pill: decided.outcome, tone: stateTone(decided.outcome) }] : [{ label: "Awaiting a decision", sub: p.can.decide ? "A comment is required to return or decline." : `Waiting on the ${p.approver}.`, pill: "Awaiting", tone: "attention" as PanelTone }]),
        ],
      }],
    });
  }

  const nextHref = p.next ? itemHref(p.next) : undefined;
  return {
    content: {
      crumb: { label: "Back to the queue", href: "/approvals-workflow/queue" },
      title: p.title, desc: `${p.typeName}${p.requester ? ` · raised by ${p.requester.name}` : ""} · ${decided ? `${decided.outcome.toLowerCase()} ${dayLong(decided.at)}` : `${ageText(p.age)} old${p.position ? ` · ${p.position} of ${p.of} waiting on you` : ""}`}.`,
      primary: p.can.decide && !decided ? { label: p.next ? "Approve and advance" : "Approve", icon: CHECK, drawer: decideDrawer(dec, "approve", p.next) } : { label: "Back to the queue", icon: CHECK, href: "/approvals-workflow/queue" },
      launchers: [
        ...(p.can.decide && !decided ? [{ label: "Return with a comment", drawer: decideDrawer(dec, "return", p.next) }, { label: "Decline with a reason", drawer: decideDrawer(dec, "decline", p.next) }] : []),
        { label: `Open it in ${p.typeName.toLowerCase()}`, href: p.href },
        { label: "See the route", href: routeHref(p.type) },
        ...(nextHref ? [{ label: "Skip to the next", href: nextHref }] : []),
      ],
      rows,
    },
    tabs: SECTIONS.map((entry) => ({ href: itemHref(p.key, entry.path.slice(1)), label: entry.label, ...(entry.section === "conversation" && p.messages.length ? { count: String(p.messages.length) } : {}) })),
  };
}
