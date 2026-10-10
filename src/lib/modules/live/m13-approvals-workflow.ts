import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type PanelFact,
  type PanelTone,
  type TabContent,
} from "@/lib/modules/panels";

/**
 * M13 Approvals & Workflow, read from `GET /v1/approvals/queue`.
 *
 * The queue is the single table every decision in the school lands in, so this
 * module is the one place all six kinds are visible together rather than spread
 * across the five tables that used to hold them.
 *
 * Its decisions are real commands: PATCH /v1/approvals/:id/decision takes an
 * action and a note, and the API refuses a return or a rejection that carries
 * no reason — so the drawer asks for one before it will send.
 */

type ApprovalRow = {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string | null;
  title: string;
  summary: string | null;
  blocking: string | null;
  priority: number;
  status: string;
  requestedBy: string | null;
  requestedByRole: string | null;
  assignedTo: string | null;
  assigneeRole: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  escalatesAt: string | null;
  ageDays: number;
  overdue: boolean;
  raisedAt: string;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function statusTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "PENDING":
      return "attention";
    case "REJECTED":
    case "RETURNED":
      return "negative";
    default:
      return "neutral";
  }
}

function ageText(days: number): string {
  if (days <= 0) return "today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function facts(row: ApprovalRow): PanelFact[] {
  return [
    ["Kind", readable(row.kind)],
    ["About", `${row.subjectType}${row.subjectId ? ` · ${row.subjectId}` : ""}`],
    ["Raised by", `${row.requestedBy ?? "—"}${row.requestedByRole ? ` (${readable(row.requestedByRole)})` : ""}`],
    ["Raised", whenLabel(row.raisedAt)],
    ["Waiting", ageText(row.ageDays)],
    ["Assigned to", row.assignedTo ?? (row.assigneeRole ? readable(row.assigneeRole) : "unassigned")],
    ["Blocking", row.blocking ?? "nothing recorded"],
    ["Escalates", row.escalatesAt ? whenLabel(row.escalatesAt) : "no deadline set"],
    ["Status", readable(row.status)],
    ["Decision note", row.decisionNote || "none"],
  ];
}

/** The three things the API will accept, each as its own drawer. */
function decisionCell(row: ApprovalRow, action: "APPROVE" | "RETURN" | "REJECT") {
  const copy = {
    APPROVE: {
      label: "Approve",
      note: "Approving records you as the decider, with a timestamp. You cannot approve a request you raised yourself.",
      done: "Approved",
      required: false,
    },
    RETURN: {
      label: "Return",
      note: "Returning sends this back to whoever raised it. The API will not accept a return without a reason.",
      done: "Returned",
      required: true,
    },
    REJECT: {
      label: "Reject",
      note: "Rejecting closes this for good. The API will not accept a rejection without a reason.",
      done: "Rejected",
      required: true,
    },
  }[action];

  return {
    kind: "action" as const,
    label: copy.label,
    drawer: {
      kicker: readable(row.kind),
      title: row.title,
      sub: row.summary ?? undefined,
      mode: "commit" as const,
      commitLabel: copy.label,
      commitNote: copy.note,
      commitDone: copy.done,
      commitDoneBody: "The queue and the counts above it have been re-read.",
      facts: facts(row),
      submit: {
        endpoint: `/api/v1/approvals/${row.id}/decision`,
        method: "PATCH" as const,
        body: { action },
        reasonKey: "note",
        reasonLabel: copy.required ? "Why (required)" : "Note (kept on the decision)",
        reasonRequired: copy.required,
      },
    },
  };
}

function queueTab(rows: ApprovalRow[], waiting: number): TabContent {
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");
  const overdue = pending.filter((row) => row.overdue);
  const unassigned = pending.filter((row) => !row.assignedTo && !row.assigneeRole);
  const kinds = new Map<string, number>();
  for (const row of pending) kinds.set(readable(row.kind), (kinds.get(readable(row.kind)) ?? 0) + 1);

  const queuePanel = pending.length
    ? {
        type: "table" as const,
        title: "Waiting on a decision",
        sub: "Priority first, then age — the order these should be worked in.",
        meta: `${pending.length} pending · ${overdue.length} overdue`,
        head: ["Decision", "Kind", "Raised by", "Blocking", "Age", "", ""],
        per: 10,
        rows: pending.map((row) => ({
          cells: [
            nameCell(row.title, row.summary ?? ""),
            pill(readable(row.kind), "neutral"),
            text(row.requestedBy ?? "—"),
            text(row.blocking ?? "—", {
              tone: row.blocking ? "attention" : undefined,
              strong: Boolean(row.blocking),
            }),
            text(ageText(row.ageDays), {
              tone: row.overdue ? "negative" : undefined,
              strong: row.overdue,
            }),
            decisionCell(row, "APPROVE"),
            decisionCell(row, "RETURN"),
          ],
          keywords: `${row.title} ${row.kind} ${row.requestedBy ?? ""}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "positive" as const,
        icon: CHECK_ICON,
        title: "Nothing is waiting on a decision",
        body:
          rows.length === 0
            ? "No decision has ever been raised on this school. Services raise them here as they need one — a score correction, a fee waiver, a record change, an access grant, a communication above the threshold, or leave."
            : `All ${rows.length} decisions on file have been settled. They stay listed below for the record.`,
      };

  const decided = rows.filter((row) => row.status.toUpperCase() !== "PENDING");

  return {
    title: "Queue",
    desc: "Every decision in the school, in one place.",
    launchers: [{ label: "Command Center", href: "/command-center/today" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What is in flight",
            per: 4,
            cards: [
              {
                label: "Waiting on you",
                value: String(waiting),
                sub: "Named to you, or to a role you hold",
                tone: waiting ? "attention" : "positive",
              },
              {
                label: "Pending in total",
                value: String(pending.length),
                sub: `Across ${kinds.size} kind${kinds.size === 1 ? "" : "s"}`,
                tone: pending.length ? "attention" : "positive",
              },
              {
                label: "Overdue",
                value: String(overdue.length),
                sub: overdue.length ? "Past their escalation date" : "Nothing has escalated",
                tone: overdue.length ? "negative" : "positive",
              },
              {
                label: "Unassigned",
                value: String(unassigned.length),
                sub: unassigned.length ? "Nobody has been named" : "Everything has an owner",
                tone: unassigned.length ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      { cols: "1fr", panels: [queuePanel] },
      {
        cols: "1fr",
        panels: [
          decided.length
            ? {
                type: "table",
                title: "Decided",
                sub: "What was settled, by whom, and why.",
                meta: `${decided.length} settled`,
                head: ["Decision", "Kind", "Outcome", "By", "When", "Reason"],
                per: 10,
                rows: decided.map((row) => ({
                  cells: [
                    nameCell(row.title, row.summary ?? ""),
                    pill(readable(row.kind), "neutral"),
                    pill(readable(row.status), statusTone(row.status)),
                    text(row.decidedBy ?? "—"),
                    text(whenLabel(row.decidedAt)),
                    text(row.decisionNote || "—", {
                      tone: row.decisionNote ? undefined : "attention",
                    }),
                  ],
                  keywords: `${row.title} ${row.status} ${row.decidedBy ?? ""}`,
                })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "Nothing has been decided yet",
                body: "Once a decision is approved, returned or rejected it stays here with its reason, so a refusal can always be read back.",
              },
        ],
      },
    ],
  };
}


/**
 * M13 · Workflow, derived from the queue rather than from a rules table.
 *
 * Nothing persists a routing rule — the service names an assignee or a role at
 * the moment a decision is raised. So the honest thing this tab can show is the
 * routing that has actually happened: which kinds exist, who they went to, and
 * whether any arrived with nobody named. A page that drew an editable rules
 * engine would be describing something that does not exist.
 */
function workflowTab(rows: ApprovalRow[]): TabContent {
  const kinds = new Map<string, { total: number; toRole: number; toPerson: number; orphan: number }>();
  for (const row of rows) {
    const key = readable(row.kind);
    const entry = kinds.get(key) ?? { total: 0, toRole: 0, toPerson: 0, orphan: 0 };
    entry.total += 1;
    if (row.assignedTo) entry.toPerson += 1;
    else if (row.assigneeRole) entry.toRole += 1;
    else entry.orphan += 1;
    kinds.set(key, entry);
  }

  const orphans = rows.filter((row) => !row.assignedTo && !row.assigneeRole);
  const escalating = rows.filter((row) => row.escalatesAt);

  return {
    title: "Workflow",
    desc: "How decisions are routed, as they have actually been routed.",
    launchers: [{ label: "Queue", href: "/approvals-workflow/queue" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "neutral",
            title: "Routing is decided when a decision is raised, not configured here",
            body: "No rules table exists: the service that raises a decision names the person or the role it should go to, in code, at that moment. What follows is the routing that has happened on this school — not a configuration anybody can change from this page.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "How decisions have been routed",
            per: 4,
            cards: [
              { label: "Kinds seen", value: String(kinds.size), sub: `of ${rows.length} decisions` },
              {
                label: "Routed to a role",
                value: String(rows.filter((row) => !row.assignedTo && row.assigneeRole).length),
                sub: "Reaches whoever holds it",
                tone: "positive",
              },
              {
                label: "Routed to a person",
                value: String(rows.filter((row) => row.assignedTo).length),
                sub: "Stops if they are away",
                tone: rows.filter((row) => row.assignedTo).length ? "attention" : undefined,
              },
              {
                label: "With an escalation date",
                value: String(escalating.length),
                sub: escalating.length ? "Will be flagged overdue" : "None will ever escalate",
                tone: escalating.length ? undefined : "attention",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          orphans.length
            ? {
                type: "note",
                tone: "negative",
                title: `${orphans.length} decision${orphans.length === 1 ? "" : "s"} arrived with nobody named`,
                body: "A decision routed to neither a person nor a role sits in the queue and waits for somebody to notice it. That is the failure mode the queue was built to make visible.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every decision has an owner",
                body: "Each one names either a person or a role that somebody holds.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          kinds.size
            ? {
                type: "table",
                title: "Routing by kind",
                sub: "What has been raised, and where it was sent.",
                head: ["Kind", "Raised", "To a role", "To a person", "Unrouted"],
                per: 10,
                rows: Array.from(kinds.entries())
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([kind, entry]) => ({
                    cells: [
                      text(kind, { strong: true }),
                      text(String(entry.total)),
                      text(String(entry.toRole), { tone: entry.toRole ? "positive" : undefined }),
                      text(String(entry.toPerson)),
                      text(String(entry.orphan), {
                        tone: entry.orphan ? "negative" : undefined,
                        strong: entry.orphan > 0,
                      }),
                    ],
                    keywords: kind,
                  })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No decision has been raised",
                body: "There is no routing to describe until something needs deciding.",
              },
        ],
      },
    ],
  };
}

/**
 * M13 · Performance — how long decisions take.
 *
 * Only settled decisions can be timed, so the tab says how many of them it is
 * speaking for. An average drawn from one decision is not a measurement, and
 * the page should not present it as one.
 */
function performanceTab(rows: ApprovalRow[]): TabContent {
  const settled = rows.filter((row) => row.status.toUpperCase() !== "PENDING" && row.decidedAt);
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");

  const durations = settled.map((row) => {
    const raised = new Date(row.raisedAt).getTime();
    const decided = new Date(row.decidedAt as string).getTime();
    return Math.max(0, Math.round((decided - raised) / 3_600_000));
  });
  const average = durations.length
    ? Math.round(durations.reduce((sum, hours) => sum + hours, 0) / durations.length)
    : null;
  const slowest = durations.length ? Math.max(...durations) : null;
  const oldestWaiting = pending.length ? Math.max(...pending.map((row) => row.ageDays)) : 0;

  const outcomes = new Map<string, number>();
  for (const row of settled) outcomes.set(readable(row.status), (outcomes.get(readable(row.status)) ?? 0) + 1);

  function hoursLabel(hours: number | null): string {
    if (hours === null) return "—";
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"}`;
  }

  return {
    title: "Performance",
    desc: "How long decisions take, and how many of them that is measured on.",
    launchers: [{ label: "Queue", href: "/approvals-workflow/queue" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Time to a decision",
            per: 4,
            cards: [
              {
                label: "Decisions settled",
                value: String(settled.length),
                sub: settled.length ? "What everything below is measured on" : "Nothing to measure yet",
                tone: settled.length ? undefined : "attention",
              },
              {
                label: "Average time",
                value: hoursLabel(average),
                sub: settled.length < 5 ? "Too few to be a trend" : "From raised to decided",
                tone: settled.length < 5 ? "attention" : undefined,
              },
              { label: "Slowest", value: hoursLabel(slowest), sub: "Longest single decision" },
              {
                label: "Oldest still waiting",
                value: pending.length ? `${oldestWaiting} day${oldestWaiting === 1 ? "" : "s"}` : "—",
                sub: pending.length ? `${pending.length} pending` : "Nothing outstanding",
                tone: pending.length ? "attention" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          settled.length < 5
            ? {
                type: "note",
                tone: "attention",
                title:
                  settled.length === 0
                    ? "No decision has been settled, so there is nothing to time"
                    : `These figures are drawn from ${settled.length} settled decision${settled.length === 1 ? "" : "s"}`,
                body:
                  settled.length === 0
                    ? "Time-to-decision can only be measured once something has been decided. Until then this page can describe what is waiting, and nothing about how fast this school answers."
                    : "An average over a handful of decisions is a number, not a trend. It is shown because it is true, and labelled because it would be misleading to read it as a service level.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: `Measured across ${settled.length} settled decisions`,
                body: "Enough to read as a pattern rather than an anecdote.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          settled.length
            ? {
                type: "table",
                title: "Settled decisions",
                sub: "Slowest first.",
                meta: `${settled.length} settled · ${pending.length} still open`,
                head: ["Decision", "Kind", "Outcome", "Decided by", "Took"],
                per: 10,
                rows: settled
                  .map((row, index) => ({ row, hours: durations[index] ?? 0 }))
                  .sort((a, b) => b.hours - a.hours)
                  .map(({ row, hours }) => ({
                    cells: [
                      nameCell(row.title, row.summary ?? ""),
                      pill(readable(row.kind), "neutral"),
                      pill(readable(row.status), statusTone(row.status)),
                      text(row.decidedBy ?? "—"),
                      text(hoursLabel(hours), { strong: true }),
                    ],
                    keywords: `${row.title} ${row.status}`,
                  })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "Nothing has been decided yet",
                body: "The table fills as decisions are settled.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          outcomes.size
            ? {
                type: "bars",
                title: "Outcomes",
                sub: "How settled decisions went.",
                rows: Array.from(outcomes.entries()).map(([outcome, count]) => ({
                  label: outcome,
                  value: count,
                  display: String(count),
                })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "No outcomes to show",
                body: "Nothing has been approved, returned or rejected.",
              },
        ],
      },
    ],
  };
}

export async function approvalsWorkflowLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "queue") {
    const [rows, count] = await Promise.all([
      apiGet<ApprovalRow[]>("/api/v1/approvals/queue?status=ALL&take=200"),
      apiGet<{ waiting: number }>("/api/v1/approvals/queue/count").catch(() => ({ waiting: 0 })),
    ]);
    return queueTab(rows ?? [], count?.waiting ?? 0);
  }

  if (tabSlug === "workflow" || tabSlug === "performance") {
    const rows = await apiGet<ApprovalRow[]>("/api/v1/approvals/queue?status=ALL&take=200");
    return tabSlug === "workflow" ? workflowTab(rows ?? []) : performanceTab(rows ?? []);
  }

  return undefined;
}
