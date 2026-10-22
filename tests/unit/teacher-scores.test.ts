import { suggestionsFor, type StudentResult } from "@/lib/modules/live/t5-scores";

const child = (over: Partial<StudentResult>): StudentResult => ({
  term: { id: "t", name: "Second Term", session: "2025/2026" }, own: true, arm: { id: "a", name: "JSS 2 Gold" }, subject: { id: "s", name: "Mathematics" }, isFormArm: false,
  student: { id: "c", name: "Ada Obi", adm: "A1", index: 0, of: 9 }, peers: [], total: 70, grade: "B", complete: true, absent: 0, blank: 0, ranked: true, pos: 2, of: 9, classMean: 65, last: null, since: null, attendance: 92, band: "Very good",
  components: [
    { key: "CA", name: "CA", short: "CA", max: 40, exam: false, value: 36, classMean: 28, enteredAt: null, enteredBy: null },
    { key: "EXAM", name: "Exam", short: "Exam", max: 60, exam: true, value: 34, classMean: 36, enteredAt: null, enteredBy: null },
  ],
  comment: null, bands: [], ...over,
});

describe("the comment a teacher starts from", () => {
  it("is about the child by first name and the subject, and fits the result", () => {
    const lines = suggestionsFor(child({ total: 82, grade: "A" }));
    expect(lines[0]!.text).toMatch(/^Ada has had an excellent term in Mathematics/);
    expect(lines.every((line) => line.sub === "Fits a A in Mathematics")).toBe(true);
  });

  it("names the examination gap only when class work is clearly ahead of it", () => {
    expect(suggestionsFor(child({})).some((line) => /loses marks in the examination/.test(line.text))).toBe(true);
    expect(suggestionsFor(child({ components: child({}).components.map((component) => ({ ...component, value: component.exam ? 52 : 30 })) })).some((line) => /loses marks in the examination/.test(line.text))).toBe(false);
  });

  it("asks for support when the total is under the pass mark", () => {
    expect(suggestionsFor(child({ total: 31, grade: "F" }))[0]!.text).toMatch(/difficult term/);
  });

  it("says plainly that a result with a blank or an absence is incomplete — and offers nothing about a grade", () => {
    const lines = suggestionsFor(child({ ranked: false, complete: false, total: null, grade: null }));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.sub).toBe("Fits an incomplete result");
  });
});
