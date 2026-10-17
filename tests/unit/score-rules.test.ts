import { ABSENT, type Band, type Column, flagsFor, gradeOf, isExamCode, ordinal, rank, ratingOf, readFramework, totalOf } from "../../backend/src/modules/score-results/scores.shared";
import { isExamComponentCode } from "../../src/lib/domain/grading";

const columns: Column[] = [
  { key: "A", id: "a", code: "ASSIGNMENT", name: "Assignment", short: "Assign", max: 10, weight: 10, exam: false },
  { key: "T", id: "t", code: "TEST_1", name: "Test 1", short: "Test 1", max: 10, weight: 10, exam: false },
  { key: "E", id: "e", code: "EXAM", name: "Examination", short: "Exam", max: 40, weight: 40, exam: true },
];
const bands: Band[] = [
  { label: "A", min: 70, max: 100, remark: "Excellent", gpa: null },
  { label: "B", min: 60, max: 69.99, remark: "Very Good", gpa: null },
  { label: "F", min: 0, max: 39.99, remark: "Fail", gpa: null },
];

describe("a child's row", () => {
  it("adds only what was entered, and says what was left", () => {
    const row = totalOf(columns, { A: 8, T: null, E: 30 });
    expect(row.total).toBe(38);
    expect(row.blank).toBe(1);
    expect(row.complete).toBe(false);
  });

  it("never scores an absence as zero", () => {
    const row = totalOf(columns, { A: 8, T: ABSENT, E: 30 });
    expect(row.total).toBe(38);
    expect(row.absent).toBe(1);
    expect(row.complete).toBe(true);
  });

  it("has no total at all when nothing was entered", () => {
    expect(totalOf(columns, { A: null, T: ABSENT, E: null }).total).toBeNull();
  });

  it("keeps a genuine zero as a zero", () => {
    expect(totalOf(columns, { A: 0, T: 0, E: 0 }).total).toBe(0);
  });
});

describe("grades and positions", () => {
  it("names a total on the school's own bands, including the edges", () => {
    expect(gradeOf(bands, 70)?.label).toBe("A");
    expect(gradeOf(bands, 69.99)?.label).toBe("B");
    expect(gradeOf(bands, 0)?.label).toBe("F");
    expect(gradeOf(bands, null)).toBeNull();
  });

  it("rates a child on the band's own word, and says when nothing was scored", () => {
    expect(ratingOf(72, bands, 40)).toBe("Excellent");
    expect(ratingOf(null, bands, 40)).toBe("Not scored");
  });

  it("lets ties share a position and skips the next", () => {
    const ranks = rank([{ id: "a", value: 90 }, { id: "b", value: 80 }, { id: "c", value: 80 }, { id: "d", value: 70 }]);
    expect([ranks.get("a"), ranks.get("b"), ranks.get("c"), ranks.get("d")]).toEqual([1, 2, 2, 4]);
  });

  it("writes an ordinal the way a report card does", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
  });
});

describe("which component is the examination", () => {
  it("recognises the original code and a section's own", () => {
    expect(isExamCode("EXAM")).toBe(true);
    expect(isExamCode("JUNIOR_SECONDARY:EXAM:40")).toBe(true);
    expect(isExamCode("JUNIOR_SECONDARY:TEST_1:10")).toBe(false);
    expect(isExamCode("CA")).toBe(false);
  });

  it("files a score the same way everywhere it is read", () => {
    expect(isExamComponentCode("NURSERY:EXAM:40")).toBe(true);
    expect(isExamComponentCode("EXAM")).toBe(true);
    expect(isExamComponentCode("NURSERY:PROJECT:10")).toBe(false);
  });

  it("reads a sheet pinned before components had keys", () => {
    const pinned = readFramework([{ id: "c1", code: "CA", name: "Continuous Assessment", maxScore: 40, weight: 40 }, { id: "c2", code: "EXAM", name: "Exam", max: 60, weight: 60 }]);
    expect(pinned.map((column) => column.key)).toEqual(["CA", "EXAM"]);
    expect(pinned[1].exam).toBe(true);
    expect(pinned[0].max).toBe(40);
  });
});

describe("verification", () => {
  const row = (id: string, name: string, cells: Record<string, number | null>, total: number | null, others: number | null = null) => ({ id, name, cells, total, others });

  it("flags a score far from the child's own pattern", () => {
    const flags = flagsFor(columns, [row("1", "Ada", { A: 2, T: 2, E: 10 }, 14, 70)], bands, 40);
    expect(flags.find((flag) => flag.kind === "anomaly")?.blocking).toBe(true);
  });

  it("does not judge a child with too few other subjects to compare", () => {
    expect(flagsFor(columns, [row("1", "Ada", { A: 2, T: 2, E: 10 }, 14, null)], bands, 40).filter((flag) => flag.kind === "anomaly")).toHaveLength(0);
  });

  it("flags five consecutive identical rows as a copied sheet", () => {
    const same = ["1", "2", "3", "4", "5"].map((id) => row(id, `Child ${id}`, { A: 7, T: 7, E: 30 }, 44));
    expect(flagsFor(columns, same, bands, 40).some((flag) => flag.kind === "duplicate")).toBe(true);
    expect(flagsFor(columns, same.slice(0, 4), bands, 40).some((flag) => flag.kind === "duplicate")).toBe(false);
  });

  it("flags a column of zeros, but not a lone one", () => {
    const zeros = ["1", "2", "3", "4"].map((id) => row(id, `Child ${id}`, { A: 0, T: 5, E: 20 + Number(id) }, 25));
    expect(flagsFor(columns, zeros, bands, 40).some((flag) => flag.kind === "zero")).toBe(true);
    expect(flagsFor(columns, [zeros[0], ...zeros.slice(1).map((entry) => ({ ...entry, cells: { ...entry.cells, A: 4 } }))], bands, 40).some((flag) => flag.kind === "zero")).toBe(false);
  });

  it("reports a boundary case without blocking anything", () => {
    const flags = flagsFor(columns, [row("1", "Ada", { A: 5, T: 5, E: 29 }, 39)], bands, 40);
    const edge = flags.find((flag) => flag.kind === "boundary");
    expect(edge?.blocking).toBe(false);
  });
});
