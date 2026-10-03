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

  // Workflow and Performance stay authored. Workflow describes the routing
  // rules that decide who a decision goes to, and nothing persists those — the
  // service routes by role at raise time. Performance wants time-to-decision
  // across a history this queue does not have yet.
  return undefined;
}
