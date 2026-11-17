import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { API } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import {
  approveManyDrawer,
  decideLeaveDrawer,
  flowPanel,
  flowStageDrawer,
  leaveTypeDrawer,
  recordLeaveDrawer,
  returnManyDrawer,
} from "@/lib/modules/live/m7-pay-forms";
import type { LeaveOverview } from "@/lib/modules/live/m7-types";
import {
  name as nameCell,
  pill,
  text,
  type KpiCard,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * Leave: every request, the people who decide it in order, and the cover it depends on.
 *
 * The tab is the queue — who is away, what has been asked, and what would go uncovered if it
 * were granted. The terms each request is measured against and the sequence that decides it are
 * the school's policy, set once a session: they are a page of their own, reached by name, so the
 * queue opens first instead of a page and a half below the fold.
 */

export const loadLeave = () => apiGet(`${API}/leave`, observe<LeaveOverview>(localContracts["src/lib/modules/live/m7-leave.ts#6e8b7b97"]));

const LEAVE_TONE: Record<string, PanelTone> = { Taken: "positive", Approved: "positive", Waiting: "attention", Declined: "negative", "In sequence": "progress" };
const REGISTER = "/staff-access/leave/export";
const POLICY = "/staff-access/leave/policy";
const BALANCES = "/staff-access/leave/balances";
const BOOK = "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13";

const tokens = (kind: string, value: string) => `${kind}:${value}|`;

/* ───────────────────────────── the queue ───────────────────────────── */

export function leaveTab(data: LeaveOverview): TabContent {
  const { rows, types, kpis, balances } = data;
  const mine = rows.filter((row) => row.mine);
  const noCover = rows.filter((row) => (row.status === "Waiting" || row.status === "In sequence") && row.coverState === "Not arranged" && row.coverRequired);
  const staff = balances.map((row) => ({ id: row.id, name: row.name, role: row.role }));
  const record = recordLeaveDrawer(staff, types);
  const decideFirst = mine[0] ? decideLeaveDrawer(mine[0], { balance: annualAfter(data, mine[0].staffId, mine[0].type, mine[0].days) }) : null;
  const taken = rows.filter((row) => row.status === "Taken").length;
  const declined = rows.filter((row) => row.status === "Declined").length;

  const cards: KpiCard[] = [
    { label: "Away today", value: String(kpis.awayToday), },
    { label: "Waiting on you", value: String(kpis.waiting), tone: kpis.waiting ? "attention" : "positive", ...(kpis.waiting && decideFirst ? { link: "Decide them", drawer: decideFirst } : {}) },
    { label: "Cover not arranged", value: String(kpis.noCover), tone: kpis.noCover ? "negative" : "positive", },
    { label: "Working days off this session", value: String(kpis.lost), },
    { label: "Annual entitlement used", value: kpis.annualUsedPct === null ? "—" : `${kpis.annualUsedPct}%`, tone: "progress", link: "See balances", href: BALANCES },
  ];

  const typeNames = types.map((type) => type.name);
  const requestRows: TableRow[] = rows.map((row) => {
    const drawer = decideLeaveDrawer(row, { balance: annualAfter(data, row.staffId, row.type, row.days) });
    return {
      id: row.id,
      cells: [
        nameCell(row.name, `${row.role} · ${row.department}`),
        text(row.type, { strong: true }),
        text(row.dates),
        text(String(row.days)),
        text(row.cover, { tone: row.coverState === "Not arranged" && row.coverRequired ? "negative" : undefined, strong: row.coverState === "Not arranged" && row.coverRequired }),
        text(row.sequence, { tone: row.mine ? "attention" : undefined, strong: row.mine }),
        pill(row.status, LEAVE_TONE[row.status] ?? "neutral"),
        { kind: "action", label: row.mine ? "Decide" : "Open", drawer },
      ],
      drawer,
      keywords: `${tokens("type", row.type)}${tokens("status", row.status)}${tokens("stage", row.mine ? "With you" : row.sequence === "Complete" ? "Complete" : row.sequence)}${tokens("cover", row.coverState === "Not arranged" ? "Not arranged" : row.coverState === "Not needed" ? "No cover needed" : "Arranged")}`,
    };
  });
  const stageOptions = Array.from(new Set(rows.map((row) => (row.mine ? "With you" : row.sequence))));

  return {
    title: "Leave",
    desc: "Every request, its approvals, and the cover it depends on.",
    ...(mine.length && decideFirst ? { primary: { label: `Decide the ${mine.length} waiting on you`, icon: "m4.5 12.5 4.5 4.5 9-10M4.5 19.5h15", drawer: decideFirst } } : {}),
    // The head holds the queue's own two decisions. The rest reach the policy and the balances
    // by name, and land on the register's own strip when the head is full.
    launchers: [
      { label: "Leave policy", href: POLICY },
      { label: "Balances", href: BALANCES },
      { label: "Export the register", href: REGISTER, download: true },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Who is away, and who has asked", sub: data.session ?? "Every session on record", per: 5, cards }] },
      ...(noCover.length
        ? [
            {
              cols: "1fr" as const,
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${plural(noCover.length, "request would leave classes uncovered", "requests would leave classes uncovered")}`,
                  body: "A school can nearly always spare a person; it can rarely spare a person and their periods. These name no cover, so granting one sends a class to an empty room.",
                  acts: [
                    { label: "See the timetable", href: "/class-timetable/timetable" },
                    ...(noCover.find((row) => row.mine) ? [{ label: "Decide the first", drawer: decideLeaveDrawer(noCover.find((row) => row.mine)!, {}) }] : []),
                  ],
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Leave requests",
            tag: `${mine.length} waiting on you`,
            tagTone: mine.length ? "attention" : "positive",
            sub: "In and out of sequence, decided and undecided.",
            meta: `${plural(rows.length, "request")} · ${taken} taken · ${declined} declined`,
            noun: "request",
            nounPlural: "requests",
            search: "Find by name or type",
            filters: [
              { label: "Type", value: "All", options: ["All", ...typeNames], match: Object.fromEntries(typeNames.map((name) => [name, tokens("type", name)])) },
              { label: "Status", value: "All", options: ["All", "Waiting", "In sequence", "Approved", "Taken", "Declined"], match: Object.fromEntries(["Waiting", "In sequence", "Approved", "Taken", "Declined"].map((name) => [name, tokens("status", name)])) },
              { label: "Stage", value: "All", options: ["All", ...stageOptions], match: Object.fromEntries(stageOptions.map((name) => [name, tokens("stage", name)])) },
              { label: "Cover", value: "All", options: ["All", "Arranged", "Not arranged", "No cover needed"], match: Object.fromEntries(["Arranged", "Not arranged", "No cover needed"].map((name) => [name, tokens("cover", name)])) },
            ],
            acts: [{ label: "Record leave taken", primary: true, drawer: record }],
            selectable: true,
            bulkActs: [
              { label: "Approve these", drawer: approveManyDrawer(), selection: { key: "ids", noun: "request" } },
              { label: "Return for cover", drawer: returnManyDrawer(), selection: { key: "ids", noun: "request" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Staff member", "Type", "Dates", "Days", "Cover", "Sequence", "Status", ""],
            rows: requestRows,
            emptyTitle: "No leave on record",
            emptyBody: "Requests made in the staff portal, and leave recorded here, appear in this register.",
            empty: "No request matches.",
          },
        ],
      },
    ],
  };
}

/* ─────────────────── the terms, and who decides — a page of its own ───────────────────
 *
 * A leave type is a policy and the sequence is the school's own, both changed once a session.
 * They were two full-width tables and a flow below the queue, which is why the tab ran to three
 * and a half thousand pixels. They are reference, so they are reached rather than scrolled past.
 */

export function leavePolicyPage(data: LeaveOverview): TabContent {
  const { types, stages } = data;

  const typeRows: TableRow[] = types.map((type) => {
    const drawer = leaveTypeDrawer(type);
    return {
      id: type.code,
      // Ten columns did not fit the panel, so the two pairs that always read together share a
      // cell: what the type grants with how it accrues, and the type with whether cover is a
      // condition of it. Nothing is dropped.
      cells: [
        { kind: "name", name: type.name, sub: type.coverRequired ? "Cover required" : "Cover advisory", avatar: false },
        {
          kind: "name",
          name: type.entitlement === null ? "No ceiling" : `${type.entitlement} ${type.unit === "Weeks" ? "weeks" : type.unit === "Months" ? "months" : type.unit === "Calendar days" ? "calendar days" : "working days"}`,
          sub: type.per ? `${type.per} · ${type.accrual}` : type.accrual,
          avatar: false,
        },
        text(type.carry),
        text(type.evidence),
        pill(type.pay, /Unpaid/.test(type.pay) ? "attention" : /Half/.test(type.pay) ? "progress" : "positive"),
        text(type.visible ? "Visible" : "Hidden", { tone: type.visible ? undefined : "attention" }),
        text(String(type.requests)),
        { kind: "action", label: "Edit", drawer },
      ],
      drawer,
      keywords: `${tokens("pay", type.pay)}${tokens("evidence", type.evidence)}${tokens("carry", type.carry)}`,
    };
  });
  const pays = Array.from(new Set(types.map((type) => type.pay)));
  const evidence = Array.from(new Set(types.map((type) => type.evidence)));
  const carries = Array.from(new Set(types.map((type) => type.carry)));

  return {
    title: "Leave policy",
    desc: "What the school offers, on what terms, and who decides a request.",
    primary: { label: "Define a leave type", drawer: leaveTypeDrawer() },
    launchers: [{ label: "Add an approval stage", drawer: flowStageDrawer("leave", stages, null) }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Leave types",
            tag: plural(types.length, "type"),
            sub: "A type is a policy, not a label. Open one to change its terms.",
            noun: "leave type",
            nounPlural: "leave types",
            search: "Find a type",
            filters: [
              { label: "Pay", value: "All", options: ["All", ...pays], match: Object.fromEntries(pays.map((name) => [name, tokens("pay", name)])) },
              { label: "Evidence", value: "All", options: ["All", ...evidence], match: Object.fromEntries(evidence.map((name) => [name, tokens("evidence", name)])) },
              { label: "Carry-over", value: "All", options: ["All", ...carries], match: Object.fromEntries(carries.map((name) => [name, tokens("carry", name)])) },
            ],
            head: ["Type", "Entitlement", "Carry-over", "Evidence", "Pay", "Staff see it", "Requests", ""],
            rows: typeRows,
            summaryRows: [[text("All types", { strong: true }), text(""), text(""), text(""), text(""), text(""), text(String(types.reduce((sum, type) => sum + type.requests, 0)), { strong: true }), text("")]],
            emptyTitle: "No leave type exists yet",
            emptyBody: "Define the first: its entitlement, how it accrues, what evidence it needs and what it does to pay.",
            empty: "No type matches.",
          },
        ],
      },
      { cols: "1fr", panels: [flowPanel("leave", stages, { title: "How a request is approved", sub: "Edit, reorder or remove any stage. A request in flight keeps the sequence it started on.", tag: plural(stages.length, "stage") })] },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "How leave is counted",
            tuck: "How leave is counted",
            tuckIcon: BOOK,
            tuckKicker: "How this works",
            sub: "So the same days mean the same thing to everyone.",
            per: 1,
            facts: [
              ["Working days only", "Weekends are never counted", "School holidays are not subtracted automatically — a request over a break states its working days"],
              ["A balance", "Approved days against the type’s entitlement", "Per session; carry-over is a policy on the type"],
              ["Half days", "Where the type allows them", "Counted as 0.5"],
              ["Recorded after the fact", "Counts from the day it is recorded", "Marked on the register as recorded, not requested"],
              ["Statutory minimum", "Whichever is more generous", "Checked against the school’s country"],
            ] as PanelFact[],
          },
          {
            type: "facts",
            title: "What leave touches elsewhere",
            tuck: "What leave touches elsewhere",
            tuckIcon: BOOK,
            tuckKicker: "How this works",
            sub: "The rest of the product reads this register.",
            per: 1,
            facts: [
              ["Payroll", "Unpaid leave becomes a named variation", "Prorated by working day on the next run"],
              ["The timetable", "Cover is a fact to check, not tick", "Open the timetable to arrange it"],
              ["Attendance", "A teacher away is not marked absent", "They are on the leave register"],
              ["Appraisal", "Leave never lowers a rating", "Only what was measured while they were in"],
            ] as PanelFact[],
          },
        ],
      },
    ],
  };
}

/* ─────────────────── what each person has left — a page of its own ─────────────────── */

export function leaveBalancesPage(data: LeaveOverview): TabContent {
  const { balances } = data;
  const balanceRows: TableRow[] = balances.map((row) => ({
    id: row.id,
    cells: [
      nameCell(row.name, `${row.role} · ${row.department}`),
      text(row.annual.of === null ? `${row.annual.used}` : `${row.annual.used} of ${row.annual.of}`, { tone: row.annual.of !== null && row.annual.used > row.annual.of ? "negative" : undefined }),
      text(row.sick.of === null ? `${row.sick.used}` : `${row.sick.used} of ${row.sick.of}`),
      text(String(row.other)),
      text(String(row.total), { strong: true }),
      row.away ? pill("Away now", "progress") : text("In"),
    ],
    keywords: `${row.away ? "away:Away now|" : "away:In|"}${tokens("dept", row.department)}`,
  }));
  const departments = Array.from(new Set(balances.map((row) => row.department))).filter(Boolean);

  return {
    title: "Leave balances",
    desc: "Days approved this session against what each type allows.",
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Balances",
            tag: plural(balances.length, "person", "people"),
            sub: `${data.session ?? "This session"} · approved leave only.`,
            noun: "person",
            nounPlural: "people",
            search: "Find a person",
            filters: [
              { label: "Today", value: "All", options: ["All", "Away now", "In"], match: { "Away now": "away:Away now|", In: "away:In|" } },
              ...(departments.length > 1 ? [{ label: "Department", value: "All", options: ["All", ...departments], match: Object.fromEntries(departments.map((name) => [name, tokens("dept", name)])) }] : []),
            ],
            head: ["Staff member", "Annual leave", "Sick leave", "Other types", "All leave", "Today"],
            rows: balanceRows,
            emptyTitle: "Nobody is on the leave register yet",
            emptyBody: "A balance appears here once a person’s first request is approved, or leave is recorded for them.",
            empty: "Nobody matches.",
          },
        ],
      },
    ],
  };
}

/** What is left of a person's annual leave after this request, where it draws from it. */
function annualAfter(data: LeaveOverview, staffId: string, type: string, days: number): string | undefined {
  if (type !== "Annual leave") return undefined;
  const balance = data.balances.find((row) => row.id === staffId);
  if (!balance || balance.annual.of === null) return undefined;
  const left = balance.annual.of - balance.annual.used - days;
  return `${left} of ${balance.annual.of} days left`;
}
