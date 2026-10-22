import { NOTE_SECTIONS, NOTE_SECTIONS_EY, focusWeek, isShortWeek, lines, noteState, rangeLabel, sectionsFor, statusOf, uiKind, type Term } from "../../backend/src/modules/teacher-workspace/lesson-notes/shared";
import { emptyDraft, stateLabel, stateTone } from "@/lib/modules/lesson-notes-types";

const day = 86_400_000;
const term = (over: Partial<Term> = {}): Term => ({
  id: "t", name: "Second Term", session: "2025/2026", academicSessionId: "s", startsOn: new Date("2026-01-05T00:00:00Z"), endsOn: new Date("2026-04-03T00:00:00Z"), weeks: 13,
  isCurrent: true, phase: "during", current: 4, breakStart: null, breakEnd: null, ...over,
});

describe("a week's status", () => {
  const base = { kind: "teach" as const, override: null, subs: 3, covered: 0 };

  it("follows the calendar until the teacher says otherwise", () => {
    expect(statusOf(term(), 2, base)).toBe("Taught");
    expect(statusOf(term(), 4, base)).toBe("In progress");
    expect(statusOf(term(), 6, base)).toBe("Planned");
    expect(statusOf(term(), 6, { ...base, kind: "rev" })).toBe("Revision");
  });

  it("calls a past week partly taught when only some of it was ticked", () => {
    expect(statusOf(term(), 2, { ...base, covered: 1 })).toBe("Partly taught");
  });

  it("is taught the moment every sub-topic is ticked, even ahead of its week", () => {
    expect(statusOf(term(), 9, { ...base, covered: 3 })).toBe("Taught");
  });

  it("lets what the teacher set beat the calendar and the ticks", () => {
    expect(statusOf(term(), 2, { ...base, override: "Postponed" })).toBe("Postponed");
    expect(statusOf(term(), 6, { ...base, override: "Taught", covered: 0 })).toBe("Taught");
  });

  it("treats a week with nothing planned as free, and a week before the subject starts as not planned", () => {
    expect(statusOf(term(), 3, { ...base, kind: "free" })).toBe("Free week");
    expect(statusOf(term(), 3, { ...base, startWeek: 5 })).toBe("Not planned");
  });

  it("reads every week as past once the term has ended, and none as past before it opens", () => {
    expect(statusOf(term({ phase: "after", current: null }), 12, base)).toBe("Taught");
    expect(statusOf(term({ phase: "before", current: null }), 1, base)).toBe("Planned");
  });

  it("lands a person on the last week once the term is over, and the first before it opens", () => {
    expect(focusWeek(term())).toBe(4);
    expect(focusWeek(term({ phase: "after", current: null }))).toBe(13);
    expect(focusWeek(term({ phase: "before", current: null }))).toBe(1);
  });
});

describe("the weeks of a term", () => {
  it("labels a week by its Monday to Friday", () => {
    expect(rangeLabel(term(), 1)).toMatch(/5.*9 Jan/);
  });

  it("marks the week a mid-term break falls inside as short", () => {
    const t = term({ breakStart: new Date(term().startsOn.getTime() + 4 * 7 * day + 2 * day), breakEnd: new Date(term().startsOn.getTime() + 4 * 7 * day + 6 * day) });
    expect(isShortWeek(t, 5)).toBe(true);
    expect(isShortWeek(t, 4)).toBe(false);
    expect(isShortWeek(term(), 5)).toBe(false);
  });
});

describe("what a scheme row is", () => {
  it("is a free week when no topic is planned, or only the placeholder", () => {
    expect(uiKind("TEACHING", "")).toBe("free");
    expect(uiKind("TEACHING", "Week 3 topic to be planned")).toBe("free");
    expect(uiKind("TEACHING", "Fractions")).toBe("teach");
    expect(uiKind("REVISION", "Revision")).toBe("rev");
  });

  it("reads sub-topics from a list or from lines and semicolons", () => {
    expect(lines(["a ", "", "b"])).toEqual(["a", "b"]);
    expect(lines("a;b\nc")).toEqual(["a", "b", "c"]);
    expect(lines(null)).toEqual([]);
  });
});

describe("where a note stands", () => {
  it("is not started until a draft has something in it", () => {
    expect(noteState(undefined, null)).toBe("Not started");
    expect(noteState("DRAFT", { obj: "  " })).toBe("Not started");
    expect(noteState("DRAFT", { obj: "Learn" })).toBe("Draft");
  });

  it("follows the review, whatever the draft holds", () => {
    expect(noteState("SUBMITTED", { obj: "x" })).toBe("Submitted");
    expect(noteState("RETURNED", {})).toBe("Returned");
    expect(noteState("APPROVED", {})).toBe("Approved");
  });

  it("says what a reader should see, not the column", () => {
    expect(stateLabel("Approved")).toBe("Signed");
    expect(stateLabel("Submitted")).toBe("With the reviewer");
    expect(stateTone("Returned")).toBe("negative");
  });
});

describe("the sections of a note", () => {
  it("are seven for a lesson and six for an early-years week, each requiring objectives, content and evaluation", () => {
    expect(NOTE_SECTIONS).toHaveLength(7);
    expect(NOTE_SECTIONS_EY).toHaveLength(6);
    expect(NOTE_SECTIONS.filter((s) => s.required).map((s) => s.key)).toEqual(["obj", "content", "eval"]);
    expect(NOTE_SECTIONS_EY.filter((s) => s.required).map((s) => s.key)).toEqual(["obj", "content", "eval"]);
  });

  it("switch to the early-years set for an early-years group", () => {
    expect(sectionsFor({ earlyYears: true })).toBe(NOTE_SECTIONS_EY);
    expect(sectionsFor({ earlyYears: false })).toBe(NOTE_SECTIONS);
  });

  it("start an empty week with nothing planned", () => {
    expect(emptyDraft()).toMatchObject({ from: null, kind: "free", topic: "", subtopics: [] });
  });
});

describe("an early-years week as a grid", () => {
  it("is composed into words so every reader — review, history, print — sees the same thing", async () => {
    const { composeGrid, parseGrid, notesHtml } = await import("@/components/modules/lesson-notes/kit");
    const grid = { Monday: { "Circle time": "Meet the animals", Phonics: "s sound" }, Wednesday: { Outdoor: "Animal walk" } };
    expect(composeGrid(grid)).toBe("Monday\n  Circle time: Meet the animals\n  Phonics: s sound\n\nWednesday\n  Outdoor: Animal walk");
    expect(composeGrid({})).toBe("");
    expect(parseGrid("not json")).toEqual({});
    expect(parseGrid(JSON.stringify(grid))).toEqual(grid);
    const html = notesHtml([{ key: "content", label: "Activities", hint: "", placeholder: "", required: true, kind: "week-grid" }], { content: composeGrid(grid), content__grid: JSON.stringify(grid) });
    expect(html).toContain("<table>");
    expect(html).toContain("Meet the animals");
    expect(notesHtml([{ key: "obj", label: "Objectives", hint: "", placeholder: "", required: true }], { obj: "<b>x</b>" })).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("is never counted as a section of its own", async () => {
    const { countWritten } = await import("../../backend/src/modules/teacher-workspace/lesson-notes/shared");
    expect(countWritten({ obj: "a", content: "b", content__grid: "{}", eval: "" })).toBe(2);
  });
});
