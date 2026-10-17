import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { toCsv } from "@/lib/modules/csv";
import { appraisalTab, roleKpiPage } from "@/lib/modules/live/m7-appraisal";
import { leaveTab } from "@/lib/modules/live/m7-leave";
import { bandDrawer, decideLeaveDrawer, flowStageDrawer, mapStaffDrawer, naira, nairaShort } from "@/lib/modules/live/m7-pay-forms";
import { bandPage, payrollTab, runPage } from "@/lib/modules/live/m7-payroll";
import type { AppraisalOverview, BandDetail, LeaveOverview, LeaveRow, Moderation, PayRow, PayrollOverview } from "@/lib/modules/live/m7-types";
import { PROCESS_FLOWS, flowPlain } from "@/lib/modules/staff-flows";
import { KPI_SET_DEFAULTS, kpiSetFor } from "@/lib/modules/staff-policy";
import type { PanelRow, TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function payRow(over: Partial<PayRow> = {}): PayRow {
  return {
    id: "sp-1", userId: "u-1", name: "Boma Hart", role: "Subject Teacher", department: "Sciences", bandId: "b-1", band: "A2", bandName: "Academic · teaching",
    step: 2, stepName: "Step 2", steps: 5, method: "Bank transfer", state: "Draft", reference: null, statusNote: null, paidAt: null,
    gross: 200880, allowances: 30000, deductions: 42560, net: 188320, slip: null, unpaidDays: 0, mappedAt: null, startsThisMonth: false, ...over,
  };
}

function payroll(over: Partial<PayrollOverview> = {}): PayrollOverview {
  const rows = [payRow(), payRow({ id: "sp-2", name: "Ada Obi", state: "Not mapped", band: null, bandId: null, step: null, gross: null, allowances: null, deductions: null, net: null })];
  return {
    amountsHidden: false,
    month: { month: 10, year: 2026, label: "October 2026", monthName: "October" },
    workingDays: 22,
    setup: { currency: "₦ Nigerian naira", profile: "Nigeria · PAYE, pension 8%, NHF 2.5%", cycle: "Monthly", payDate: "25th", cutoff: "The 20th", approver: "The Proprietor only", payslips: "Portal and email", visibleTo: ["Proprietor", "Bursar"], roundNet: false, holdFinal: true, pensionRate: 8, nhfRate: 2.5 },
    bands: [{ id: "b-1", code: "A2", name: "Academic · teaching", covers: "Form master", coversGroup: "Academic · teaching", steps: 5, low: 186000, high: 253051, staff: 1, allowances: ["Transport"], nextReview: null, isOpen: true }],
    rows,
    totals: { people: 1, of: 2, unmapped: 1, gross: 200880, allowances: 30000, cost: 250000, deductions: 42560, net: 188320, needing: 0 },
    run: null, offCycle: [], flow: PROCESS_FLOWS.payrun.stages, variations: [], ...over,
  };
}

describe("M07 Payroll", () => {
  it("says who is not on a band and offers to map them", () => {
    const html = markup(payrollTab(payroll()));
    expect(html).toContain("1 member of staff is on the directory but not on a band");
    expect(html).toContain("Map them");
  });

  it("holds amounts back from anyone the setup does not name", () => {
    const hidden = payroll({ amountsHidden: true, rows: [payRow({ gross: null, allowances: null, deductions: null, net: null })], totals: { people: 1, of: 1, unmapped: 0, gross: null, allowances: null, cost: null, deductions: null, net: null, needing: 0 } });
    const html = markup(payrollTab(hidden));
    expect(html).toContain("Held back");
    expect(html).not.toContain("200,880");
  });

  it("asks for a first band when none exists", () => {
    const html = markup(payrollTab(payroll({ bands: [] })));
    expect(html).toContain("No pay band exists yet");
  });

  it("sends the ticked people to a bulk status change", () => {
    const tab = payrollTab(payroll());
    const table = tab.rows.flatMap((row) => row.panels).find((panel) => panel.type === "table" && panel.title === "Staff on the payroll");
    expect(table && table.type === "table" ? table.bulkActs?.map((act) => act.selection?.key) : []).toEqual(["staff", "staff", "staff", "staff", undefined]);
  });

  it("only offers a band that is open, and never a step beyond its rungs", () => {
    const drawer = mapStaffDrawer(payroll().rows, [{ ...payroll().bands[0], isOpen: false }]);
    const band = drawer.fields?.find((field) => field.label === "Band");
    expect(band && band.kind === "static").toBe(true);
    expect(bandDrawer().fields?.some((field) => field.label === "Allowances on this band" && field.kind === "lines")).toBe(true);
  });

  it("writes naira in full and in short", () => {
    expect(naira(1250000)).toBe("₦1,250,000");
    expect(nairaShort(3_200_000)).toBe("₦3.2m");
    expect(naira(null)).toBe("Held back");
  });

  it("offers Send for approval until it has been sent, then Approve", () => {
    expect(runPage(payroll()).primary.label).toBe("Send for approval");
    const sent = payroll({ run: { id: "r", status: "DRAFT", stage: "approval", preparedBy: "Tunde Adeyemi", approvedBy: null } });
    expect(runPage(sent).primary.label).toBe("Approve the run");
  });

  it("shows a band's ladder as typed-over cells and refuses a rung below the one under it", () => {
    const detail: BandDetail = {
      band: { id: "b-1", code: "A2", name: "Academic · teaching", covers: "Form master", coversGroup: "Academic · teaching", steps: [{ name: "Step 1", gross: 186000 }, { name: "Step 2", gross: 150000 }], allowances: [], employerPension: 10, nextReview: null, isOpen: true },
      people: [], mask: false, setup: payroll().setup, month: payroll().month,
    };
    const page = bandPage(detail);
    const grid = (page.rows as PanelRow[]).flatMap((row) => row.panels).find((panel) => panel.type === "grid" && panel.title === "The ladder");
    expect(grid && grid.type === "grid" ? grid.rows[1].cells[2].bad : false).toBe(true);
  });
});

function leaveRow(over: Partial<LeaveRow> = {}): LeaveRow {
  return {
    id: "l-1", staffId: "sp-1", userId: "u-1", name: "Boma Hart", role: "Subject Teacher", department: "Sciences", type: "Annual leave", pay: "Paid in full",
    startDate: "2026-10-20", endDate: "2026-10-22", dates: "20 Oct – 22 Oct 2026", days: 3, cover: "Not arranged", coverState: "Not arranged", stage: "Cover check",
    stageWho: "The head of department", stageDoes: "Confirms cover only", sequence: "With you", status: "Waiting", mine: true, source: "REQUEST", reason: "Family", decisionNote: null, createdAt: "2026-10-10", coverRequired: true, ...over,
  };
}

function leave(rows: LeaveRow[]): LeaveOverview {
  return {
    session: "2026/2027", types: [], stages: PROCESS_FLOWS.leave.stages, rows, balances: [],
    kpis: { awayToday: 0, awayNames: [], waiting: rows.filter((row) => row.mine).length, oldestDays: 2, noCover: rows.filter((row) => row.coverState === "Not arranged").length, lost: 0, annualUsedPct: 0, staff: 10 },
  };
}

describe("M07 Leave", () => {
  it("puts the decision on the person whose stage it is, and names cover as the thing at stake", () => {
    const tab = leaveTab(leave([leaveRow()]));
    expect(tab.primary?.label).toBe("Decide the 1 waiting on you");
    expect(markup(tab)).toContain("would leave classes uncovered");
  });

  it("asks a cover check who covers, not for a general note", () => {
    const drawer = decideLeaveDrawer(leaveRow());
    expect(drawer.fields?.some((field) => field.label === "Who covers the classes")).toBe(true);
    const decided = decideLeaveDrawer(leaveRow({ mine: false, status: "Taken" }));
    expect(decided.fields).toBeUndefined();
  });

  it("reads the stages of a sequence in a sentence", () => {
    expect(flowPlain(PROCESS_FLOWS.leave.stages)).toContain("Held by");
    expect(flowPlain([])).toContain("nothing would ever be decided");
  });

  it("builds a stage form that edits in place and one that adds", () => {
    const stages = PROCESS_FLOWS.leave.stages;
    expect(flowStageDrawer("leave", stages, 1).submit?.method).toBe("PUT");
    expect(flowStageDrawer("leave", stages, null).submit?.endpoint).toBe("/api/v1/staff-access/flows/leave/stages");
  });
});

function appraisal(): AppraisalOverview {
  const sets = Object.fromEntries(Object.entries(KPI_SET_DEFAULTS).map(([name, kpis]) => [name, { kpis, changedAt: null, changedBy: null }]));
  return {
    cycle: { name: "Second Term 2025/2026", termId: null, publishedAt: null, publishedBy: null, deadline: null, published: false },
    flow: PROCESS_FLOWS.appraisal.stages, sets,
    roles: [{ role: "Form Master", set: "teaching", kpis: 7, weight: 100, automatic: 5, people: 1, publishable: true }],
    people: [{ id: "sp-1", userId: "u-1", appraisalId: "a-1", name: "Boma Hart", role: "Form Master", department: "Sciences", set: "teaching", stage: "With you", selfScore: 4, mine: null, evidence: 2, reviewer: "Tunde", isReviewer: true }],
    kpis: { published: 1, completed: 1, writing: 0, withMe: 1, average: null },
  };
}

describe("M07 Appraisal", () => {
  const moderation: Moderation = { cycle: "Second Term 2025/2026", reviewed: 0, of: 1, departments: [], managers: [] };

  it("leads with the reviews that have come back", () => {
    const tab = appraisalTab(appraisal(), moderation);
    expect(tab.primary?.label).toBe("Review the 1 that has come back");
    expect(markup(tab)).toContain("Where each person is");
  });

  it("will not let a set whose weights miss 100 pretend to be publishable", () => {
    const data = appraisal();
    data.sets.teaching.kpis = data.sets.teaching.kpis.map((kpi, index) => (index === 0 ? { ...kpi, weight: 10 } : kpi));
    const page = roleKpiPage(data, "Form Master");
    expect(page?.primary.label).toBe("Weights must total 100 to publish");
  });

  it("puts every role on a set, and every default set on exactly 100", () => {
    expect(kpiSetFor("Principal")).toBe("leadership");
    expect(kpiSetFor("Form Master")).toBe("teaching");
    expect(kpiSetFor("Bursar")).toBe("support");
    for (const set of Object.values(KPI_SET_DEFAULTS)) expect(set.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });
});

describe("M07 exports", () => {
  it("quotes what a spreadsheet would split", () => {
    const csv = toCsv(["Name", "Note"], [["Boma, Hart", 'said "yes"'], ["Ada", null]]);
    expect(csv).toContain('"Boma, Hart","said ""yes"""');
    expect(csv.split("\r\n")).toHaveLength(4);
  });
});
