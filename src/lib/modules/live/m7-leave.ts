import { apiGet } from "@/lib/api/server";
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
 * The sequence and the terms of each type are the school's own — edited on this tab.
 */

export const loadLeave = () => apiGet<LeaveOverview>(`${API}/leave`);

const LEAVE_TONE: Record<string, PanelTone> = { Taken: "positive", Approved: "positive", Waiting: "attention", Declined: "negative", "In sequence": "progress" };
const REGISTER = "/staff-access/leave/export";

const tokens = (kind: string, value: string) => `${kind}:${value}|`;

export function leaveTab(data: LeaveOverview): TabContent {
  const { rows, types, kpis, stages, balances } = data;
  const mine = rows.filter((row) => row.mine);
  const noCover = rows.filter((row) => (row.status === "Waiting" || row.status === "In sequence") && row.coverState === "Not arranged" && row.coverRequired);
  const staff = balances.map((row) => ({ id: row.id, name: row.name, role: row.role }));
  const record = recordLeaveDrawer(staff, types);
  const addStage = flowStageDrawer("leave", stages, null);
  const decideFirst = mine[0] ? decideLeaveDrawer(mine[0], { balance: annualAfter(data, mine[0].staffId, mine[0].type, mine[0].days) }) : null;
  const taken = rows.filter((row) => row.status === "Taken").length;
  const declined = rows.filter((row) => row.status === "Declined").length;

  const cards: KpiCard[] = [
    { label: "Away today", value: String(kpis.awayToday), sub: kpis.awayNames.length ? kpis.awayNames.slice(0, 3).join(", ") : "Everybody is in" },
    { label: "Waiting on you", value: String(kpis.waiting), tone: kpis.waiting ? "attention" : "positive", sub: kpis.waiting ? `Oldest has waited ${kpis.oldestDays} ${kpis.oldestDays === 1 ? "day" : "days"}` : "Nothing waiting", ...(kpis.waiting && decideFirst ? { link: "Decide them", drawer: decideFirst } : {}) },
    { label: "Cover not arranged", value: String(kpis.noCover), tone: kpis.noCover ? "negative" : "positive", sub: kpis.noCover ? "Classes would be uncovered if granted" : "Every open request names its cover" },
    { label: "Working days off this session", value: String(kpis.lost), sub: data.session ? `${data.session} · approved and taken` : "Approved leave, all told" },
    { label: "Annual entitlement used", value: kpis.annualUsedPct === null ? "—" : `${kpis.annualUsedPct}%`, tone: "progress", sub: `School-wide · ${kpis.staff} staff` },
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

  const typeRows: TableRow[] = types.map((type) => {
    const drawer = leaveTypeDrawer(type);
    return {
      id: type.code,
      cells: [
        text(type.name, { strong: true }),
        text(type.entitlement === null ? "No ceiling" : `${type.entitlement} ${type.unit === "Weeks" ? "weeks" : type.unit === "Months" ? "months" : type.unit === "Calendar days" ? "calendar days" : "working days"}${type.per ? ` ${type.per}` : ""}`),
        text(type.accrual),
        text(type.carry),
        text(type.evidence),
        pill(type.pay, /Unpaid/.test(type.pay) ? "attention" : /Half/.test(type.pay) ? "progress" : "positive"),
        text(type.coverRequired ? "Required" : "Advisory"),
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
    keywords: row.away ? "away:Away now|" : "away:In|",
  }));

  return {
    title: "Leave",
    desc: "Every request, its approvals, and the cover it depends on.",
    ...(mine.length && decideFirst ? { primary: { label: `Decide the ${mine.length} waiting on you`, icon: "m4.5 12.5 4.5 4.5 9-10M4.5 19.5h15", drawer: decideFirst } } : {}),
    launchers: [
      { label: "Define a leave type", drawer: leaveTypeDrawer() },
      { label: "Add an approval stage", drawer: addStage },
      { label: "Record leave taken off-system", drawer: record },
      { label: "Export the leave register", href: REGISTER },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Who is away, and who has asked", sub: data.session ?? "Every session on record", per: 5, cards }] },
      ...(noCover.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${plural(noCover.length, "request would leave classes uncovered", "requests would leave classes uncovered")}`,
                  body: "Cover is the whole question. A school can nearly always spare a person; it can rarely spare a person and their periods. These requests name no cover, so granting one silently sends a class to an empty room — and a leave type that requires cover will refuse it.",
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
            sub: "Every request on record, in and out of sequence, decided and undecided.",
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
            acts: [{ label: "Export the register", href: REGISTER }, { label: "Record leave taken", primary: true, drawer: record }],
            selectable: true,
            bulkActs: [
              { label: "Approve these", drawer: approveManyDrawer(), selection: { key: "ids", noun: "request" } },
              { label: "Return for cover", drawer: returnManyDrawer(), selection: { key: "ids", noun: "request" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Staff member", "Type", "Dates", "Days", "Cover", "Sequence", "Status", ""],
            rows: requestRows,
            per: 8,
            emptyTitle: "No leave on record",
            emptyBody: "Requests made in the staff portal, and leave recorded here, appear in this register.",
            empty: "No request matches.",
            foot: "A request is never deleted. Declined, cancelled and withdrawn requests stay in the register with their reason — that history is what makes the next decision defensible.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Leave types",
            tag: plural(types.length, "type"),
            sub: "A leave type is a policy, not a label. Open one to read or change its terms.",
            noun: "leave type",
            nounPlural: "leave types",
            search: "Find a type",
            filters: [
              { label: "Pay", value: "All", options: ["All", ...pays], match: Object.fromEntries(pays.map((name) => [name, tokens("pay", name)])) },
              { label: "Evidence", value: "All", options: ["All", ...evidence], match: Object.fromEntries(evidence.map((name) => [name, tokens("evidence", name)])) },
              { label: "Carry-over", value: "All", options: ["All", ...carries], match: Object.fromEntries(carries.map((name) => [name, tokens("carry", name)])) },
            ],
            acts: [{ label: "Define a leave type", primary: true, drawer: leaveTypeDrawer() }],
            head: ["Type", "Entitlement", "Accrual", "Carry-over", "Evidence", "Pay", "Cover", "Staff see it", "Requests", ""],
            rows: typeRows,
            summaryRows: [[text("All types", { strong: true }), text(""), text(""), text(""), text(""), text(""), text(""), text(""), text(String(types.reduce((sum, type) => sum + type.requests, 0)), { strong: true }), text("")]],
            foot: "Unpaid leave is the only type that reaches payroll by itself — as a named variation on the next run.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Balances",
            tag: plural(balances.length, "person", "people"),
            sub: "Days approved this session against what each type allows.",
            noun: "person",
            nounPlural: "people",
            search: "Find a person",
            filters: [{ label: "Today", value: "All", options: ["All", "Away now", "In"], match: { "Away now": "away:Away now|", In: "away:In|" } }],
            head: ["Staff member", "Annual leave", "Sick leave", "Other types", "All leave", "Today"],
            rows: balanceRows,
            per: 10,
            empty: "Nobody matches.",
            foot: "Only approved leave counts; a request still in sequence has not been spent.",
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "How leave is counted",
            tuck: "How leave is counted",
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
      { cols: "1fr", panels: [flowPanel("leave", stages, { title: "How a request is approved", sub: "Edit, reorder or remove any stage. A request already in flight keeps the sequence it started on.", tag: plural(stages.length, "stage") })] },
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
