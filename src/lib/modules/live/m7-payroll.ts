import { apiGet } from "@/lib/api/server";
import { API } from "@/lib/modules/live/m7-forms";
import {
  approveRunDrawer,
  bandDrawer,
  bulkStatusDrawer,
  closeBandDrawer,
  flowPanel,
  holdDrawer,
  mapStaffDrawer,
  modelIncreaseDrawer,
  moveStepDrawer,
  naira,
  nairaShort,
  offCycleDrawer,
  payrollSetupDrawer,
  payStatusDrawer,
  releaseHeldDrawer,
  sendRunDrawer,
} from "@/lib/modules/live/m7-pay-forms";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import type { BandDetail, PayPerson, PayRow, PayrollOverview, PaySlip, StaffRecord } from "@/lib/modules/live/m7-types";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type GridCell,
  type KpiCard,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * Payroll: one pay structure, and every person mapped into it. Everything on screen is
 * computed from a band and a step — nothing here is a figure somebody typed for a person.
 */

export const loadPayroll = () => apiGet<PayrollOverview>(`${API}/payroll`);
export const loadBand = (id: string) => apiGet<BandDetail>(`${API}/payroll/bands/${id}`);
export const loadPayPerson = (id: string) => apiGet<PayPerson>(`${API}/payroll/people/${id}`);

export const PAY_TONE: Record<string, PanelTone> = {
  Paid: "positive",
  "Awaiting approval": "progress",
  Approved: "progress",
  Held: "negative",
  Draft: "neutral",
  "Not mapped": "attention",
};

const REGISTER_HREF = "/staff-access/payroll/export";

/** One payslip, every line in the order it is calculated. */
export function payslipDrawer(row: PayRow, month: string): DrawerSpec {
  const slip: PaySlip | null = row.slip;
  const money = (value: number | null | undefined) => naira(value);
  const facts: PanelFact[] = slip
    ? [
        ["Band and step", `${row.band} · step ${row.step}`, row.stepName ? `${row.bandName} · ${row.stepName}` : row.bandName ?? undefined],
        ["Gross", money(slip.gross), slip.prorate < 1 ? `Prorated: ${slip.unpaidDays} unpaid ${slip.unpaidDays === 1 ? "day" : "days"}` : "From the step, not typed"],
        ...slip.allowances.map((item) => [item.name, item.inPay ? money(item.amount) : `${money(item.amount)} · not pay`, item.treat] as PanelFact),
        ["Taxable pay", money(slip.taxable), "Gross plus taxable allowances"],
        ["PAYE", money(slip.paye), "From the bands in the payroll setup"],
        ["Pension (employee)", money(slip.pension)],
        ["NHF", money(slip.nhf)],
        ["Net pay", money(slip.net), row.method],
        ["Status", row.state, row.reference ? `Reference ${row.reference}` : row.paidAt ? `Paid ${dayLong(row.paidAt)}` : "Not paid yet"],
      ]
    : [["Net pay", "Held back", "Amounts are held to the people the payroll setup names"]];
  return {
    mode: "view",
    kicker: "Payroll",
    title: `${month} payslip · ${row.name}`,
    sub: "Every line, in the order it is calculated.",
    facts,
    readOnly: true,
    readOnlyNote: "A payslip is a record of a payment — it cannot be edited. Correct the band, the step or the allowance and the next run reflects it.",
  };
}

const gridNum = (value: number | string, extra: Partial<GridCell> = {}): GridCell => ({ value: String(value), num: true, ...extra });

/* ───────────────────────────── the tab ───────────────────────────── */

export function payrollTab(data: PayrollOverview): TabContent {
  const { totals, rows, bands, run, setup, month } = data;
  const hidden = data.amountsHidden;
  const mappedRows = rows.filter((row) => row.state !== "Not mapped");
  const runLabel = !run ? "Not opened" : run.status === "PROCESSED" || run.status === "PUBLISHED" ? "Approved" : run.stage === "approval" ? "Awaiting approval" : "In review";
  const runTone: PanelTone = !run ? "neutral" : runLabel === "Approved" ? "positive" : "progress";
  const unmapped = rows.filter((row) => row.state === "Not mapped");
  const openBand = bands.find((band) => band.isOpen);
  const map = mapStaffDrawer(rows, bands);
  const offCycle = offCycleDrawer(mappedRows);
  const needing = rows.filter((row) => row.state === "Held" || row.state === "Awaiting approval");

  const cards: KpiCard[] = [
    { label: "Monthly payroll cost", value: nairaShort(totals.cost), sub: "Gross, allowances and employer pension, before deductions" },
    { label: "On the payroll", value: String(totals.people), unit: `of ${totals.of}`, tone: totals.unmapped ? "attention" : "positive", sub: totals.unmapped ? `${totals.unmapped} not mapped to a band` : "Everybody mapped" },
    { label: `${month.monthName} run`, value: runLabel, tone: runTone, sub: `Pay date ${setup.payDate} · cut-off ${setup.cutoff.toLowerCase()}`, link: "Open the run", href: "/staff-access/payroll/run" },
    { label: "Statutory deductions", value: nairaShort(totals.deductions), sub: setup.profile.split("·")[1]?.trim() ?? "From the payroll setup" },
    { label: "Payments needing a decision", value: String(needing.length), tone: needing.length ? "attention" : "positive", sub: needing.length ? "Held or waiting on approval" : "Nothing waiting", ...(needing.length ? { link: "See them", href: "/staff-access/payroll/run" } : {}) },
  ];

  const bandRows: TableRow[] = bands.map((band) => ({
    id: band.id,
    cells: [
      text(`${band.code} · ${band.name}`, { strong: true }),
      text(band.covers),
      text(String(band.steps)),
      text(`${naira(band.low)} – ${naira(band.high)}`, { mono: true }),
      text(String(band.staff)),
      text(band.allowances.length ? band.allowances.join(", ") : "None"),
      text(band.nextReview ? dayLong(band.nextReview) : "No review date", { tone: band.nextReview ? undefined : "attention" }),
      { kind: "action", label: "Open", href: `/staff-access/payroll/bands/${band.id}` },
    ],
    href: `/staff-access/payroll/bands/${band.id}`,
    keywords: `group:${band.coversGroup}|${band.isOpen ? "open" : "closed"}`,
  }));
  const groups = Array.from(new Set(bands.map((band) => band.coversGroup)));
  const bandLabels = bands.map((band) => `${band.code} · ${band.name}`);

  const payRows: TableRow[] = rows.map((row) => {
    const mapped = row.state !== "Not mapped";
    const dash = text("—");
    return {
      id: row.id,
      cells: [
        nameCell(row.name, `${row.role} · ${row.department}`),
        mapped ? text(`${row.band} · ${row.bandName}`) : text("Not mapped", { tone: "attention", strong: true }),
        mapped ? text(String(row.step)) : dash,
        mapped ? text(hidden ? "Held back" : naira(row.gross), { mono: true, strong: true }) : dash,
        mapped ? text(hidden ? "Held back" : naira(row.allowances), { mono: true }) : dash,
        mapped ? text(hidden ? "Held back" : `−${naira(row.deductions)}`, { mono: true, tone: "attention" }) : dash,
        mapped ? text(hidden ? "Held back" : naira(row.net), { mono: true, strong: true }) : dash,
        mapped ? text(row.method) : dash,
        mapped ? { kind: "pill", label: row.state, tone: PAY_TONE[row.state] ?? "neutral", drawer: payStatusDrawer(row, month.monthName) } : pill("Not mapped", "attention"),
        mapped ? { kind: "action", label: "Payslip", drawer: payslipDrawer(row, month.monthName) } : { kind: "action", label: "Map them", drawer: mapStaffDrawer(rows, bands, { people: [row], band: bandLabels[0] }) },
      ],
      keywords: `${row.band ?? ""} ${row.step ?? ""} band:${row.band ? `${row.band} · ${row.bandName}` : "none"}| pay:${row.state}| method:${row.method}|`,
    };
  });

  return {
    title: "Payroll",
    desc: "One pay structure, and every person mapped into it.",
    primary: { label: `Open the ${month.monthName} run`, icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: "/staff-access/payroll/run" },
    launchers: [
      { label: "Create a band", drawer: bandDrawer() },
      { label: "Map staff to a band", drawer: map },
      { label: "Record an off-cycle payment", drawer: offCycle },
      { label: "Export the payroll register", href: REGISTER_HREF },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "This month’s payroll", sub: hidden ? "Amounts are held to the people the payroll setup names" : "Computed from bands and steps — never typed", per: 5, cards }] },
      ...(unmapped.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "attention" as PanelTone,
                  title: `${plural(unmapped.length, "member of staff is", "members of staff are")} on the directory but not on a band`,
                  body: "They are employed and they appear everywhere else in the product, so the run below is short by that much. A person with no band cannot be paid and cannot be costed — there is no number to pay.",
                  acts: [
                    ...(openBand ? [{ label: "Map them to a band", drawer: map }] : [{ label: "Create the first band", drawer: bandDrawer() }]),
                    { label: "Open the directory", href: "/staff-access/directory" },
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
            title: "Bands",
            tag: plural(bands.length, "band"),
            sub: "Open a band to set its steps, its allowances and who sits on each.",
            meta: `Currency and statutory rules follow the payroll setup · ${setup.currency}`,
            noun: "band",
            nounPlural: "bands",
            search: "Find a band",
            filters: [{ label: "Covers", value: "All", options: ["All", ...groups], match: Object.fromEntries(groups.map((group) => [group, `group:${group}|`])) }],
            acts: [{ label: "Create a band", primary: true, drawer: bandDrawer() }],
            head: ["Band", "Who it covers", "Steps", "Monthly range", "Staff", "Allowances", "Next review", ""],
            rows: bandRows,
            emptyTitle: "No pay band exists yet",
            emptyBody: "Create the first band: who it covers, what each rung pays and what it adds. Nobody can be paid until they are on one.",
            empty: "No band matches.",
            foot: "A step is a position on a ladder, not a negotiation. Moving somebody up a step is one decision, recorded once, and it reaches their pay on the next run.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Staff on the payroll",
            tag: `${totals.people} of ${totals.of}`,
            tagTone: totals.unmapped ? "attention" : "positive",
            sub: "Band and step decide the gross; the rest is calculated. Click a payment to change its status.",
            meta: hidden ? `${month.label} · amounts are held to the people the payroll setup names` : `${month.label} · ${nairaShort(totals.cost)} cost · ${nairaShort(totals.net)} net to pay`,
            noun: "staff member",
            nounPlural: "staff",
            search: "Find by name, band or step",
            filters: [
              { label: "Band", value: "All", options: ["All", ...bandLabels, "Not mapped"], match: Object.fromEntries([...bandLabels, "Not mapped"].map((label) => [label, label === "Not mapped" ? "band:none|" : `band:${label}|`])) },
              { label: "Payment", value: "All", options: ["All", "Paid", "Awaiting approval", "Approved", "Held", "Draft", "Not mapped"], match: Object.fromEntries(["Paid", "Awaiting approval", "Approved", "Held", "Draft", "Not mapped"].map((label) => [label, `pay:${label}|`])) },
              { label: "Method", value: "All", options: ["All", "Bank transfer", "Cash · collected at the bursary", "Mobile money"], match: Object.fromEntries(["Bank transfer", "Cash · collected at the bursary", "Mobile money"].map((label) => [label, `method:${label}|`])) },
            ],
            acts: [
              { label: "Export the register", href: REGISTER_HREF },
              { label: `Open the run`, primary: true, href: "/staff-access/payroll/run" },
            ],
            selectable: true,
            bulkActs: [
              { label: "Mark these paid", drawer: bulkStatusDrawer("Paid", "Mark these paid"), selection: { key: "staff", noun: "payment" } },
              { label: "Hold these payments", drawer: bulkStatusDrawer("Held", "Hold these payments"), selection: { key: "staff", noun: "payment" } },
              { label: "Release these payments", drawer: bulkStatusDrawer("Awaiting approval", "Release these payments"), selection: { key: "staff", noun: "payment" } },
              { label: "Move up one step", drawer: moveStepDrawer(), selection: { key: "staff", noun: "person" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Staff member", "Band", "Step", "Gross", "Allowances", "Deductions", "Net", "Method", "Payment", ""],
            rows: payRows,
            per: 10,
            empty: "Nobody matches this filter.",
            foot: "Deductions are never entered by hand. They come from the statutory rates in the payroll setup, so the same structure is right wherever the school is.",
          },
        ],
      },
      { cols: "1fr", panels: [flowPanel("payrun", data.flow, { title: "How a run is released", sub: `Where ${month.monthName} stands. Edit, reorder or remove any stage.`, tag: `The ${month.monthName} run · ${runLabel.toLowerCase()}`, tagTone: runTone, nowIndex: runLabel === "Not opened" || runLabel === "In review" ? 1 : runLabel === "Awaiting approval" ? 2 : 3, acts: [{ label: `Open the ${month.monthName} run`, href: "/staff-access/payroll/run" }] })] },
      ...(data.offCycle.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "list" as const,
                  title: "Off-cycle payments this month",
                  sub: "Outside the monthly run, each with its reason.",
                  tag: String(data.offCycle.length),
                  acts: [{ label: "Record an off-cycle payment", drawer: offCycle }],
                  items: data.offCycle.map((item) => ({ label: `${item.name} · ${item.kind}`, sub: `${hidden ? "Held back" : naira(item.amount)} · ${dayLabel(item.payOn)} · ${item.reason}`, pill: item.status === "AWAITING_APPROVAL" ? "Awaiting approval" : item.status, tone: "progress" as PanelTone })),
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "How this school pays",
            sub: "Set once, and every run follows it.",
            per: 2,
            acts: [{ label: "Edit the payroll setup", primary: true, drawer: payrollSetupDrawer(setup) }],
            facts: [
              ["Currency", setup.currency, "From the payroll setup"],
              ["Cycle", setup.cycle, `Cut-off ${setup.cutoff.toLowerCase()}`],
              ["Pay date", setup.payDate, "Brought forward if it falls on a weekend"],
              ["Statutory profile", setup.profile.split("·")[0].trim(), `PAYE on the setup’s bands, pension ${setup.pensionRate}%, NHF ${setup.nhfRate}%`],
              ["Payslips", setup.payslips, "Released on payment, never before"],
              ["Who sees amounts", `${setup.visibleTo.length} ${setup.visibleTo.length === 1 ? "role" : "roles"}`, setup.visibleTo.join(", ")],
              ["Who approves a run", setup.approver, "Whoever prepares a run can never approve it"],
              ["Proration", "By working day", "Used for starters and unpaid leave"],
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "How a payslip is calculated",
            tuck: "How pay is calculated",
            sub: "The same order of operations for every person, every month.",
            per: 1,
            facts: [
              ["1 · Band and step", "Gives the gross", "The only figure a human chooses"],
              ["2 · Allowances", "Added by band, not by person", "Who draws each is part of the band"],
              ["3 · Proration", "By working day", "Starters and unpaid leave only"],
              ["4 · Statutory deductions", "From the profile", "PAYE, pension, national housing"],
              ["5 · Net pay", "What reaches the bank", setup.roundNet ? "Rounded to the nearest 100" : "To the naira, never rounded-sm"],
              ["Nothing else", "No free-text pay line exists", "Because that is how quiet, permanent errors get in"],
            ],
          },
          {
            type: "facts",
            title: "What changes pay without anybody typing a number",
            tuck: "What moves pay by itself",
            sub: "Payroll reads the rest of the product.",
            per: 1,
            facts: [
              ["A step increase", "Recorded when somebody is mapped or moved", "Named as a variation on the run"],
              ["Unpaid leave", "From the leave register", "Prorated by working day, shown as a variation"],
              ["A new starter", "From the directory", "Prorated from their first working day"],
              ["A form class", "From Classes", "The form-class allowance follows the assignment"],
              ["A leaver", "From offboarding", "Their account closes; hold their final pay until handover"],
            ],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── one band ───────────────────────────── */

export function bandPage(detail: BandDetail) {
  const { band, people, mask, month } = detail;
  const steps = band.steps;
  const monthly = mask ? 0 : people.reduce((sum, row) => sum + (row.slip?.gross ?? 0) + (row.slip?.allowTotal ?? 0) + (row.slip?.employerCost ?? 0), 0);
  const allowTotal = mask ? 0 : people.reduce((sum, row) => sum + (row.slip?.allowTotal ?? 0), 0);
  const everyone = band.allowances.filter((item) => item.who === "Everyone on the band" && !/not pay/.test(item.treat));
  const typicalAllow = (gross: number) => everyone.reduce((sum, item) => sum + (item.basis === "% of gross" ? (gross * item.rate) / 100 : item.basis === "Per term" ? item.rate / 3 : item.basis === "Per period taught" ? 0 : item.rate), 0);
  const cardTone = (ok: boolean): PanelTone => (ok ? "positive" : "attention");
  const model = modelIncreaseDrawer(detail, monthly);
  const cards: KpiCard[] = [
    { label: "Cost of this band", value: nairaShort(mask ? null : monthly), sub: `A month · ${plural(people.length, "person", "people")}, everything in` },
    { label: "A year", value: nairaShort(mask ? null : monthly * 12), sub: "At today’s headcount and today’s rungs" },
    { label: "Range", value: naira(steps[0]?.gross), unit: `→ ${naira(steps[steps.length - 1]?.gross)}`, sub: `${steps.length} rungs · monthly gross` },
    { label: "Allowances", value: nairaShort(mask ? null : allowTotal), tone: "progress", sub: `A month across the band · ${band.allowances.filter((item) => !/not pay/.test(item.treat)).length} in pay` },
    { label: "Next review", value: band.nextReview ? dayLabel(band.nextReview) : "None set", tone: cardTone(Boolean(band.nextReview)), sub: "Set on the band structure", link: "Edit the band", drawer: bandDrawer(band) },
  ];

  const ladderRows = steps.map((step, index) => {
    const prev = index ? steps[index - 1].gross : 0;
    const up = index ? Math.round((step.gross / (prev || 1) - 1) * 1000) / 10 : 0;
    const here = people.filter((row) => row.step === index + 1).length;
    return {
      id: String(index + 1),
      cells: [
        { value: String(index + 1), static: true, num: true, bold: true },
        { value: step.name },
        gridNum(step.gross, { bold: true, bad: index > 0 && step.gross < prev, naira: false }),
        { value: String(Math.round(typicalAllow(step.gross))), static: true, num: true, naira: true },
        { value: "0", static: true, num: true, naira: true, bold: true, calc: "c2 + c3" },
        { value: "0", static: true, num: true, naira: true, calc: "(c2 + c3) * 12" },
        { value: String(here), static: true, num: true },
        { value: index === 0 ? "Bottom rung" : up >= 0 ? `+${up}%` : `${up}% — below it`, static: true, bad: index > 0 && step.gross < prev },
      ] as GridCell[],
    };
  });

  const allowRows = band.allowances.map((item, index) => {
    const drawing = people.filter((row) => row.slip?.allowances.some((line) => line.name === item.name)).length;
    const mid = steps[Math.floor(steps.length / 2)]?.gross ?? 0;
    const each = item.basis === "% of gross" ? Math.round((mid * item.rate) / 100) : item.basis === "Per term" ? Math.round(item.rate / 3) : item.rate;
    return {
      id: String(index),
      cells: [
        { value: item.name, bold: true },
        { value: item.who, static: true },
        { value: item.basis, static: true },
        gridNum(item.rate, { bold: true }),
        { value: String(each), static: true, num: true, naira: true },
        { value: String(drawing), static: true, num: true },
        { value: String(mask ? 0 : people.reduce((sum, row) => sum + (row.slip?.allowances.find((line) => line.name === item.name)?.amount ?? 0), 0)), static: true, num: true, naira: true, bold: true },
        { value: item.treat, static: true },
      ] as GridCell[],
      remove: { endpoint: `${API}/payroll/bands/${band.id}/allowances/${index}`, method: "DELETE" as const, warn: `${item.name} leaves the band. Everybody who drew it stops from the next run.` },
    };
  });

  const peopleRows: TableRow[] = people.map((row) => ({
    id: row.id,
    cells: [
      nameCell(row.name, row.department),
      text(row.role),
      text(String(row.step)),
      text(mask ? "Held back" : naira(row.gross), { mono: true, strong: true }),
      text(mask ? "Held back" : naira(row.allowances), { mono: true }),
      text(mask ? "Held back" : naira((row.gross ?? 0) + (row.allowances ?? 0)), { mono: true, strong: true }),
      text(row.step && row.step < steps.length ? `${naira(steps[row.step].gross)} at the next rung` : "Top of the band", { tone: row.step && row.step < steps.length ? undefined : "attention", strong: !(row.step && row.step < steps.length) }),
      { kind: "action", label: "Open", href: `/staff-access/directory/${row.id}/payments` },
    ],
    href: `/staff-access/directory/${row.id}/payments`,
  }));

  return {
    title: `${band.code} · ${band.name}`,
    desc: `Covers ${band.covers.toLowerCase()}. Change a rung and everybody on it moves on the next run.`,
    crumb: { label: "Back to Payroll", href: "/staff-access/payroll" },
    primary: { label: "Edit the band structure", drawer: bandDrawer(band) },
    launchers: [
      { label: "Move somebody up a step", drawer: mapStaffDrawer([], [{ id: band.id, code: band.code, name: band.name, covers: band.covers, coversGroup: band.coversGroup, steps: steps.length, low: null, high: null, staff: people.length, allowances: [], nextReview: band.nextReview, isOpen: true }], { people, band: `${band.code} · ${band.name}`, title: `Move somebody on ${band.code}` }) },
      { label: "Model an increase", drawer: model },
      { label: band.isOpen ? "Close the band to new staff" : "Reopen the band", drawer: closeBandDrawer(band, people.length) },
    ],
    rows: [
      { cols: "1fr" as const, panels: [{ type: "kpi" as const, title: "What this band costs", sub: month.label, per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "facts" as const,
            title: "The pay structure on this band",
            sub: "The frame the rungs sit in. Everything here is set once and followed by every run.",
            per: 3,
            acts: [{ label: "Edit the band structure", primary: true, drawer: bandDrawer(band) }],
            facts: [
              ["Who it covers", band.covers, "Suggested when somebody is added to the directory"],
              ["Rungs", `${steps.length} steps`, `${steps[0]?.name ?? "—"} → ${steps[steps.length - 1]?.name ?? "—"}`],
              ["Shape", steps.length > 1 ? `+${Math.round((Math.pow((steps[steps.length - 1].gross || 1) / (steps[0].gross || 1), 1 / (steps.length - 1)) - 1) * 100)}% a step` : "One rung", "An even ladder is predictable to budget for"],
              ["Currency", detail.setup.currency, "From the payroll setup"],
              ["Pay cycle", `${detail.setup.cycle} · paid on the ${detail.setup.payDate}`, `Cut-off ${detail.setup.cutoff.toLowerCase()}`],
              ["Statutory profile", detail.setup.profile.split("·")[0].trim(), `Pension ${detail.setup.pensionRate}%, NHF ${detail.setup.nhfRate}%`],
              ["Allowances in pay", band.allowances.filter((item) => !/not pay/.test(item.treat)).map((item) => item.name).join(", ") || "None"],
              ["Employer pension", `${band.employerPension}% of gross`, "A cost of the band, never on the payslip"],
              ["Open to new staff", band.isOpen ? "Yes" : "No", band.isOpen ? "It appears in the band picker" : "Existing staff stay on it"],
            ] as PanelFact[],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "grid" as const,
            title: "The ladder",
            sub: "Every rung, and what a person on it is actually paid. Type over any figure, then save.",
            presetLabel: "Shape the ladder",
            presets: [
              { label: "Even · 8% a step", column: 2, apply: "grow" as const, rate: 8 },
              { label: "Even · 12% a step", column: 2, apply: "grow" as const, rate: 12 },
              { label: "Flat · one rate", column: 2, apply: "flat" as const },
              { label: "Back to current", column: 2, apply: "reset" as const },
            ],
            cols: "0.4fr 1.05fr 0.85fr 0.8fr 0.9fr 0.9fr 0.5fr 0.8fr",
            right: [2, 3, 4, 5, 6, 7],
            head: ["Rung", "What the school calls it", "Monthly gross", "Allowances", "Monthly package", "A year", "Staff", "On the rung below"],
            rows: ladderRows,
            save: { endpoint: `${API}/payroll/bands/${band.id}/ladder`, method: "PATCH" as const, keys: ["_rung", "name", "gross", "_a", "_p", "_y", "_s", "_u"], label: "Save the ladder", done: "Ladder saved. Nobody moves step — they keep the step they are on, at its new value." },
            draft: {
              label: "Add a rung at the top",
              cells: [{ value: String(steps.length + 1), static: true, num: true }, { value: "", placeholder: "What the school calls it" }, { value: "", num: true, placeholder: "Monthly gross" }, { value: "", static: true }, { value: "", static: true }, { value: "", static: true }, { value: "0", static: true, num: true }, { value: "New top rung", static: true }] as GridCell[],
              add: { endpoint: `${API}/payroll/bands/${band.id}/steps`, method: "POST" as const, keys: ["_rung", "name", "gross", "_a", "_p", "_y", "_s", "_u"] },
            },
            foot: "Gross figures are in naira a month. A rung that pays less than the one below it is refused on save.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "grid" as const,
            title: "Allowances on this band",
            sub: "Who draws it, on what basis, and what it costs the band. Name and rate are typed over here; the rest is set on the band structure.",
            cols: "1.1fr 1fr 0.85fr 0.6fr 0.85fr 0.45fr 0.9fr 1fr",
            right: [3, 4, 5, 6],
            head: ["Allowance", "Who draws it", "Basis", "Rate", "Amount each", "Staff", "Monthly total", "Treatment"],
            rows: allowRows,
            save: { endpoint: `${API}/payroll/bands/${band.id}/allowances`, method: "PATCH" as const, keys: ["name", "_w", "_b", "rate", "_e", "_s", "_t", "_tr"], label: "Save the allowances", done: "Allowances saved. Everybody it applies to draws them from the next run." },
            draft: {
              label: "Add an allowance",
              cells: [{ value: "", placeholder: "Allowance name" }, { value: "Everyone on the band", static: true }, { value: "Flat monthly", static: true }, { value: "", num: true, placeholder: "Rate" }, { value: "", static: true }, { value: String(people.length), static: true, num: true }, { value: "", static: true }, { value: "Taxable", static: true }] as GridCell[],
              add: { endpoint: `${API}/payroll/bands/${band.id}/allowances`, method: "POST" as const, keys: ["name", "_w", "_b", "rate"] },
            },
            foot: "A flat rate is naira a month; a percentage is measured against the rung the person is on. Open the band structure to change who draws it, on what basis, and how it is taxed.",
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "table" as const,
            title: "Who is on this band",
            tag: plural(people.length, "person", "people"),
            sub: "What this band pays each of them, and who is at the top of it.",
            noun: "person",
            nounPlural: "people",
            head: ["Staff member", "Role", "Rung", "Gross", "Allowances", "Monthly package", "Next rung", ""],
            rows: peopleRows,
            empty: "Nobody is on this band yet.",
            emptyTitle: "Nobody is on this band",
            emptyBody: "Map staff to it and they are paid the rung they are on.",
            acts: [{ label: "Map staff to this band", drawer: mapStaffDrawer([], [{ id: band.id, code: band.code, name: band.name, covers: band.covers, coversGroup: band.coversGroup, steps: steps.length, low: null, high: null, staff: people.length, allowances: [], nextReview: band.nextReview, isOpen: band.isOpen }], { band: `${band.code} · ${band.name}`, title: `Map staff to ${band.code}` }) }],
            foot: "Nobody on this band is paid a figure anybody typed for them personally — they are paid the rung they are on.",
          },
          {
            type: "facts" as const,
            title: "How a step increase reaches pay",
            tuck: "How a step increase reaches pay",
            sub: "The path from a decision to a bank transfer.",
            per: 1,
            facts: [
              ["Where it starts", "An appraisal outcome, or a pay review", "Never a message to the bursar"],
              ["What is recorded", "The person, the band, the old step, the new step", "And the reason"],
              ["When it reaches pay", "The next run after the cut-off", "Backdated only by explicit decision"],
              ["What staff see", "Their band and step, and their payslip", "Never anybody else’s"],
              ["If it is wrong", "Move them back, run an off-cycle correction", "Both entries stay on the record"],
            ] as PanelFact[],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── the run ───────────────────────────── */

export function runPage(data: PayrollOverview) {
  const { totals, rows, run, month } = data;
  const hidden = data.amountsHidden;
  const mapped = rows.filter((row) => row.state !== "Not mapped");
  const stage = run?.stage ?? "building";
  const approved = run?.status === "PROCESSED" || run?.status === "PUBLISHED";
  const label = approved ? "Approved" : stage === "approval" ? "Awaiting approval" : "In review";
  const held = mapped.filter((row) => row.state === "Held").length;
  const net = nairaShort(totals.net);
  const payTable: TableRow[] = mapped.map((row) => ({
    id: row.id,
    cells: [
      nameCell(row.name, row.role),
      text(row.band ?? "—"),
      text(String(row.step)),
      text(hidden ? "Held back" : naira(row.net), { mono: true, strong: true }),
      text(row.method),
      text(row.method === "Bank transfer" ? (row.reference ? `Ref ${row.reference}` : "Reference on payment") : "Collected at the bursary"),
      { kind: "pill", label: row.state, tone: PAY_TONE[row.state] ?? "neutral", drawer: payStatusDrawer(row, month.monthName) },
      { kind: "action", label: row.state === "Held" ? "Release" : "Payslip", drawer: row.state === "Held" ? payStatusDrawer(row, month.monthName) : payslipDrawer(row, month.monthName) },
    ],
    keywords: `pay:${row.state}| method:${row.method}| band:${row.band}|`,
  }));
  const bandCodes = Array.from(new Set(mapped.map((row) => row.band).filter((code): code is string => Boolean(code))));
  const primary = approved
    ? { label: "Open the payroll register", href: REGISTER_HREF }
    : stage === "approval"
      ? { label: "Approve the run", drawer: approveRunDrawer({ people: totals.people, net, month: month.monthName, preparedBy: run?.preparedBy ?? null, variations: data.variations.length }) }
      : { label: "Send for approval", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", drawer: sendRunDrawer({ people: totals.people, net, month: month.monthName, variations: data.variations.length }) };

  const cards: KpiCard[] = [
    { label: "Net to pay", value: nairaShort(totals.net), sub: `What leaves the account on the ${data.setup.payDate}` },
    { label: "Gross", value: nairaShort(totals.gross), sub: "From bands and steps only" },
    { label: "Allowances", value: nairaShort(totals.allowances), sub: "Attached to bands, not to people" },
    { label: "Statutory", value: nairaShort(totals.deductions), tone: "progress", sub: "PAYE, pension and NHF" },
    { label: "Variations", value: String(data.variations.length), tone: data.variations.length ? "attention" : "neutral", sub: data.variations.length ? "Each one named below" : "Nothing changed since the last run" },
  ];
  return {
    title: `${month.label} run`,
    desc: "Everything this run pays, and everything that changed.",
    crumb: { label: "Back to Payroll", href: "/staff-access/payroll" },
    primary,
    launchers: [
      { label: "Hold a payment", drawer: holdDrawer(rows) },
      { label: "Export the run", href: REGISTER_HREF },
      { label: "Print the payslips", href: "/print/payslips" },
    ],
    tag: label,
    rows: [
      { cols: "1fr" as const, panels: [{ type: "kpi" as const, title: "What this run pays", sub: `${label}${run?.preparedBy ? ` · prepared by ${run.preparedBy}` : ""}${run?.approvedBy ? ` · approved by ${run.approvedBy}` : ""}`, per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "list" as const,
            title: `Variations this month`,
            tag: plural(data.variations.length, "change"),
            tagTone: (data.variations.length ? "attention" : "neutral") as PanelTone,
            sub: "A run is trusted because the differences are listed, not because the total looks familiar.",
            items: data.variations.map((item) => ({
              label: item.label,
              sub: item.detail,
              pill: item.kind,
              tone: (item.tone === "negative" ? "negative" : item.tone) as PanelTone,
              viewLabel: item.staffId ? "Open" : undefined,
              href: item.staffId ? `/staff-access/directory/${item.staffId}/payments` : undefined,
            })),
            foot: data.variations.length ? undefined : "Nothing has changed since the last run.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table" as const,
            title: "Every payment in this run",
            tag: plural(mapped.length, "payment"),
            sub: "One line per person. Held lines do not pay and do not disappear.",
            meta: hidden ? `${totals.people} on the run · amounts held back` : `${totals.people} on the run · ${nairaShort(totals.net)} net`,
            noun: "payment",
            nounPlural: "payments",
            search: "Find a staff member",
            filters: [
              { label: "Status", value: "All", options: ["All", "Paid", "Awaiting approval", "Approved", "Held", "Draft"], match: Object.fromEntries(["Paid", "Awaiting approval", "Approved", "Held", "Draft"].map((item) => [item, `pay:${item}|`])) },
              { label: "Method", value: "All", options: ["All", "Bank transfer", "Cash · collected at the bursary", "Mobile money"], match: Object.fromEntries(["Bank transfer", "Cash · collected at the bursary", "Mobile money"].map((item) => [item, `method:${item}|`])) },
              { label: "Band", value: "All", options: ["All", ...bandCodes], match: Object.fromEntries(bandCodes.map((code) => [code, `band:${code}|`])) },
            ],
            acts: [{ label: "Release every held payment", drawer: releaseHeldDrawer(held) }, ...(stage === "approval" && !approved ? [{ label: "Approve the run", primary: true, drawer: approveRunDrawer({ people: totals.people, net, month: month.monthName, preparedBy: run?.preparedBy ?? null, variations: data.variations.length }) }] : [])],
            selectable: true,
            bulkActs: [
              { label: "Hold these", drawer: bulkStatusDrawer("Held", "Hold these payments"), selection: { key: "staff", noun: "payment" } },
              { label: "Release these", drawer: bulkStatusDrawer("Awaiting approval", "Release these payments"), selection: { key: "staff", noun: "payment" } },
              { label: "Mark these paid", drawer: bulkStatusDrawer("Paid", "Mark these paid"), selection: { key: "staff", noun: "payment" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Staff member", "Band", "Step", "Net", "Method", "Account", "Status", ""],
            rows: payTable,
            per: 10,
            empty: "Nobody is on this run yet — map staff to a band.",
            foot: "A held payment is visible, counted and waiting — never quietly dropped from the total.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "facts" as const,
            title: "What approving this run does",
            tuck: "What approving the run does",
            sub: "In order, and with the point of no return named.",
            per: 1,
            facts: [
              ["On approval", "The run is locked", "Every awaiting line becomes approved"],
              ["Marking paid", "Line by line, against a reference", "The product records payments; it does not move money"],
              ["Payslips", "Open from each line", "Printable from this page"],
              ["If something is wrong after approval", "An off-cycle correction", "Both the error and the correction stay on the record"],
              ["Who is told", "The Bursar, per the sequence below", "Amounts are held to the people the setup names"],
            ] as PanelFact[],
          },
        ],
      },
      { cols: "1fr", panels: [flowPanel("payrun", data.flow, { title: "How a run is released", sub: "Edit, reorder or remove any stage.", nowIndex: approved ? 3 : stage === "approval" ? 2 : 1 })] },
    ],
  };
}

/* ───────────────────────────── a person's payments ───────────────────────────── */

export function paymentsSection(person: PayPerson, record: StaffRecord, head: Omit<TabContent, "rows">, overview: PayrollOverview): TabContent {
  const row = person.row;
  const mapped = row.state !== "Not mapped";
  const mask = person.mask;
  const map = mapStaffDrawer(overview.rows, overview.bands, { people: [row] });
  const cards: KpiCard[] = [
    { label: "Band and step", value: mapped ? `${row.band} · ${row.step}` : "Not mapped", tone: mapped ? "neutral" : "attention", sub: mapped ? `${row.bandName}${row.stepName ? ` · ${row.stepName}` : ""}` : "Cannot be paid yet", ...(mapped ? {} : { link: "Map them", drawer: map }) },
    { label: "Gross", value: mask ? "Held back" : naira(row.gross), sub: "From the step, not typed" },
    { label: "Allowances", value: mask ? "Held back" : naira(row.allowances), sub: "From the band" },
    { label: "Net this month", value: mask ? "Held back" : naira(row.net), tone: "progress", sub: `${row.state} · ${row.method}` },
    { label: "Payments on record", value: String(person.payments.length), sub: person.offCycle.length ? `${person.offCycle.length} off-cycle` : "None off-cycle" },
  ];
  const payRows: TableRow[] = person.payments.map((item) => ({
    id: item.id,
    cells: [
      text(item.label, { strong: true }),
      text(item.band ? `${item.band} · step ${item.step}` : "—"),
      text(mask ? "Held back" : naira(item.gross), { mono: true }),
      text(mask ? "Held back" : naira(item.net), { mono: true, strong: true }),
      text(item.method ?? "—"),
      pill(item.status, PAY_TONE[item.status] ?? "neutral"),
      text(item.reference ?? (item.paidAt ? dayLabel(item.paidAt) : "—")),
    ],
  }));
  return {
    ...head,
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "What they are paid", sub: person.month.label, per: 5, cards }] },
      {
        cols: "1.5fr 1fr",
        panels: [
          {
            type: "table",
            title: "Payments",
            sub: "Every payment on record, newest first.",
            tag: plural(person.payments.length, "payment"),
            noun: "payment",
            nounPlural: "payments",
            acts: mapped
              ? [{ label: "Payslip", drawer: payslipDrawer(row, person.month.monthName) }, { label: "Move step or band", primary: true, drawer: map }]
              : [{ label: "Map them to a band", primary: true, drawer: map }],
            head: ["Month", "Band and step", "Gross", "Net", "Method", "Status", "Reference"],
            rows: payRows,
            emptyTitle: "No payment on record",
            emptyBody: mapped ? "They will appear here once a run is opened with them on it." : "They are not on a band, so no payment can exist yet.",
            empty: "No payment on record.",
          },
          {
            type: "list",
            title: "Changes to their pay",
            sub: "Every move between bands and steps.",
            items: person.changes.map((change) => ({ label: `${change.from ? `${change.from} → ` : ""}${change.to}`, sub: `${dayLong(change.at)}${change.reason ? ` · ${change.reason}` : ""}`, pill: "Changed", tone: "neutral" as PanelTone })),
            foot: person.changes.length ? undefined : "Their pay has not been changed since it was set.",
          },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "How they are paid",
            per: 1,
            facts: [
              ["Method", row.method, "Set when they were mapped"],
              ["Account", row.method === "Bank transfer" ? "Bank details are held at the bursary" : "Collected at the bursary", "Not stored on the staff record"],
              ["Payslip", record.account === "Never activated" ? "Printed — they have never signed in" : person.setup.payslips],
              ["Unpaid leave this month", row.unpaidDays ? `${row.unpaidDays} ${row.unpaidDays === 1 ? "day" : "days"}` : "None", row.unpaidDays ? "Prorated by working day" : undefined],
            ] as PanelFact[],
            acts: [{ label: "Record an off-cycle payment", drawer: offCycleDrawer([row]) }],
          },
          {
            type: "list",
            title: "Off-cycle payments",
            sub: "Outside the monthly run, each with its reason.",
            items: person.offCycle.map((item) => ({ label: item.kind, sub: `${mask ? "Held back" : naira(item.amount)} · ${dayLabel(item.payOn)} · ${item.reason}`, pill: item.status === "AWAITING_APPROVAL" ? "Awaiting approval" : item.status, tone: "progress" as PanelTone })),
            foot: person.offCycle.length ? undefined : "None recorded.",
          },
        ],
      },
    ],
  };
}
