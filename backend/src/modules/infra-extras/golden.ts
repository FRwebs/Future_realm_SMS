import { nigerianTermGradeBands } from "../../../../src/lib/domain/grading";
import { gradeOf, rank, totalOf, type Band, type CellValue, type Column } from "../score-results/scores.shared";

const columns: Column[] = [
  { key: "ca1", id: null, code: "CA1", name: "First CA", short: "CA1", max: 10, weight: 10, exam: false },
  { key: "ca2", id: null, code: "CA2", name: "Second CA", short: "CA2", max: 30, weight: 30, exam: false },
  { key: "exam", id: null, code: "EXAM", name: "Examination", short: "Exam", max: 60, weight: 60, exam: true }
];
const bands: Band[] = nigerianTermGradeBands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark, gpa: band.gpa ?? null }));
const cells = (ca1: CellValue, ca2: CellValue, exam: CellValue): Record<string, CellValue> => ({ ca1, ca2, exam });

/**
 * Fixed inputs with known answers, run through the real calculation code. The answers were worked out by hand and
 * written down here; a change to the code that moves one of them is a change to what a child's report card says.
 */
export const GOLDEN_CASES: Array<{ name: string; actual: () => unknown; expected: unknown }> = [
  { name: "A full row adds up to its total", actual: () => totalOf(columns, cells(8, 25, 52)).total, expected: 85 },
  { name: "A blank is never a zero — it stays out of the total", actual: () => { const result = totalOf(columns, cells(8, null, 52)); return [result.total, result.blank, result.complete]; }, expected: [60, 1, false] },
  { name: "An absence is never a zero — it is counted on its own", actual: () => { const result = totalOf(columns, cells(8, "ABS", 52)); return [result.total, result.absent, result.entered]; }, expected: [60, 1, 2] },
  { name: "A row with nothing entered has no total", actual: () => totalOf(columns, cells(null, null, null)).total, expected: null },
  { name: "Totals are held to two decimals", actual: () => totalOf(columns, cells(0.1, 0.2, 0)).total, expected: 0.3 },
  { name: "70 is the bottom of the top band", actual: () => gradeOf(bands, 70)?.label, expected: "A" },
  { name: "Just under a boundary stays in the lower band", actual: () => gradeOf(bands, 69.99)?.label, expected: "B" },
  { name: "Zero is graded, not skipped", actual: () => gradeOf(bands, 0)?.label, expected: "F" },
  { name: "No total means no grade", actual: () => gradeOf(bands, null), expected: null },
  { name: "Ties share a position and the next is skipped", actual: () => { const ranked = rank([{ id: "a", value: 90 }, { id: "b", value: 90 }, { id: "c", value: 80 }, { id: "d", value: 70 }]); return ["a", "b", "c", "d"].map((id) => ranked.get(id)); }, expected: [1, 1, 3, 4] },
  { name: "A framework's weights total exactly 100", actual: () => columns.reduce((sum, column) => sum + column.weight, 0), expected: 100 }
];

export function runGolden() {
  const failures: Array<{ name: string; expected: unknown; actual: unknown }> = [];
  for (const entry of GOLDEN_CASES) {
    let actual: unknown;
    try {
      actual = entry.actual();
    } catch (error) {
      actual = `Threw: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (JSON.stringify(actual) !== JSON.stringify(entry.expected)) failures.push({ name: entry.name, expected: entry.expected, actual });
  }
  return { total: GOLDEN_CASES.length, passed: GOLDEN_CASES.length - failures.length, failures };
}
