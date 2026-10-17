import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { complianceTab } from "@/lib/modules/live/m4-compliance";
import { absenceReasonDrawer, correctRegisterDrawer, spoolDrawer } from "@/lib/modules/live/m4-forms";
import { logTab, trendPage, weekPage } from "@/lib/modules/live/m4-log";
import { markPage, markTab } from "@/lib/modules/live/m4-mark";
import { dayPage, registerTab } from "@/lib/modules/live/m4-register";
import type { Compliance, Day, Log, MarkState, Options, Overview, Policy, Trend, Week } from "@/lib/modules/live/m4-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

const policy: Policy = { markCutoff: "09:30", bell: "08:15", lateCounts: true, target: 92, chronic: 75, watch: 85, minDays: 5, alertDays: 3, alertChannel: "SMS", guardianNotifyAt: "10:00" };
const options: Options = { school: "Greenfield", staff: [{ id: "u1", name: "Paul Onyeka", role: "TEACHER" }], students: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", arm: "JSS 1 A" }], arms: [{ id: "a1", name: "JSS 1 A", master: "Paul Onyeka" }, { id: "a2", name: "JSS 1 B", master: null }] };

const arm = (over: Record<string, unknown> = {}) => ({ id: "a1", name: "JSS 1 A", master: "Paul Onyeka", masterId: "u1", dept: "Sciences", roll: 20, state: "Marked", pastCutoff: false, present: 17, late: 1, absent: 2, excused: 0, rate: 90, markedAt: "07:58", breach: false, termRate: 91, ...over }) as Overview["arms"][number];

const overview = (over: Partial<Overview> = {}): Overview => ({
  date: "2026-04-17", label: "Fri, 17 Apr 2026", today: false, note: "Today is not a school day. Showing the latest day on record.",
  term: { id: "t1", name: "Second Term", start: "2026-01-05", end: "2026-04-30" }, since: "2026-03-23", policy,
  day: { arms: 2, roll: 40, marked: 1, partial: 0, unmarked: 1, pastCutoff: 1, accounted: 20, present: 17, late: 1, absent: 2, excused: 0, rate: 90 },
  arms: [arm(), arm({ id: "a2", name: "JSS 1 B", master: null, masterId: null, state: "Unmarked", pastCutoff: true, present: 0, late: 0, absent: 0, rate: null, markedAt: null })],
  teachers: [{ id: "u1", name: "Paul Onyeka", dept: "Sciences", arms: ["JSS 1 A"], roll: 20, marked: 1, total: 1, punctuality: 80 }],
  unassigned: ["JSS 1 B"], explanations: [], chronic: 0, days: ["2026-04-17", "2026-04-16"], ...over,
});

describe("M4 Register", () => {
  it("says which day it is showing when today is not one the school sat", () => {
    expect(markup(registerTab(overview(), options))).toContain("Showing an earlier day");
  });

  it("calls an unmarked arm unknown, not zero", () => {
    const html = markup(registerTab(overview(), options));
    expect(html).toContain("An unmarked arm is not 0%");
    expect(html).toContain("Unmarked");
  });

  it("names the arms nobody takes a register for", () => {
    const html = markup(registerTab(overview(), options));
    expect(html).toContain("1 arm has no form master");
    expect(html).toContain("Name a form master");
  });

  it("lets a school with no guardian explanations say so", () => {
    expect(markup(registerTab(overview(), options))).toContain("No guardian has sent an absence explanation yet");
  });
});

const day = (over: Partial<Day> = {}): Day => ({
  arm: { id: "a1", name: "JSS 1 A", master: "Paul Onyeka", masterId: "u1", phone: "0803", staffNo: "S-1", dept: null, others: [] },
  date: "2026-04-17", label: "Fri, 17 Apr 2026", isToday: false, isSchoolDay: true, taken: true, register: { state: "ON_TIME", markedAt: "07:58", by: "Paul Onyeka" },
  students: [
    { id: "s1", roll: 1, name: "Ada Obi", adm: "GFC/1", mark: "ABSENT", markLabel: "Absent", markedAt: "07:58", reason: null, reasonCode: null, explained: false, termRate: 70, guardian: null, case: true },
    { id: "s2", roll: 2, name: "Bayo Eze", adm: "GFC/2", mark: "PRESENT", markLabel: "Present", markedAt: "07:58", reason: null, reasonCode: null, explained: true, termRate: 98, guardian: { name: "Mrs Eze", phone: "0805" }, case: false },
    { id: "s3", roll: 3, name: "Chi Ude", adm: "GFC/3", mark: "NONE", markLabel: "Not marked", markedAt: null, reason: null, reasonCode: null, explained: true, termRate: null, guardian: null, case: false },
  ],
  counts: { roll: 2, present: 1, absent: 1, late: 0, excused: 0, unexplained: 1 }, rate: 50, recent: [], termRate: 91, record: { registers: "20 of 20", punctuality: null, corrections: 0 },
  days: [{ date: "2026-04-17", label: "Fri 17 Apr", state: "ON_TIME" }, { date: "2026-04-16", label: "Thu 16 Apr", state: "MISSING" }], policy, term: { id: "t1", name: "Second Term" }, ...over,
});

describe("M4 one arm, one day", () => {
  const correction = { reasons: ["Marked in error"], absenceReasons: ["Illness"], approver: "A. Principal" };

  it("shows every child with the mark the teacher gave, and flags an absence nobody explained", () => {
    const html = markup(dayPage(day(), options, correction).content);
    expect(html).toContain("1 absence on this day has no reason");
    expect(html).toContain("No reason recorded — required by policy");
    expect(html).toContain("Ada Obi");
  });

  it("does not present a child with no mark that day as present", () => {
    const html = markup(dayPage(day(), options, correction).content);
    expect(html).toContain("Not marked");
  });

  it("says plainly when no register was taken", () => {
    const html = markup(dayPage(day({ taken: false, students: [], counts: { roll: 0, present: 0, absent: 0, late: 0, excused: 0, unexplained: 0 } }), options, correction).content);
    expect(html).toContain("No register was taken for JSS 1 A on this day");
    expect(html).not.toContain("The register</h3>");
  });

  it("offers a free correction the same day and an approval-routed one after", () => {
    const sameDay = correctRegisterDrawer({ classId: "a1", arm: "JSS 1 A", date: "2026-04-17", label: "Fri", sameDay: true, students: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", markLabel: "Absent" }], approver: "A. Principal" });
    const later = correctRegisterDrawer({ classId: "a1", arm: "JSS 1 A", date: "2026-04-17", label: "Fri", sameDay: false, students: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", markLabel: "Absent" }], approver: "A. Principal" });
    expect(sameDay.commitLabel).toBe("Correct the register");
    expect(later.commitLabel).toBe("Request the correction");
    expect(later.fields?.some((field) => field.label === "Who decides" && field.kind === "static" && field.value === "A. Principal")).toBe(true);
  });

  it("records a reason for several children at once", () => {
    const drawer = absenceReasonDrawer({ classId: "a1", arm: "JSS 1 A", date: "2026-04-17", label: "Fri", students: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", mark: "Absent" }], pre: ["s1"] });
    expect(drawer.submit?.map?.Children).toBe("students");
    expect(drawer.submit?.body).toEqual({ classId: "a1", date: "2026-04-17" });
  });
});

const markState = (over: Partial<MarkState> = {}): MarkState => ({
  arm: { id: "a1", name: "JSS 1 A", master: "Paul Onyeka" }, date: "2026-04-20", label: "Mon, 20 Apr 2026", term: { id: "t1", name: "Second Term" }, mode: "new", startedAt: null, markedAt: null, backdated: true, canBackdate: true, whyNot: null, editable: true,
  students: [{ id: "s1", roll: 1, name: "Ada Obi", adm: "GFC/1", status: null, reason: "", reasonCode: "", termRate: 90 }], reasons: ["Illness"], policy, since: "2026-03-23", days: ["2026-04-20", "2026-04-17"], ...over,
});

describe("M4 taking a register", () => {
  it("starts with nobody present and says so", () => {
    expect(markup(markPage(markState({ backdated: false })).content)).toContain("Nobody is present until you say so");
  });

  it("explains a backdated register before the form", () => {
    expect(markup(markPage(markState()).content)).toContain("This register is for a day that has passed");
  });

  it("carries the draft and submit endpoints to the grid", () => {
    const panel = markPage(markState()).content.rows.flatMap((row) => row.panels).find((entry) => entry.type === "marker");
    expect(panel && "submitEndpoint" in panel && panel.submitEndpoint).toBe("/api/v1/attendance-management/mark/a1/submit");
  });

  it("chooses the arm first, unmarked ones leading", () => {
    const html = markup(markTab(overview()));
    expect(html).toContain("Choose an arm to mark");
    expect(html.indexOf("JSS 1 B")).toBeLessThan(html.indexOf("JSS 1 A"));
  });
});

const compliance = (over: Partial<Compliance> = {}): Compliance => ({
  date: "2026-04-17", label: "Fri, 17 Apr 2026", today: false, note: null, cutoff: "09:30", term: { id: "t1", name: "Second Term" }, since: "2026-03-23", schoolDays: 20,
  kpis: { unmarked: 1, notYet: 0, week: 3, weekTeachers: 1, term: 6, owed: 40, compliance: 85, repeat: 1, median: null, medianOf: 0 },
  teachers: [{ id: "u1", name: "Paul Onyeka", dept: "Sciences", arms: ["JSS 1 A"], roll: 20, state: "Marked", todayMissing: 0, week: 3, term: 6, owed: 20, punctuality: 70, pattern: "Repeat", breachedWeeks: 3 }],
  tracker: [{ id: "a2", name: "JSS 1 B", roll: 20, owner: "Nobody named", ownerId: null, role: "No form master", state: "Not started", overdue: true, started: null, markedAt: null, late: false }],
  missing: [{ name: "JSS 1 B", days: 20 }], backdated: [{ id: "r1", who: "Paul Onyeka", arm: "JSS 1 A", markedOn: "20 Apr", forDate: "17 Apr", reason: "Network outage" }], unassigned: ["JSS 1 B"], ...over,
});

describe("M4 Compliance", () => {
  it("is about the adults: breaches, repeat breachers and what was backdated", () => {
    const html = markup(complianceTab(compliance(), options));
    expect(html).toContain("Repeat breachers");
    expect(html).toContain("Network outage");
    expect(html).toContain("Repeat");
  });

  it("is honest that marking time is not measured when no register was timed", () => {
    expect(markup(complianceTab(compliance(), options))).toContain("none recorded yet");
  });

  it("says what the median is made of when there is one", () => {
    const html = markup(complianceTab(compliance({ kpis: { ...compliance().kpis, median: 52, medianOf: 9 } }), options));
    expect(html).toContain("52s");
    expect(html).toContain("Across 9 timed registers");
  });
});

const log = (): Log => ({
  term: { id: "t1", name: "Second Term" }, since: "2026-03-23", schoolDays: 20, plannedDays: 81, policy,
  kpis: { rate: 94, best: { id: "a1", name: "JSS 1 A", term: 97 }, worst: { id: "a2", name: "JSS 1 B", master: null, term: 88 }, chronic: 1, closed: 0, formal: 1, corrections: { all: 3, backdated: 1, sameDay: 1, awaiting: 1 } },
  weeks: ["23 Mar", "30 Mar"], trend: [{ id: "a1", name: "JSS 1 A", master: "Paul Onyeka", weeks: [95, null], term: 95, direction: "Steady" }],
  flagged: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", arm: "JSS 1 A", classId: "a1", days: 20, absent: 6, late: 0, excused: 0, rate: 70, flag: "Chronic", case: "OPEN", told: 0, reachable: false }],
  corrections: [{ id: "c1", who: "Paul Onyeka", arm: "JSS 1 A", markedOn: "20 Apr", forDate: "17 Apr", forIso: "2026-04-17", kind: "Prior day", state: "Awaiting", awaiting: true, student: "Bayo Eze", from: "Present", to: "Absent", reasonCode: "Marked in error", explanation: "Wrong row", evidence: false, decidedBy: null, decidedAt: null, decisionNote: null, requestedById: "u1" }],
  backdated: [], roll: 40,
});

describe("M4 Log", () => {
  it("lists a chronic child with a case and says the guardian cannot be reached", () => {
    const html = markup(logTab(log(), options));
    expect(html).toContain("Ada Obi");
    expect(html).toContain("No · no phone number");
    expect(html).toContain("Open case");
  });

  it("shows an unrecorded week as a dash — unknown, not 100%", () => {
    const html = markup(logTab(log(), options));
    expect(html).toContain("it is unknown, not 100%");
  });

  it("puts a correction awaiting a decision where an approver will find it", () => {
    const html = markup(logTab(log(), options));
    expect(html).toContain("Decide");
    expect(html).toContain("Bayo Eze: Present → Absent");
  });

  it("opens a spool for the whole school, arm, child or teacher", () => {
    const drawer = spoolDrawer(options);
    const spool = drawer.fields?.find((field) => field.label === "Spool for");
    expect(spool && spool.kind === "choice" && spool.options).toEqual(["A class arm", "A single student", "A teacher", "The whole school"]);
    expect(drawer.submit?.endpoint).toBe("/api/v1/attendance-management/spool");
  });
});

describe("M4 arm term and week", () => {
  const trend = (): Trend => ({
    arm: { id: "a1", name: "JSS 1 A", master: "Paul Onyeka", masterId: "u1" }, term: { id: "t1", name: "Second Term" }, since: "2026-03-23",
    weeks: [{ n: 1, key: "2026-03-23", label: "Week 1", dates: "23 Mar – 27 Mar", days: 5, rate: 88, absent: 4, late: 1, excused: 0, missed: 1, markers: ["Paul Onyeka"] }], rate: 88, schoolDays: 5,
    best: { label: "Week 1", dates: "23 Mar – 27 Mar", rate: 88 }, worst: { label: "Week 1", dates: "23 Mar – 27 Mar", rate: 88 }, below: 1, missed: 1,
    students: [{ id: "s1", name: "Ada Obi", adm: "GFC/1", days: 5, absent: 2, late: 0, excused: 0, rate: 60, flag: "Chronic", case: "OPEN" }], roll: 20, counts: { chronic: 1, falling: 0, strong: 0 }, policy,
  });

  it("warns that a term below target rests on registers that were never marked", () => {
    const html = markup(trendPage(trend(), options).content);
    expect(html).toContain("below the 92% target in 1 of 1 weeks");
    expect(html).toContain("1 register were never marked");
  });

  it("reads a missed day as unknown on the week page", () => {
    const week: Week = {
      arm: { id: "a1", name: "JSS 1 A", master: "Paul Onyeka", masterId: "u1" }, start: "2026-04-13", label: "13 Apr – 17 Apr 2026", previous: "2026-04-06", next: null,
      days: [{ date: "2026-04-13", name: "Monday", label: "13 Apr", sits: true, unrecorded: false, taken: false, missed: true, roll: 20, present: 0, late: 0, absent: 0, excused: 0, rate: null, markedAt: null, state: "MISSING" }],
      sat: 1, taken: 0, week: { rate: null, absent: 0, late: 0, excused: 0 }, who: [], policy, since: "2026-03-23", term: { id: "t1", name: "Second Term" },
    };
    const html = markup(weekPage(week, options).content);
    expect(html).toContain("Unknown");
    expect(html).toContain("never marked");
    expect(html).toContain("Nobody missed a day this week");
  });
});
