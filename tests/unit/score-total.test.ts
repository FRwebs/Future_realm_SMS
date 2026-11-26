import { totalOf, type CellValue, type Column } from "../../backend/src/modules/score-results/scores.shared";

const column = (key: string, max: number): Column => ({ key, id: null, code: key.toUpperCase(), name: key, short: key, max, weight: max, exam: false });
// The sheet from the tracker: six assessments of 10 and an exam of 40, out of 100.
const columns = [...["a", "b", "c", "d", "e", "f"].map((key) => column(key, 10)), column("exam", 40)].map((entry) => entry);
const row = (marks: Record<string, CellValue>) => marks;

describe("a child's total on a score sheet", () => {
  it("adds a full row", () => {
    expect(totalOf(columns, row({ a: 8, b: 8, c: 8, d: 8, e: 8, f: 8, exam: 30 })).total).toBe(78);
  });

  it("works an absent assessment out over what was sat, instead of counting it as zero", () => {
    // 8 + 8 + 8 + 8 + 8 + 30 = 70 of the 90 sat → 77.78 of 100, not 70.
    const result = totalOf(columns, row({ a: 8, b: 8, c: "ABS", d: 8, e: 8, f: 8, exam: 30 }));
    expect(result.total).toBe(77.78);
    expect(result.absent).toBe(1);
    expect(result.complete).toBe(true);
  });

  it("gives a child absent for everything no total at all", () => {
    expect(totalOf(columns, row({ a: "ABS", b: "ABS", c: "ABS", d: "ABS", e: "ABS", f: "ABS", exam: "ABS" })).total).toBeNull();
  });

  it("leaves a blank out of the total and does not call the row complete", () => {
    const result = totalOf(columns, row({ a: 8, b: null, c: 8, d: 8, e: 8, f: 8, exam: 30 }));
    expect(result.total).toBe(70);
    expect(result.blank).toBe(1);
    expect(result.complete).toBe(false);
  });
});
