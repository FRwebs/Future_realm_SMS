import { addDays, dueText, monday, workPill } from "@/lib/modules/live/student/shared";
import type { Work } from "@/lib/modules/live/student/shared";
import { assignmentsPage, resultsPage, subjectsPage, timetablePage } from "@/lib/modules/live/student/learning";
import { attendancePage, messagesPage } from "@/lib/modules/live/student/school";
import { todayPage } from "@/lib/modules/live/student/today";
import type { Panel } from "@/lib/modules/panels";

const ME = {
  id: "s1", name: "Temi Adeyemi", first: "Temi", admissionNumber: "GFC/1", arm: "SSS 3 - C", classId: "c1", level: "SSS 3", category: null, stream: null, room: null, gender: "FEMALE", dateOfBirth: "2008-04-12", enrolled: "2025-09-05",
  email: "temi@students.school.ng", formMaster: { id: "t1", name: "Boma Hart" }, guardian: null, school: "Greenfield College",
  term: { id: "tm1", name: "Second Term", session: "2025/2026", start: "2026-01-05", end: "2026-04-30", week: 16, weeks: 16, onBreak: false }, today: "2026-04-14", now: "10:05",
};
const work = (over: Partial<Work>): Work => ({
  id: "a1", title: "Homework 1", description: "", subject: "English Language", subjectId: "sub1", teacher: "Kemi Afolayan", teacherId: "u2", set: "2026-04-01", due: "2026-04-13", dueAt: "2026-04-13T12:00:00Z", state: "overdue",
  attachmentUrl: null, handedAt: null, late: false, comment: null, score: null, feedback: null, markedAt: null, ...over,
});
const FIXTURE: Record<string, unknown> = {
  me: ME,
  timetable: {
    slots: [{ day: 2, n: 1, from: "10:00", to: "10:40", kind: "lesson", subject: "Biology", teacher: "Boma Hart", venue: "Lab 1", lab: true }, { day: 2, n: 2, from: "10:40", to: "11:20", kind: "lesson", subject: "Physics", teacher: "Paul Onyeka", venue: "", lab: false }, { day: 2, n: 99, from: "11:20", to: "11:40", kind: "break", subject: "Break", teacher: "", venue: "", lab: false }],
    periods: [{ n: 1, from: "10:00", to: "10:40", kind: "lesson" }, { n: 2, from: "10:40", to: "11:20", kind: "lesson" }, { n: 99, from: "11:20", to: "11:40", kind: "break" }], published: true, exams: [], components: [{ code: "CA", name: "Continuous Assessment", weight: 40, max: 40 }, { code: "EXAM", name: "Exam", weight: 60, max: 60 }],
  },
  subjects: { components: [{ id: "k1", code: "CA", name: "Continuous Assessment", weight: 40, max: 40 }], subjects: [{ id: "sub1", name: "Biology", code: "BIO", core: true, teacher: "Boma Hart", periods: 4, labs: 1, topic: "Cells", open: 1, nextDue: "2026-04-15", late: 0, released: true, parts: [{ code: "CA", name: "Continuous Assessment", max: 40, score: 31 }] }] },
  assignments: { items: [work({}), work({ id: "a2", title: "Essay", state: "todo", due: "2026-04-17" }), work({ id: "a3", title: "Quiz", state: "marked", score: 82, markedAt: "2026-04-10", feedback: "Good" })] },
  attendance: { current: "tm1", terms: [{ id: "tm1", name: "Second Term", session: "2025/2026", start: "2026-01-05", end: "2026-04-30", arm: "SSS 3 - C", days: ["MON", "TUE"] }], records: [{ date: "2026-04-13", status: "PRESENT", term: "tm1", reason: null, code: null, by: "Boma Hart", at: null }, { date: "2026-04-14", status: "ABSENT", term: "tm1", reason: null, code: null, by: "Boma Hart", at: null }], closed: [] },
  calendar: { events: [{ id: "e1", date: "2026-04-15", end: "2026-04-15", title: "Chemistry test", cat: "Assessment", time: "09:00 – 10:00", where: "", note: "" }] },
  messages: { formMaster: { id: "t1", name: "Boma Hart" }, items: [{ id: "m1", cat: "From teachers", from: "Boma Hart", fromId: "t1", role: "teacher", title: "Your essay", body: ["Well done."], at: "2026-04-13T09:00:00Z", read: false, to: "" }] },
  cards: { cards: [{ id: "r1", term: "First Term", session: "2025/2026", arm: "SSS 3 - C", average: 73.6, grade: "B2", position: 1, size: 10, published: "2026-01-02", teacherComment: "Strong term", principalComment: "Keep going", attendance: { present: 18, days: 20 }, subjects: [{ id: "sub1", name: "Biology", total: 68, grade: "B3", position: 5, of: 10, classAverage: 61.2, parts: [{ code: "CA", name: "Continuous Assessment", max: 40, score: 22 }, { code: "EXAM", name: "Exam", max: 60, score: 46 }] }] }] },
  askable: { people: [{ id: "t1", name: "Boma Hart", role: "Form master" }] },
  prefs: { matrix: {}, quiet: "None", remind: "The day before" },
};

vi.mock("@/lib/api/server", () => ({
  apiGet: async (url: string) => {
    const key = url.split("/ws/")[1] ?? "";
    if (!(key in FIXTURE)) throw new Error(`no fixture for ${url}`);
    return FIXTURE[key];
  },
}));

const panels = (content: { rows?: Array<{ panels: Panel[] }> }) => (content.rows ?? []).flatMap((row) => row.panels);

describe("a student’s workspace", () => {
  it("says a piece of work is late in days, and soon in words", () => {
    expect(dueText({ due: "2026-04-11", state: "overdue" }, "2026-04-14")).toBe("3 days late");
    expect(dueText({ due: "2026-04-14", state: "todo" }, "2026-04-14")).toBe("Today");
    expect(dueText({ due: "2026-04-15", state: "todo" }, "2026-04-14")).toBe("Tomorrow");
    expect(workPill(work({ state: "todo", due: "2026-04-15" }), "2026-04-14")).toEqual(["Due tomorrow", "attention"]);
    expect(workPill(work({ state: "marked", score: 82 }), "2026-04-14")).toEqual(["82%", "positive"]);
  });

  it("finds the Monday of any day", () => {
    expect(monday("2026-04-14")).toBe("2026-04-13");
    expect(monday("2026-04-19")).toBe("2026-04-13");
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("opens Today on the lesson running now, with the rest of the day after it", async () => {
    const content = await todayPage();
    const now = panels(content)[0] as Extract<Panel, { type: "embed" }>;
    expect(content.title).toBe("Good morning, Temi");
    expect(now.props).toMatchObject({ live: true, subject: "Biology", label: "Now · Period 1" });
    expect((now.props.later as unknown[]).length).toBe(2);
    expect(content.desc).toContain("due by Friday");
  });

  it("puts late work first and counts what is waiting under each tab", async () => {
    const content = await assignmentsPage({});
    expect(content.tabs?.map((tab) => `${tab.label}:${tab.count}`)).toEqual(["To do:2", "Handed in:0", "Marked:1"]);
    const table = panels(content)[1] as Extract<Panel, { type: "table" }>;
    expect(table.rows[0]!.cells[0]).toMatchObject({ kind: "name", name: "Homework 1" });
    expect(table.rows[0]!.cells[5]).toMatchObject({ kind: "action", label: "Hand in" });
  });

  it("shows a mark as Pending until it is released, never as zero", async () => {
    const content = await subjectsPage();
    const embed = panels(content).find((panel) => panel.type === "embed") as Extract<Panel, { type: "embed" }>;
    const groups = embed.props.groups as Array<{ cards: Array<{ parts: Array<{ pending: boolean; value: string }> }> }>;
    expect(groups[0]!.cards[0]!.parts[0]).toMatchObject({ pending: false, value: "31" });
  });

  it("reads the latest report card back with each subject’s position", async () => {
    const content = await resultsPage({});
    const table = panels(content).find((panel) => panel.type === "table") as Extract<Panel, { type: "table" }>;
    expect(table.head).toEqual(["Subject", "Continuous Assessment · 40", "Exam · 60", "Total", "Grade", "Position", ""]);
    expect(table.rows[0]!.cells[3]).toMatchObject({ kind: "text", text: "68" });
    expect(table.rows[0]!.cells[5]).toMatchObject({ kind: "text", text: "5th" });
  });

  it("draws the timetable from what the school published, and says so when it has not", async () => {
    const content = await timetablePage({});
    expect((panels(content)[0] as Extract<Panel, { type: "embed" }>).component).toBe("student-week");
    FIXTURE.timetable = { ...(FIXTURE.timetable as object), published: false };
    const empty = await timetablePage({});
    expect(panels(empty)[0]!.type).toBe("note");
  });

  it("sorts the inbox by what you have not read", async () => {
    const content = await messagesPage({ tab: "Unread" });
    const inbox = panels(content)[0] as Extract<Panel, { type: "embed" }>;
    expect((inbox.props.messages as unknown[]).length).toBe(1);
    expect(content.tabs?.find((tab) => tab.label === "Unread")?.count).toBe(1);
  });

  it("gives attendance the records and the term they belong to", async () => {
    const content = await attendancePage();
    const embed = panels(content)[0] as Extract<Panel, { type: "embed" }>;
    expect((embed.props.records as unknown[]).length).toBe(2);
    expect(embed.props.current).toBe("tm1");
  });
});
