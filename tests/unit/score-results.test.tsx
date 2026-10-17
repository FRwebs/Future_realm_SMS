import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { broadsheetPage, enterTab, gridPage, previewPage } from "@/lib/modules/live/m5-enter";
import { decideCorrectionDrawer, decisionDrawer, requestCorrectionDrawer, submitDrawer } from "@/lib/modules/live/m5-forms";
import { armResultPage, resultsTab, studentResultPage } from "@/lib/modules/live/m5-results";
import { armReviewPage, reviewTab, sheetPage } from "@/lib/modules/live/m5-review";
import type { ArmBroadsheet, ArmReview, Chooser, Column, Correction, CorrectionOptions, Grid, ResultsOverview, ReviewOverview, SheetPage, StudentPage } from "@/lib/modules/live/m5-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

const term = { id: "t1", name: "Second Term", session: "2025/2026" };
const columns: Column[] = [
  { key: "CA", id: "c1", code: "CA", name: "Continuous Assessment", short: "CA", max: 40, weight: 40, exam: false },
  { key: "EXAM", id: "c2", code: "EXAM", name: "Exam", short: "Exam", max: 60, weight: 60, exam: true },
];
const bands = [{ label: "A", min: 70, max: 100, remark: "Excellent" }, { label: "F", min: 0, max: 39.99, remark: "Fail" }];
const row = (id: string, name: string, ca: number | "ABS" | null, exam: number | null, total: number | null, over: Record<string, unknown> = {}) => ({ id, name, adm: `GFC/${id}`, cells: { CA: ca, EXAM: exam }, total, blank: ca === null || exam === null ? 1 : 0, absent: ca === "ABS" ? 1 : 0, complete: ca !== null && exam !== null, grade: total === null ? null : total >= 70 ? "A" : "F", rating: total === null ? "Not scored" : total >= 70 ? "Excellent" : "Fail", pos: total === null ? null : 1, standing: "Above the class", ...over });

const grid = (over: Partial<Grid> = {}): Grid => ({
  term, arm: { id: "a1", name: "JSS 2 A", section: "JUNIOR_SECONDARY", level: "JSS 2" }, subject: { id: "sub1", name: "Chemistry", code: "CHE", category: "Sciences", teacher: "Mr Danladi", teacherId: "u1", passMark: 40 }, state: "In progress",
  columns, pinned: true, frameworkAt: "2026-04-01", rows: [{ ...row("1", "Ada Obi", 30, 50, 80), others: 70 }, { ...row("2", "Bayo Eze", "ABS", null, null), others: null }] as Grid["rows"],
  stats: { scored: 1, roll: 2, mean: 80, high: { name: "Ada Obi", total: 80 }, low: { name: "Ada Obi", total: 80 }, passed: 1, failed: 0, armMean: 80, blanks: 1, absences: 1 }, bands, passMark: 40, blocked: null, editable: true, mine: true, enteredBy: ["Mr Danladi"], submittedAt: null, returned: null, windows: [], flags: [], ...over,
});

describe("M5 entering a sheet", () => {
  it("is a grid pinned to the framework the sheet began under", () => {
    const content = gridPage(grid()).content;
    const panel = content.rows.flatMap((entry) => entry.panels).find((entry) => entry.type === "sheet");
    expect(panel && panel.type === "sheet" && panel.columns.map((column) => column.max)).toEqual([40, 60]);
    expect(panel && panel.type === "sheet" && panel.frameworkLabel).toContain("pinned to this sheet");
  });

  it("says why a locked sheet cannot be typed into", () => {
    const content = gridPage(grid({ blocked: "This sheet is approved and final.", editable: false, state: "Approved" })).content;
    const panel = content.rows.flatMap((entry) => entry.panels).find((entry) => entry.type === "sheet");
    expect(panel && panel.type === "sheet" && panel.whyNot).toBe("This sheet is approved and final.");
    expect(panel && panel.type === "sheet" && panel.remove).toBeUndefined();
  });

  it("shows the reason a returned sheet was sent back", () => {
    const html = markup(gridPage(grid({ state: "Returned", returned: { note: "CA and exam are swapped", at: null } })).content);
    expect(html).toContain("This sheet was sent back");
    expect(html).toContain("CA and exam are swapped");
  });

  it("previews every child with a dash for a blank — never a zero", () => {
    const html = markup(previewPage(grid()).content);
    expect(html).toContain("1 child has an unfinished row");
    expect(html).toContain("A dash is blank, not a zero");
    expect(html).toContain("ABS");
  });

  it("states what submitting does before it does it", () => {
    const drawer = submitDrawer(grid());
    expect(drawer.facts?.find(([label]) => label === "After submission")?.[1]).toBe("You can no longer edit it");
    expect(drawer.submit?.endpoint).toBe("/api/v1/score-results/enter/a1/sub1/submit");
  });

  it("will not let a child with no mark be read as zero on the broadsheet", () => {
    const sheet = broadsheetPage({ term, arm: { id: "a1", name: "JSS 2 A" }, subjects: [{ subjectId: "s1", name: "Chemistry", code: "CHE", teacher: "Mr D", state: "Submitted", scored: 1, mean: 80 }], rows: [{ id: "1", name: "Ada Obi", adm: "GFC/1", totals: [null] }], bands });
    const html = markup(sheet.content);
    expect(html).toContain("A dash is a mark nobody has entered");
    expect(html).toContain("1 cells still empty");
  });
});

describe("M5 the chooser", () => {
  const chooser = (over: Partial<Chooser> = {}): Chooser => ({
    term, levels: ["JSS 2"], level: null, arms: [{ id: "a1", name: "JSS 2 A", level: "JSS 2" }], picked: null, subjects: [],
    kpis: { in: 1, expected: 2, outstanding: 1, approved: 0, withTeacher: 0, impossible: 1, impossibleNames: ["Civic JSS 2 A"] },
    outstanding: [{ classId: "a1", arm: "JSS 2 A", subjectId: "s1", subject: "Civic", teacher: null, teacherId: null, state: "Unassigned", roll: 20, entered: 0, scored: 0, mine: false }], unavailable: false, ...over,
  });

  it("names the sheets nobody can enter because nobody teaches them", () => {
    const html = markup(enterTab(chooser()));
    expect(html).toContain("Impossible to enter");
    expect(html).toContain("Civic JSS 2 A have no teacher");
    expect(html).toContain("Assign");
  });

  it("says so when no arm has subjects at all", () => {
    expect(markup(enterTab(chooser({ unavailable: true })))).toContain("No arm has subjects to enter scores for yet");
  });
});

const sheet = (over: Partial<SheetPage> = {}): SheetPage => ({
  term, arm: { id: "a1", name: "JSS 2 A" }, subject: { id: "sub1", name: "Chemistry", category: "Sciences", passMark: 40 }, state: "Submitted", columns, pinned: true, frameworkAt: "2026-04-01",
  teacher: { id: "u1", name: "Mr Danladi", phone: "0803", role: "TEACHER", staffNo: "S-2", dept: "Sciences" }, rows: [row("1", "Ada Obi", 30, 50, 80), row("2", "Bayo Eze", 5, 10, 15)],
  stats: { scored: 2, roll: 2, mean: 47.5, high: { name: "Ada Obi", total: 80 }, low: { name: "Bayo Eze", total: 15 }, passed: 1, failed: 1, armMean: 50 },
  distribution: [{ label: "A", min: 70, max: 100, remark: "Excellent", count: 1 }, { label: "F", min: 0, max: 39.99, remark: "Fail", count: 1 }],
  flags: [{ key: "anomaly:2", kind: "anomaly", title: "Bayo Eze is far from their own pattern", detail: "15 here against 70 elsewhere", studentIds: ["2"], blocking: true, outcome: null }], outcomes: ["Checked against the script — correct"], openFlags: 1,
  decision: { submittedAt: "2026-04-10T10:00:00Z", submittedBy: "Mr Danladi", decidedAt: null, decidedBy: null, note: null, returnedAt: null }, enteredBy: ["Mr Danladi"], corrections: { all: 0, open: 0 }, mine: false, canDecide: true, reversible: false, reverseUntil: null, published: false, cardsWaiting: 2, ...over,
});

describe("M5 deciding a sheet", () => {
  it("makes a flagged sheet name what must be answered before it can be approved", () => {
    const html = markup(sheetPage(sheet(), "Greenfield").content);
    expect(html).toContain("1 verification flag needs an outcome before this can be approved");
    expect(html).toContain("Record outcome");
  });

  it("tells the person who entered it that they cannot approve it", () => {
    const html = markup(sheetPage(sheet({ mine: true, canDecide: false }), "Greenfield").content);
    expect(html).toContain("You entered this sheet, so you cannot approve it");
  });

  it("makes a decline and a rework carry a reason the teacher will read", () => {
    const page = sheet();
    expect(decisionDrawer(page, "decline").submit?.reasonRequired).toBe(true);
    expect(decisionDrawer(page, "rework").submit?.reasonRequired).toBe(true);
    expect(decisionDrawer(page, "approve").submit?.reasonRequired).toBeUndefined();
  });

  it("states the consequence of approving, including how long it can be taken back", () => {
    const facts = decisionDrawer(sheet(), "approve").facts ?? [];
    expect(facts.find(([label]) => label === "Reversible")?.[1]).toBe("For 48 hours");
  });

  it("offers to take an approval back only while that is still possible", () => {
    const decided = sheetPage(sheet({ state: "Approved", canDecide: false, reversible: true, reverseUntil: "2026-04-12T10:00:00Z" }), "G").content;
    expect(decided.primary?.label).toBe("Take the approval back");
    const late = sheetPage(sheet({ state: "Approved", canDecide: false, reversible: false }), "G").content;
    expect(late.primary?.label).toBe("Approved");
  });
});

describe("M5 review", () => {
  const overview = (over: Partial<ReviewOverview> = {}): ReviewOverview => ({
    term, school: "Greenfield", scheme: "A–F", windows: [], closes: null, closedDays: null,
    kpis: { expected: 4, in: 2, outstanding: 2, approved: 1, ready: 1, readyStudents: 20, readyArms: 1, returned: 1, oldestReturned: 9, impossible: 1, impossibleNames: ["Civic JSS 2 A"], past: 2 },
    arms: [{ id: "a1", name: "JSS 2 A", level: "JSS 2", master: "Mrs A", masterId: "u9", sheets: 4, in: 2, approved: 1, flags: 0, roll: 20, pending: ["Mr Danladi"], pendingIds: ["u1"], state: "Returned" }],
    tracker: [{ classId: "a1", subjectId: "s1", unit: "Chemistry · JSS 2 A", sub: "20 children", owner: "Mr Danladi", ownerId: "u1", state: "Returned", age: "9 days", overdue: true }],
    verification: [{ kind: "anomaly", count: 0, found: "", title: "Anomaly detection", what: "Score far from the child's own pattern" }], returned: [{ classId: "a1", subjectId: "s1", name: "Chemistry · JSS 2 A", teacher: "Mr Danladi", teacherId: "u1" }],
    mine: [], readySheets: [{ classId: "a1", subjectId: "s2", name: "Physics · JSS 2 A", roll: 20 }], unavailable: false, ...over,
  });

  it("says how long the oldest returned sheet has been sitting", () => {
    const html = markup(reviewTab(overview()));
    expect(html).toContain("Oldest sitting 9 days");
    expect(html).toContain("1 sheet is returned and waiting on a teacher");
  });

  it("never offers to approve what is not ready", () => {
    const content = reviewTab(overview({ kpis: { ...overview().kpis, ready: 0 }, readySheets: [] }));
    expect(content.primary).toBeUndefined();
  });

  it("leaves a flagged sheet out of a bulk approval and says so", () => {
    const arm: ArmReview = {
      term, arm: { id: "a1", name: "JSS 2 A", level: "JSS 2", master: null }, roll: 20, kpis: { approved: 0, sheets: 1, awaiting: 1, ready: 0, returned: 0, flags: 1, blocked: 20 },
      subjects: [{ subjectId: "s1", name: "Chemistry", teacher: "Mr D", teacherId: "u1", state: "Submitted", scored: 20, roll: 20, entered: "20 of 20", mean: 60, flags: 1, mine: false }], students: [], ready: [], armMean: null, excluded: ["Chemistry · 1 open flags"],
    };
    const html = markup(armReviewPage(arm).content);
    expect(html).toContain("1 submitted sheet left out of a bulk approval");
  });
});

describe("M5 results", () => {
  const arm = (over: Record<string, unknown> = {}) => ({ id: "a1", name: "JSS 2 A", level: "JSS 2", masterId: null, master: "Mrs A", roll: 20, computed: 12, average: 64, pass: 90, credit: 60, top: { grade: "A", name: "Ada Obi" }, incomplete: true, blocked: 8, pending: 1, subjects: 9, ...over }) as ResultsOverview["arms"][number];
  const results = (): ResultsOverview => ({ term, scheme: "A–F", passMark: 40, kpis: { computed: 12, total: 20, average: 64, pass: 90, credit: 60, best: arm(), weakest: arm(), incomplete: 1 }, arms: [arm()], subjects: [], withoutSubjects: 2, blockedArms: ["JSS 2 A"] });
  const options: CorrectionOptions = { reasons: ["Marking error"], subjects: ["Chemistry"], components: ["Exam"], students: [{ id: "1", name: "Ada Obi", adm: "GFC/1", arm: "JSS 2 A" }], routing: "Exam Officer, then the Principal" };
  const correction = (over: Partial<Correction> = {}): Correction => ({ id: "c1", classId: "a1", subjectId: "s1", studentId: "1", arm: "JSS 2 A", subject: "Chemistry", student: "Ada Obi", adm: "GFC/1", component: "Exam", from: 29, to: 51, reason: "Marking error", explanation: "Question 6", evidence: "Script", status: "AWAITING", open: true, reachedParent: false, requestedBy: "Mr D", requestedById: "u1", requestedAt: "2026-04-10", stepOneBy: null, decidedBy: null, decidedAt: null, note: null, effect: { avgBefore: 53, avgAfter: 58, posBefore: 6, posAfter: null }, revision: null, steps: 1, nextStep: 1, ...over });

  it("counts a child as computed only when every subject is in, and says who is not", () => {
    const html = markup(resultsTab(results(), [], options));
    expect(html).toContain("8 students cannot be computed yet");
    expect(html).toContain("None of them is being given a zero");
    expect(html).toContain("Incomplete");
  });

  it("names arms that have children and no subjects instead of dropping them", () => {
    expect(markup(resultsTab(results(), [], options))).toContain("2 arms with children have no subjects offered");
  });

  it("states a correction's consequence before anyone decides it", () => {
    const drawer = decideCorrectionDrawer(correction());
    expect(drawer.facts?.find(([label]) => label === "Effect if approved")?.[1]).toBe("Average 53 → 58");
    expect(drawer.sub).toContain("One approval");
  });

  it("makes a correction to a mark a family already holds a two-step decision", () => {
    const drawer = decideCorrectionDrawer(correction({ reachedParent: true, steps: 2 }));
    expect(drawer.sub).toContain("Step 1 of 2");
    expect(drawer.facts?.find(([label]) => label === "Reached a family?")?.[1]).toBe("Yes");
  });

  it("asks for the corrected mark, the reason and what happened", () => {
    const drawer = requestCorrectionDrawer(options);
    expect(drawer.fields?.map((field) => field.label)).toEqual(expect.arrayContaining(["Child", "Subject", "Component", "Corrected mark", "Reason", "What happened"]));
  });

  it("shows a blocked child on the broadsheet without a total", () => {
    const sheetData: ArmBroadsheet = {
      term, arm: { id: "a1", name: "JSS 2 A", level: "JSS 2", master: "Mrs A" }, summary: arm(), scheme: "A–F", passMark: 40, correctionIds: [],
      subjects: [{ id: "s1", name: "Chemistry", code: "CHE", state: "Submitted", mean: null, pass: null }],
      students: [{ id: "1", name: "Ada Obi", adm: "GFC/1", average: null, grade: null, pos: null, total: 0, ready: false, blockedBy: ["Chemistry · submitted"], totals: [null] }],
    };
    const html = markup(armResultPage(sheetData, [], options).content);
    expect(html).toContain("Blocked");
    expect(html).toContain("never given a zero");
  });

  it("explains a child's result — what was left out and why — from the page itself", () => {
    const student: StudentPage = {
      term, scheme: "A–F", passMark: 40, arm: { id: "a1", name: "JSS 2 A", level: "JSS 2" }, student: { id: "1", name: "Ada Obi", adm: "GFC/1" },
      summary: { average: 62, approvedAverage: null, grade: "B", pos: 3, outOf: 20, levelPos: null, levelOutOf: 0, level: "JSS 2", scored: 1, expected: 2, passed: 1, credits: 1, armAverage: 58, ready: false, blockedBy: ["Physics · submitted"] },
      absences: ["Chemistry"], subjects: [{ subjectId: "s1", name: "Chemistry", state: "Approved", teacher: "Mr D", columns, cells: { CA: 30, EXAM: "ABS" }, total: 30, grade: "F", pos: 5, rating: "Fail", scored: 20, passMark: 40, counts: true }],
      session: { name: "2025/2026", terms: [], average: null, direction: null }, attendance: null, card: null, corrections: [], generated: "", bands: [{ label: "A", min: 70, max: 100, remark: "Excellent", gpa: null }],
    };
    const html = markup(studentResultPage(student, "results", options).content);
    expect(html).toContain("Absent from part of Chemistry");
    expect(html).toContain("never scored zero");
    expect(html).toContain("This child&#x27;s report card is blocked");
    expect(html).toContain("ABS");
  });
});
