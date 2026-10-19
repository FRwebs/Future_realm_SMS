import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { DocumentPaper } from "@/components/modules/document-paper";
import { cardPaper } from "@/lib/modules/live/documents";
import { archiveTab } from "@/lib/modules/live/m6-archive";
import { completionArmPage, completionTab } from "@/lib/modules/live/m6-completion";
import { publishDrawer } from "@/lib/modules/live/m6-forms";
import { remarkPage, remarksTab } from "@/lib/modules/live/m6-remarks";
import type { ArchiveOverview, CardView, CompletionArmPage, CompletionOverview, RemarkPage, RemarksOverview } from "@/lib/modules/live/m6-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);
const term = { id: "t1", name: "Second Term", session: "2025/2026" };
const policy = { withholdForDebt: false, reversibleMinutes: 60, minRemark: 15 };

const remarks = (over: Partial<RemarksOverview> = {}): RemarksOverview => ({
  term, levels: ["JSS 1"], level: null, arms: [{ id: "a1", name: "JSS 1 A", level: "JSS 1" }], arm: null, label: "the whole school",
  students: [
    { id: "s1", classId: "a1", arm: "JSS 1 A", name: "Ada Obi", adm: "GFC/1", average: 78, band: "Excellent", attendance: 96, teacher: "Submitted", reviewed: false, state: "Awaiting review" },
    { id: "s2", classId: "a1", arm: "JSS 1 A", name: "Bayo Eze", adm: "GFC/2", average: 44, band: "Weak", attendance: 80, teacher: "Not written", reviewed: false, state: "Remark owed" },
  ],
  tracker: [{ classId: "a1", arm: "JSS 1 A", owner: "Mrs Okoye", ownerId: "u1", written: 1, roll: 2, state: "In progress" }],
  kpis: { students: 2, teacherIn: 1, waiting: 1, reviewed: 0, firstWaiting: { classId: "a1", id: "s1" }, first: { classId: "a1", id: "s1" } },
  publishDate: null, bands: ["Excellent", "Weak"], unavailable: false, school: "Greenfield", owing: [{ id: "u1", name: "Mrs Okoye" }], ...over,
});

const overview = (over: Partial<CompletionOverview> = {}): CompletionOverview => ({
  term, policy, school: "Greenfield", levels: ["JSS 1"],
  arms: [
    { id: "a1", name: "JSS 1 A", level: "JSS 1", master: "Mrs Okoye", masterId: "u1", roll: 2, ready: 1, blocked: 1, owed: 0, inReview: 0, published: 0, withheld: 0, average: 61, state: "Blocked", noPrincipal: 0, unassigned: [] },
    { id: "a2", name: "JSS 1 B", level: "JSS 1", master: null, masterId: null, roll: 2, ready: 2, blocked: 0, owed: 0, inReview: 0, published: 0, withheld: 0, average: 70, state: "Ready", noPrincipal: 0, unassigned: [] },
  ],
  kpis: { cards: 4, ready: 3, clear: 1, arms: 2, blocked: 1, owed: 0, inReview: 0, published: 0, withheld: 0, blockedArms: ["JSS 1 A"], owedArms: 0, noPrincipal: 0 },
  holding: { unassigned: [], unplaced: 0, withoutSubjects: 0 }, publishDate: null, unavailable: false, ...over,
});

describe("M6 Report Cards tabs", () => {
  it("lists every child with their remark state and links to the one-child review", () => {
    const html = markup(remarksTab(remarks(), "Greenfield"));
    expect(html).toContain("Ada Obi");
    expect(html).toContain("Bayo Eze");
    expect(html).toContain("/report-cards/remarks/a1/s1");
  });

  it("holds an arm back as Blocked while one child lacks approved scores", () => {
    const html = markup(completionTab(overview(), "Greenfield"));
    expect(html).toContain("JSS 1 A");
    expect(html).toContain("Blocked");
    expect(html).toContain("/report-cards/completion/a1");
    expect(html).toContain("Nobody named");
  });

  it("offers the whole-school publish only when something is ready, and says how many", () => {
    const some = completionTab(overview(), "Greenfield");
    expect(some.primary?.label).toBe("Publish the 3 ready cards");
    const none = completionTab(overview({ kpis: { ...overview().kpis, ready: 0 } }), "Greenfield");
    expect(none.primary?.drawer).toBeUndefined();
  });

  it("states when no arm has results yet instead of showing an empty table", () => {
    const html = markup(completionTab(overview({ arms: [], unavailable: true, kpis: { ...overview().kpis, cards: 0, ready: 0, arms: 0, clear: 0 } }), "Greenfield"));
    expect(html).toContain("No arm has results to publish yet");
  });

  it("an archive row opens the card as the family received it, and a clean archive says so", () => {
    const archive: ArchiveOverview = {
      terms: [{ id: "t1", name: "Second Term", session: "2025/2026", current: true }], arms: [{ id: "a1", name: "JSS 1 A" }],
      kpis: { issued: 1, sessions: 1, revisions: 0, undelivered: 0, withheld: 0 },
      rows: [{ studentId: "s1", name: "Ada Obi", adm: "GFC/1", classId: "a1", arm: "JSS 1 A", termId: "t1", term: "Second Term 2025/2026", revision: 1, state: "Published", delivery: "Delivered", reference: "GFC1-SEC", published: "2026-04-10" }],
      revisions: [], batches: [], policy: { reversibleMinutes: 60 }, filters: { term: null, arm: null },
    };
    const tab = archiveTab(archive);
    const html = markup(tab);
    // The card opens in its modal over the archive, read from where the paper is kept.
    expect(JSON.stringify(tab)).toContain("/documents/card/s1?term=t1");
    expect(html).toContain("No card has been corrected or reissued.");
  });
});

describe("M6 pages and drawers", () => {
  it("won't offer to publish a child who isn't ready from the arm page's primary action", () => {
    const arm: CompletionArmPage = {
      school: "Greenfield", term, arm: { id: "a1", name: "JSS 1 A", level: "JSS 1" }, policy, master: null, sum: { roll: 1, ready: 0, blocked: 1, owed: 0, inReview: 0, published: 0, withheld: 0 }, state: "Blocked", subjects: { approved: 1, of: 2 },
      children: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", average: null, pos: null, grade: null, scores: false, remark: "Not written", review: false, state: "Blocked", portal: "Not activated", fee: "Settled", withheld: false, blockedBy: ["Chemistry"], revision: 1, published: false }],
      principalWritten: 0, remarksWritten: 0, emails: 0, guardians: 0, publishDate: null,
    };
    const content = completionArmPage(arm, "Greenfield").content;
    expect(content.primary?.drawer).toBeUndefined();
    expect(content.primary?.label).toBe("Nothing is ready to publish yet");
    expect(markup(content)).toContain("Nobody named");
  });

  it("puts the form master's own words on the review page", () => {
    const page = (canReview: boolean): RemarkPage => ({
      school: "Greenfield", term, arm: { id: "a1", name: "JSS 1 A", master: "Mrs Okoye" }, student: { id: "s1", name: "Ada Obi", adm: "GFC/1", first: "Ada" }, position: 1, of: 1, peers: [{ id: "s1", name: "Ada Obi", reviewed: false }], next: null, previous: null,
      summary: { average: 78, band: "Excellent", pos: 1, outOf: 1, grade: "A", armAverage: 78, best: { name: "Maths", total: 90 }, weakest: { name: "Art", total: 60 }, passed: 2, subjects: 2, blocked: false, blockedBy: [], state: "Awaiting review" },
      attendance: { pct: 95, absent: 1, days: 20 }, subjects: [], teacher: { state: "Submitted", text: "A steady term.", by: "Mrs Okoye", role: "Form master · JSS 1 A", when: "1 Apr", onBehalf: false, ownerId: "u1" },
      mine: { state: "Not written", text: "", tone: "Encouraging", flags: [], by: null }, suggestion: "An excellent result.", tones: ["Plain"], flagOptions: [], minRemark: 15, history: [], canWriteFormMaster: false, canReview, published: false, cardState: "Awaiting review",
    });
    expect(markup(remarkPage(page(true), "Greenfield").content)).toContain("A steady term.");
    expect(markup(remarkPage(page(false), "Greenfield").content)).toContain("A steady term.");
  });

  it("states what publishing will skip, child by child", () => {
    const drawer = publishDrawer({ label: "JSS 1 A", ready: 1, total: 3, skipped: [["blocked on scores", 1], ["remarks owed", 1]], scope: { arms: ["a1"] }, reversibleMinutes: 60, withholdForDebt: false, term: "Second Term" });
    expect(drawer.title).toBe("Publish 1 card · JSS 1 A");
    const skipped = drawer.facts?.find(([label]) => label === "Skipped");
    expect(skipped?.[2]).toContain("1 blocked on scores");
    expect(drawer.submit?.body).toEqual({ arms: ["a1"] });
  });
});

describe("M6 report card document", () => {
  const view = (state: CardView["state"]): CardView => ({
    school: { name: "Greenfield College", place: "Abuja", contact: "08000000000" },
    card: {
      studentId: "s1", studentName: "Ada Obi", admissionNumber: "GFC/1", gender: "F", dob: null, className: "JSS 1 A", arm: "A", formMaster: "Mrs Okoye", term: "Second Term", termId: "t1", session: "2025/2026", classId: "a1",
      attendance: { days: 20, present: 19, absent: 1, pct: 95 },
      subjects: [{ subjectId: "m", subject: "Mathematics", teacher: "Mr D", components: [{ name: "CA", short: "CA", max: 40, score: 30 }, { name: "Exam", short: "Exam", max: 60, score: "ABS" }], total: 30, grade: "F", remark: "Weak", pos: 3, outOf: 5, classAvg: 55, caTotal: 30, examTotal: null }],
      total: 30, average: 30, grade: "F", gradeRemark: "Fail", position: 3, outOf: 5, passed: 0, credits: 0, expected: 1,
      classTeacherRemark: "Needs help.", principalRemark: "", classTeacherBy: "Mrs Okoye", principalBy: null, traits: [], resumption: null, issuedAt: null, scheme: "Nigerian 9-point", frameworkNote: "No character record was entered for this term.",
    },
    live: state === "Draft", snapshot: state !== "Draft", state, revision: 1, reference: "GFC1-SEC", published: null, withheldReason: null, delivery: null, revisions: [], peers: [], term, generated: "1 April 2026",
  });

  it("watermarks a draft so it can never be handed out, and not a published card", () => {
    expect(renderToStaticMarkup(<DocumentPaper doc={cardPaper(view("Draft"))} />)).toContain("DRAFT");
    expect(renderToStaticMarkup(<DocumentPaper doc={cardPaper(view("Published"))} />)).not.toContain("DRAFT");
  });

  it("keeps an absence an absence, and an unwritten remark unwritten", () => {
    const html = renderToStaticMarkup(<DocumentPaper doc={cardPaper(view("Published"))} />);
    expect(html).toContain("ABS");
    expect(html).toContain("Not yet written.");
    expect(html).toContain("No character record was entered for this term.");
  });
});
