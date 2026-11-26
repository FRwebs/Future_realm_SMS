import { armAverage, studentResults, type ArmData } from "../../backend/src/modules/score-results/arm";

type Row = { id: string; total: number | null };
const subject = (name: string, state: string, totals: Array<number | null>, counts = true) => ({
  name, state, counts,
  rows: totals.map((total, index): Row => ({ id: `s${index + 1}`, total })),
});
const bands = [
  { label: "A", min: 70, max: 100, remark: "", gpa: null },
  { label: "B", min: 60, max: 69.99, remark: "", gpa: null },
  { label: "F", min: 0, max: 59.99, remark: "", gpa: null },
];
const arm = (subjects: ReturnType<typeof subject>[]) => ({
  students: [1, 2, 3].map((n) => ({ id: `s${n}`, name: `Child ${n}`, adm: `A${n}` })),
  subjects,
  bands,
}) as unknown as ArmData;

describe("averages, positions and grades", () => {
  const english = subject("English", "Approved", [80, 70, 60]);
  // One child's single mark of 5 on a sheet nobody has approved, and a full sheet still waiting for a decision.
  const maths = subject("Mathematics", "Submitted", [5, null, null]);
  const science = subject("Science", "Submitted", [10, 10, 10]);

  it("counts only approved sheets, by default", () => {
    const results = studentResults(arm([english, maths, science]));
    expect(results.map((result) => result.average)).toEqual([80, 70, 60]);
    expect(results.map((result) => result.pos)).toEqual([1, 2, 3]);
    expect(results.map((result) => result.grade)).toEqual(["A", "A", "B"]);
  });

  it("gives a child with no approved sheet no average, no position and no grade", () => {
    const results = studentResults(arm([maths, science]));
    expect(results.every((result) => result.average === null && result.pos === null && result.grade === null)).toBe(true);
  });

  it("can still read work in progress when a screen says so plainly", () => {
    const results = studentResults(arm([english, maths]), false);
    expect(results[0]!.average).toBe(42.5);
  });

  it("works out one arm average, from approved sheets only", () => {
    expect(armAverage(arm([english, maths, science]))).toBe(70);
    expect(armAverage(arm([maths, science]))).toBeNull();
  });
});
