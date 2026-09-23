import { approvalRoutes } from "@/lib/modules/approval-routes";
import { decisionDrawer, decisions } from "@/lib/modules/decisions";
import { exportDrawer } from "@/lib/modules/drawers";
import {
  action,
  name as nameCell,
  pill,
  row,
  text,
  type ModuleContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M13 · Approvals & Workflow — "Every decision waiting on anyone, in one place."
 *
 * Queue is the decisions themselves, Workflow is the rules that route them, and
 * Performance asks the only question that matters of an approval system: are
 * decisions actually being made?
 */

const overrides = approvalRoutes.filter((route) => route.source === "School override").length;
const locked = approvalRoutes.filter((route) => route.noBulk).length;

const waitingOnMe: TableRow[] = decisions.map((decision) => ({
  cells: [
    nameCell(decision.queueTitle, decision.queueSub),
    pill(decision.type),
    nameCell(decision.requester, decision.requesterRole),
    text(decision.blocking, {
      tone: decision.blockingTone,
      strong: Boolean(decision.blockingTone),
    }),
    text(decision.age, { tone: decision.ageTone, strong: Boolean(decision.ageTone) }),
    { kind: "action", label: "Decide", drawer: decisionDrawer(decision) },
  ],
  keywords: `${decision.type} ${decision.requester}`,
}));

const routeRows: TableRow[] = approvalRoutes.map((route) => ({
  cells: [
    nameCell(route.name, route.why),
    text(route.module),
    text(route.approver, { strong: true }),
    route.second ? text(route.second) : text("Not required"),
    text(route.escalates),
    route.open ? text(String(route.open), { mono: true }) : text("—"),
    pill(route.source, route.source === "School override" ? "submitted" : "neutral"),
    {
      kind: "action",
      label: "Open",
      drawer: {
        kicker: "Approval route",
        title: route.name,
        sub: route.why,
        facts: [
          ["Module", route.module],
          ["Approver", route.approver, "A role, never a person"],
          ["Second approver", route.second || "Not required"],
          ["Escalates after", route.escalates, "Then it moves up, it does not lapse"],
          ["Open on this route", route.open ? String(route.open) : "None"],
          ["Average time to decide", route.average],
          ["What waits on it", route.blocks],
          [
            "Source",
            route.source,
            route.source === "School override"
              ? "Your school changed this from the default"
              : "The platform default",
          ],
          ...(route.noBulk
            ? ([
                [
                  "Bulk approval",
                  "Never",
                  "Locked, never hidden — this decision is made one at a time",
                ],
              ] as Array<[string, string, string]>)
            : []),
        ],
      },
    },
  ],
  keywords: `${route.module} ${route.approver} ${route.source}`,
}));

export const approvalsWorkflowContent: ModuleContent = {
  queue: {
    title: "Queue",
    desc: "Every approval item, at the scope you are entitled to.",
    primary: {
      label: "Approve",
      drawer: {
        mode: "commit",
        kicker: "Approvals",
        title: "Approve what is selected",
        sub: "Nothing is approved until you say so, and each decision is logged separately.",
        facts: [
          ["Selected", "Nothing yet", "Tick the decisions below, then approve them together"],
          [
            "Never bulk-approvable",
            `${locked} types`,
            "Score corrections, payment reversals and the rest are decided one at a time",
          ],
          ["Recorded as", "One audit entry per decision", "Under your name"],
        ],
        commitLabel: "Approve the selection",
        commitDone: "Nothing was selected",
        commitDoneBody: "Tick the decisions you want to approve and try again.",
      },
    },
    launchers: [{ label: "Workflow", href: "/approvals-workflow/workflow" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            { label: "Waiting on me", value: "6", sub: "Priority, then age", tone: "attention" },
            {
              label: "Escalating today",
              value: "2",
              sub: "Past their routing period",
              tone: "negative",
            },
            { label: "Oldest item", value: "19 days", sub: "A hardship waiver", tone: "negative" },
            {
              label: "Work blocked",
              value: "146 cards",
              sub: "Waiting on 2 decisions",
              tone: "negative",
              link: "See what is blocked",
              href: "/report-cards/completion",
            },
            {
              label: "Decided this session",
              value: "207",
              sub: "Average 2.4 days",
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "facts",
          title: "Chemistry SSS 2A · score correction",
          sub: "The context needed to judge it — not just the change.",
          facts: [
            ["Request", "Change Tunde Ogunlesi's Chemistry examination score from 29 to 51"],
            ["Requester", "Mr Samuel Adeyemi · Sciences · Exam Officer"],
            [
              "Reason",
              "“Question 6 was marked out of 5 instead of 15. Three other scripts were affected and corrected before submission; this one was missed.”",
            ],
            ["Evidence", "Scanned script pages 3–4 attached"],
            [
              "His other scores this term",
              "Mathematics 54 · English 57 · Physics 49 · Biology 56",
              "A 29 is far from his own pattern",
            ],
            [
              "Class average in Chemistry",
              "58.4",
              "The corrected 51 sits below average, which is consistent",
            ],
            [
              "Downstream effect",
              "34 report cards in JSS 2A are blocked until this is decided",
            ],
            ["Consequence if approved", "No card has been published, so no revision notice is needed"],
            [
              "Second approval",
              "Not required — score corrections need one approver under your routing",
            ],
          ],
          foot: "Requested 3 days ago · escalates in 2 days.",
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Waiting on me",
          tag: "6 items",
          tagTone: "attention",
          sub: "Priority then age, grouped by type, with escalation deadlines.",
          meta: "Scope: waiting on me · raised by me · all",
          search: "Find a decision",
          filters: [
            {
              label: "Type",
              value: "All types",
              options: [
                "All types",
                "Score correction",
                "Waiver",
                "Results",
                "Record change",
                "Access",
                "Communication",
              ],
              column: 1,
            },
          ],
          per: 8,
          noun: "decision",
          nounPlural: "decisions",
          head: ["Decision", "Type", "Requester", "Blocking", "Age", "Decide"],
          rows: waitingOnMe,
        },
      ]),
      row("1fr 1.1fr", [
        {
          type: "list",
          title: "Raised by me",
          sub: "Where everything I submitted currently sits, and who it is waiting on.",
          items: [
            {
              label: "JSS 2A backdated register · 2 September",
              sub: "Returned by Dr Emmanuel Nwosu 3 days ago: “State which network outage — the annex or the whole school?”",
              pill: "Returned",
              tone: "negative",
              viewLabel: "Open",
              facts: [
                ["What I raised", "A backdated attendance register for JSS 2A, 2 September"],
                ["State", "Returned", "It is back with me, not with the approver"],
                ["Returned by", "Dr Emmanuel Nwosu · Proprietor", "3 days ago"],
                [
                  "What they asked",
                  "“State which network outage — the annex or the whole school?”",
                ],
                ["To move it on", "Add the detail and resubmit"],
              ],
            },
            {
              label: "Principal remark bulk apply · 612 cards",
              sub: "Waiting on Dr Emmanuel Nwosu · 2 days · escalates in 3",
              pill: "Awaiting",
              tone: "attention",
              viewLabel: "Open",
              facts: [
                ["What I raised", "Apply a principal's remark across 612 report cards"],
                ["State", "Awaiting"],
                ["Waiting on", "Dr Emmanuel Nwosu · Proprietor", "2 days"],
                ["Escalates", "In 3 days"],
              ],
            },
            {
              label: "Peter Nwachukwu · withdrawal",
              sub: "Approved by Dr Emmanuel Nwosu 4 hours ago · status change applied",
              pill: "Approved",
              tone: "positive",
              viewLabel: "Open",
              facts: [
                ["What I raised", "Withdraw Peter Nwachukwu"],
                ["State", "Approved", "The status change has been applied"],
                ["Approved by", "Dr Emmanuel Nwosu · Proprietor", "4 hours ago"],
              ],
            },
          ],
        },
        {
          type: "table",
          title: "All · in flight",
          sub: "Permission-gated.",
          meta: "15 in flight · 207 decided this session",
          search: "Find an item",
          filters: [
            {
              label: "Type",
              value: "All",
              options: [
                "All",
                "Score correction",
                "Waiver",
                "Discount",
                "Record change",
                "Reversal",
                "Timetable",
              ],
              column: 1,
            },
            {
              label: "State",
              value: "All",
              options: ["All", "Awaiting", "In review", "Escalated", "Returned"],
              column: 4,
            },
          ],
          per: 6,
          noun: "item",
          nounPlural: "items",
          head: ["Item", "Type", "Waiting on", "Age", "State"],
          rows: [
            {
              cells: [
                text("Mathematics JSS 2B · 6 component splits", { strong: true }),
                text("Score correction"),
                text("Mrs Folake Adeniyi"),
                text("6 days"),
                pill("In review", "progress"),
              ],
            },
            {
              cells: [
                text("Mohammed family · partial waiver", { strong: true }),
                text("Waiver"),
                text("Adaeze Nwosu"),
                text("11 days"),
                pill("Escalated", "negative"),
              ],
            },
            {
              cells: [
                text("Bature family · merit scholarship", { strong: true }),
                text("Discount"),
                text("Dr Emmanuel Nwosu"),
                text("4 days"),
                pill("Awaiting", "attention"),
              ],
            },
            {
              cells: [
                text("Emeka Okafor · surname spelling", { strong: true }),
                text("Record change"),
                text("Adaeze Nwosu"),
                text("2 days"),
                pill("Awaiting", "attention"),
              ],
            },
            {
              cells: [
                text("3 payment reversals · ₦112,000", { strong: true }),
                text("Reversal"),
                text("Dr Emmanuel Nwosu"),
                text("9 days"),
                pill("Escalated", "negative"),
              ],
            },
            {
              cells: [
                text("SSS 2B timetable republish", { strong: true }),
                text("Timetable"),
                text("Adaeze Nwosu"),
                text("1 day"),
                pill("Awaiting", "attention"),
              ],
            },
          ],
        },
      ]),
    ],
  },

  workflow: {
    title: "Workflow",
    desc: "Who approves what, how long it may sit, and what escalates.",
    primary: {
      label: "Create a route",
      drawer: {
        mode: "commit",
        kicker: "Workflow",
        title: "Create an approval route",
        sub: "A route decides who may decide. Nobody can approve their own submission, whatever this route says.",
        facts: [
          ["What is being approved", "Named when you create it", "e.g. excursion consent above 40 students"],
          ["Approver", "A role, never a person"],
          ["Second approver", "Optional"],
          ["Escalates after", "A period you set", "Then it moves up — it never lapses"],
          [
            "Applies to",
            "Anything raised from now on",
            "Nothing already waiting is moved onto it",
          ],
        ],
        commitLabel: "Create the route",
        commitDone: "Route created",
        commitDoneBody:
          "Anything raised from now on follows it. Nothing already waiting is moved.",
      },
    },
    launchers: [{ label: "Open the queue", href: "/approvals-workflow/queue" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Routes",
              value: String(approvalRoutes.length),
              sub: `${overrides} are your own overrides`,
            },
            {
              label: "School overrides",
              value: String(overrides),
              sub: "On top of the defaults",
              tone: "submitted",
            },
            { label: "Standing rules", value: "2", sub: "Revocable instantly", tone: "neutral" },
            {
              label: "Never bulk-approvable",
              value: String(locked),
              sub: "Locked, never hidden",
              tone: "withheld",
            },
            {
              label: "Slowest route",
              value: "8.6 days",
              sub: "Fee waiver above ₦50,000",
              tone: "negative",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Approval routes",
          tag: `${approvalRoutes.length} routes`,
          tagTone: "neutral",
          sub: "Open a route to see the full path, what it blocks, and how it is actually performing.",
          meta: `${approvalRoutes.length} routes · ${overrides} school overrides · ${locked} never bulk-approvable`,
          search: "Find a route by name, approver or module",
          filters: [
            {
              label: "Module",
              value: "All",
              options: [
                "All",
                "Scores & Results",
                "Report Cards",
                "Fee Management",
                "Student Records",
                "Attendance",
                "Staff & Access",
                "Communication",
              ],
              column: 1,
            },
            {
              label: "Approver",
              value: "All",
              options: ["All", "Principal", "Proprietor", "Exam Officer", "Bursar", "Registrar"],
              column: 2,
            },
            {
              label: "Source",
              value: "All",
              options: ["All", "Default", "School override"],
              column: 6,
            },
          ],
          selectable: true,
          per: 12,
          noun: "route",
          nounPlural: "routes",
          bulkActs: [
            { label: "Change the approver" },
            { label: "Change the escalation period" },
            { label: "Reset to the default" },
            { label: "Export selected", primary: true },
          ],
          acts: [
            {
              label: "Export the routing map",
              drawer: exportDrawer({
                title: "Export the routing map",
                what: "Every approval route, its approver, escalation period and source",
                scope: `All ${approvalRoutes.length} routes`,
              }),
            },
          ],
          head: [
            "Approval type",
            "Module",
            "Approver",
            "Second approver",
            "Escalates",
            "Open",
            "Source",
            "",
          ],
          rows: routeRows,
          foot: "A route decides who may decide. Nobody can approve their own submission, whatever any route says — that rule sits above routing and cannot be switched off.",
        },
      ]),
      row("1.05fr 1fr", [
        {
          type: "table",
          title: "Standing rules",
          tag: "2 in force",
          tagTone: "neutral",
          sub: "The decisions a school has agreed need no human at all.",
          meta: "2 active · 1 revoked · every firing is logged",
          head: ["Rule", "Condition", "Fired", "Created by", "State", ""],
          noun: "rule",
          nounPlural: "rules",
          rows: [
            {
              cells: [
                nameCell("Auto-approve record changes under 3 characters", "Spelling corrections only"),
                text("Field length ≤ 3"),
                text("14", { mono: true }),
                nameCell("Adaeze Nwosu", "Principal"),
                pill("Active", "positive"),
                action("Revoke"),
              ],
            },
            {
              cells: [
                nameCell("Auto-approve sibling discounts", "Rule-driven, no discretion involved"),
                text("Second child onward"),
                text("148", { mono: true }),
                nameCell("Dr Emmanuel Nwosu", "Proprietor"),
                pill("Active", "positive"),
                action("Revoke"),
              ],
            },
            {
              cells: [
                nameCell("Auto-approve score submissions", "Revoked 22 August after 4 days"),
                text("Any submission"),
                text("62", { mono: true }),
                nameCell("Dr Emmanuel Nwosu", "Proprietor"),
                pill("Revoked", "neutral"),
                action("Reinstate"),
              ],
            },
          ],
        },
        {
          type: "list",
          title: "Permanently excluded from bulk approval",
          sub: "These can never be bulk-approved, whatever a route says.",
          readOnly: true,
          items: [
            {
              label: "Score corrections",
              sub: "Each one changes a number a parent may already have seen",
              pill: "Locked",
              tone: "withheld",
            },
            {
              label: "Payment reversals",
              sub: "Money leaving a ledger is decided one payment at a time",
              pill: "Locked",
              tone: "withheld",
            },
            {
              label: "Student status changes",
              sub: "A withdrawal or a transfer is a decision about a child",
              pill: "Locked",
              tone: "withheld",
            },
            {
              label: "Safeguarding restrictions",
              sub: "Never approved in a batch, never approved quickly",
              pill: "Locked",
              tone: "withheld",
            },
            {
              label: "Assessment framework unlocks",
              sub: "Unlocking a scored framework can restate published results",
              pill: "Locked",
              tone: "withheld",
            },
            {
              label: "Migration commits",
              sub: "One commit, one named approver, one reconciliation report",
              pill: "Locked",
              tone: "withheld",
            },
          ],
        },
      ]),
    ],
  },

  performance: {
    title: "Performance",
    desc: "Are decisions actually being made?",
    primary: {
      label: "Export for review",
      drawer: exportDrawer({
        title: "Export approval performance for review",
        what: "Time to decision by approver, by type and by requester",
        scope: "Second Term · term day 34",
        note: "Time to decision, never a score or a rating.",
      }),
    },
    launchers: [{ label: "Open the queue", href: "/approvals-workflow/queue" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Decided this session",
              value: "207",
              sub: "Across 20 approval types",
              tone: "positive",
            },
            {
              label: "Outstanding",
              value: "15",
              sub: "6 waiting on you · 4 escalated",
              tone: "attention",
              link: "Open queue",
              href: "/approvals-workflow/queue",
            },
            {
              label: "Average time to decide",
              value: "2.4 days",
              sub: "Down from 3.8 days last session",
              tone: "positive",
            },
            {
              label: "Blocked work",
              value: "146 cards",
              sub: "2 teachers and 146 report cards wait on 2 decisions",
              tone: "negative",
              link: "See what is blocked",
              href: "/report-cards/completion",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "By approver",
          sub: "Time to decision, never a score or a rating.",
          meta: "Second Term · term day 34",
          noun: "approver",
          nounPlural: "approvers",
          head: ["Approver", "Decided", "Open", "Oldest", "Average time", "Escalated past them"],
          rows: [
            {
              cells: [
                nameCell("Adaeze Nwosu", "Principal · you"),
                text("96", { mono: true }),
                text("6", { mono: true }),
                text("19 days", { tone: "negative", strong: true }),
                text("3.2 days", { tone: "attention" }),
                text("2", { mono: true }),
              ],
            },
            {
              cells: [
                nameCell("Dr Emmanuel Nwosu", "Proprietor"),
                text("34", { mono: true }),
                text("4", { mono: true }),
                text("9 days", { tone: "attention", strong: true }),
                text("4.1 days", { tone: "negative" }),
                text("1", { mono: true }),
              ],
            },
            {
              cells: [
                nameCell("Mrs Folake Adeniyi", "Exam Officer · Languages"),
                text("52", { mono: true }),
                text("4", { mono: true }),
                text("2 days"),
                text("0.8 days", { tone: "positive" }),
                text("0", { mono: true }),
              ],
            },
            {
              cells: [
                nameCell("Mr Samuel Adeyemi", "Exam Officer · Sciences"),
                text("41", { mono: true }),
                text("9", { mono: true }),
                text("6 days", { tone: "attention", strong: true }),
                text("2.1 days"),
                text("1", { mono: true }),
              ],
            },
            {
              cells: [
                nameCell("Mrs Chinelo Obi", "Bursar"),
                text("18", { mono: true }),
                text("3", { mono: true }),
                text("4 days"),
                text("1.4 days", { tone: "positive" }),
                text("0", { mono: true }),
              ],
            },
          ],
        },
      ]),
      row("1fr 1fr", [
        {
          type: "bars",
          title: "By type · which categories move and which stall",
          sub: "Average days to decision this session.",
          rows: [
            {
              label: "Waiver and discount",
              value: 8.6,
              display: "8.6 days",
              tone: "negative",
              sub: "The slowest category, and the one where delay costs a family most",
            },
            { label: "Payment reversal", value: 5.2, display: "5.2 days", tone: "attention" },
            { label: "Results publication", value: 2.8, display: "2.8 days", tone: "progress" },
            { label: "Score correction", value: 2.1, display: "2.1 days", tone: "progress" },
            { label: "Record change", value: 1.2, display: "1.2 days", tone: "positive" },
            { label: "Access and staff", value: 0.9, display: "0.9 days", tone: "positive" },
          ],
        },
        {
          type: "list",
          title: "By requester",
          items: [
            {
              label: "Mr Ibrahim Danladi · 4 of 11 returned",
              sub: "All four for a missing reason on a backdated register.",
              pill: "36% returned",
              tone: "attention",
            },
            {
              label: "Mrs Ngozi Eze · 2 of 9 returned",
              sub: "Both for score sheets submitted with blanks left where a student was absent",
              pill: "22% returned",
              tone: "attention",
            },
            {
              label: "Mrs Chinelo Obi · 1 of 24 returned",
              sub: "One waiver submitted without the supporting letter",
              pill: "4% returned",
              tone: "positive",
            },
            {
              label: "Mr Samuel Adeyemi · 0 of 18 returned",
              sub: "Nothing returned this session",
              pill: "0% returned",
              tone: "positive",
            },
          ],
        },
      ]),
    ],
  },
};
