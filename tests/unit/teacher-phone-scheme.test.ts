import { phoneScheme } from "@/lib/modules/live/t17-lesson-notes";
import type { Overview, SchemeData } from "@/lib/modules/lesson-notes-types";

const term = { id: "t2", name: "Second Term", session: "2025/2026", current: 9, weeks: 14, phase: "during", isCurrent: true };
const week = (n: number, over: Partial<SchemeData["weeks"][number]> = {}) => ({ week: n, dates: "1 – 5 Sep", short: false, kind: "teach" as const, topic: `Topic ${n}`, subtopics: ["Alpha", "Beta"], covered: [], status: "Planned", auto: "", override: null, assessment: "Quiz", periods: 4, resources: [], evidence: false, note: { state: "", done: 0, of: 0 }, locked: false, ...over });
const card = { subjectId: "s1", subject: "Chemistry", arms: ["SSS 2"], earlyYears: false, readOnly: false, custom: false, per: 4, lessonMinutes: 40, source: null, planned: 12, weeks: 14, taught: 8, teachTotal: 12, signed: 3, toWrite: 1, expected: 8, status: "On schedule", awaitingTimetable: false, schemeStatus: "Approved" };
const overview = { persona: "subject-teacher", term, nextTerm: null, canAdd: true, coverOf: false, subjects: [card] } as unknown as Overview;
const scheme = { subjectId: "s1", subject: "Chemistry", arms: ["SSS 2"], readOnly: false, per: 4, curriculum: "NERDC", term, terms: [term, { ...term, id: "t3", name: "Third Term", current: null }], weeks: [week(1, { status: "Taught" }), week(9), week(10, { kind: "free", topic: "" })] } as unknown as SchemeData;

type Loose = { type: string; props: { chips: Array<{ label: string; on?: boolean }> }; cards: Array<{ value: string }>; items: Array<{ label: string; href?: string; pill?: string; lead?: { value: string } }> };
const panels = (rows: ReturnType<typeof phoneScheme>) => rows.flatMap((entry) => entry.panels as unknown as Loose[]);

describe("the teacher phone's scheme of work", () => {
  it("lists the term's weeks with this week marked and the terms as chips", () => {
    const rows = phoneScheme(overview, scheme, card, false);
    expect(rows.every((entry) => entry.show === "phone")).toBe(true);
    const all = panels(rows);
    expect(all[0]!.props.chips.map((chip) => [chip.label, Boolean(chip.on)])).toEqual([["Second Term", true], ["Third Term", false]]);
    const kpi = all.find((panel) => panel.type === "kpi")!;
    expect(kpi.cards[0].value).toBe("8");
    expect(kpi.cards[1].value).toBe("1");
    const list = all.find((panel) => panel.type === "list")!;
    // A free week with nothing in it is left out; the other two stay, in order.
    expect(list.items.map((item) => [item.lead!.value, item.pill])).toEqual([["W1", "Taught"], ["W9", "This week"]]);
    expect(list.items[1].href).toBe("/lesson-notes/curriculum?subject=s1&term=t2&week=9");
  });

  it("asks a teacher with several subjects to choose one first", () => {
    const rows = phoneScheme({ ...overview, subjects: [card, { ...card, subjectId: "s2", subject: "Physics" }] }, scheme, card, false);
    const list = panels(rows).find((panel) => panel.type === "list")!;
    expect(list.items.map((item) => item.label)).toEqual(["Chemistry", "Physics"]);
    expect(list.items[1].href).toBe("/lesson-notes/curriculum?subject=s2&term=t2");
  });
});
