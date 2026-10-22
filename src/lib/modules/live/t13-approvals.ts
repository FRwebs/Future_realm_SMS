import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { itemHref } from "@/lib/modules/live/m13-forms";
import { loadQueue } from "@/lib/modules/live/m13-queue";
import type { QueueOverview } from "@/lib/modules/live/m13-types";
import type { PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M13 for a teaching person: the decisions routed to them (a head of department decides what their own department submits — and never
 * their own), and what they have raised. The queue is the same one the school runs; this is the part of it that is theirs.
 */

const CHECK = "m4.5 12.5 4.5 4.5 9-10";
const SHIELD = "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z";

const state = (value: string): PanelTone => (value === "Escalated" || value === "Returned" || value === "Declined" ? "negative" : value === "Approved" ? "positive" : value === "In review" ? "progress" : "submitted");
const escalates = (days: number, overdue: boolean) => (overdue ? "Now" : days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);

export async function teacherApprovalsTab(tabSlug: string, me: TeacherWorkspaceView): Promise<TabContent | null | undefined> {
  if (tabSlug !== "queue") return undefined;
  return queueTab(await loadQueue({ scope: "me" }), me);
}

function queueTab(o: QueueOverview, me: TeacherWorkspaceView): TabContent {
  const k = o.kpis;
  const waiting = o.waiting;
  const first = waiting[0];
  const dept = me.department?.name ?? "your department";
  const routed: TableRow[] = waiting.map((item) => ({
    keywords: `${item.title} ${item.requester?.name ?? ""} ${item.typeName}`,
    cells: [
      text(item.title, { strong: true }), { kind: "name", name: item.requester?.name ?? "—", sub: item.requester?.role ?? "" }, text(item.age <= 0 ? "Today" : `${item.age} day${item.age === 1 ? "" : "s"}`),
      text(escalates(item.escalatesIn, item.overdue), { strong: item.overdue || item.escalatesIn <= 1, tone: item.overdue || item.escalatesIn <= 1 ? "negative" : undefined }), pill(item.state, state(item.state)),
      { kind: "action", label: "Decide", href: itemHref(item.key) },
    ] as TableCellKind[],
  }));
  const raised: TableRow[] = o.raised.map((entry) => ({
    cells: [text(entry.title, { strong: true }), text(entry.line, { tone: "neutral" }), pill(entry.state, state(entry.state)), { kind: "action", label: "Open", href: itemHref(entry.key) }] as TableCellKind[],
  }));
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: me.persona === "head-of-department" ? `You hold approval for ${dept} submissions, and for nothing else.` : "You hold approval for what is routed to you, and for nothing else.", per: 4,
      cards: [
        { label: "Waiting on you", value: String(k.waiting), sub: k.oldest ? `The oldest is ${k.oldest.days} day${k.oldest.days === 1 ? "" : "s"} old` : "Nothing is waiting", tone: k.waiting ? "attention" : "positive" },
        { label: "Escalating", value: String(k.escalating), sub: k.escalating ? "Past their routing period" : "Nothing is overdue", tone: k.escalating ? "negative" : "positive" },
        { label: "Raised by you", value: String(o.raised.length), sub: o.raised.length ? "Where each one sits is below" : "Nothing raised", tone: o.raised.length ? "progress" : "neutral" },
        { label: "Decided this term", value: String(k.decided.count), sub: k.decided.avgDays === null ? "Nothing decided yet" : `Average ${k.decided.avgDays} days` },
      ],
    }]),
    row("1fr", [{
      type: "table", title: "Routed to you", tag: `${waiting.length} item${waiting.length === 1 ? "" : "s"}`, tagTone: waiting.length ? "attention" : "positive", sub: "Three outcomes only: approve, return, or decline.", meta: dept, noun: "item", nounPlural: "items",
      head: ["Item", "Raised by", "Waiting", "Escalates", "State", ""], rows: routed, noRowOpen: true, empty: "Nothing is waiting on you.", foot: "Week-by-week lesson notes are signed in Lesson Notes · Review, where the coverage behind them is visible.",
    }]),
    row("1.1fr 1fr", [
      { type: "table", title: "Raised by you", sub: "What you are waiting on somebody else for.", meta: `${o.raised.length} item${o.raised.length === 1 ? "" : "s"}`, noun: "item", nounPlural: "items", head: ["Item", "With", "State", ""], rows: raised, noRowOpen: true, empty: "You have raised nothing that is still open.", foot: "Your own submissions never appear in your own queue." },
      { type: "note", tone: "withheld", icon: SHIELD, title: "Where you are the only approver, the item escalates", body: "It never silently self-approves. Segregation of duties is enforced where the decision is made, not by policy." },
    ]),
  ];
  return {
    title: "Queue", desc: "Routed to you, and what you have raised.",
    primary: first ? { label: "Decide the oldest", icon: CHECK, href: itemHref(first.key) } : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}
