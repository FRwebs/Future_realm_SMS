import { prisma } from "../../../../src/lib/db/prisma";
import { nigerianTermGradeBands } from "../../../../src/lib/domain/grading";
import { armName, fullName } from "../attendance-management/attendance.shared";

export { armName, fullName };

/**
 * What every Score Entry & Results tab reads the same way: the framework a sheet is entered under,
 * how a total becomes a grade, who stands where, and which entries deserve a second look. An absence
 * is never a zero and a blank is never a zero; both stay out of every average, and say so.
 */

export const ABSENT = "ABS";

/** An exam component is recognised wherever it is stored, so every reader of a score classifies it the same way. */
export const isExamCode = (code: string) => code === "EXAM" || /(^|:)EXAM(:|$)/.test(code);

export type Column = {
  /** Unique within a sheet and stable across a framework edit — the cell's address. */
  key: string;
  /** The AssessmentComponent the score is stored against; absent until the first save. */
  id: string | null;
  code: string;
  name: string;
  short: string;
  max: number;
  weight: number;
  exam: boolean;
};

export type Band = { label: string; min: number; max: number; remark: string; gpa: number | null };

const SHORT: Record<string, string> = { ASSIGNMENT: "Assign", CLASSWORK: "Class", TEST_1: "Test 1", TEST_2: "Test 2", PROJECT: "Proj", PRACTICAL: "Pract", EXAM: "Exam", CA: "CA" };
export const shortOf = (code: string, name: string) => SHORT[code] ?? (name.length <= 7 ? name : name.slice(0, 6));

/** The pinned framework a sheet carries, tolerant of the older shape that had no key. */
export function readFramework(value: unknown): Column[] {
  const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  return items.map((item) => {
    const code = String(item.code ?? "");
    const name = String(item.name ?? code);
    const exam = typeof item.exam === "boolean" ? item.exam : isExamCode(code);
    return {
      key: String(item.key ?? code),
      id: (item.id as string | undefined) ?? null,
      code,
      name,
      short: String(item.short ?? shortOf(code.split(":")[1] ?? code, name)),
      max: Number(item.max ?? item.maxScore ?? 100),
      weight: Number(item.weight ?? item.max ?? 100),
      exam
    };
  });
}

export type SectionName = "CRECHE" | "NURSERY" | "PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";

/**
 * The components the school has set for an arm's section this term. These are the columns a sheet is
 * entered under — read from School Configuration, never typed here.
 */
export async function liveFramework(schoolId: string, termId: string, section: SectionName | null): Promise<Column[]> {
  if (!section) return [];
  const rows = await prisma.sectionAssessmentComponent.findMany({ where: { schoolId, section, isActive: true, OR: [{ termId }, { termId: null }] }, orderBy: [{ order: "asc" }] });
  const specific = rows.filter((row) => row.termId === termId);
  const chosen = specific.length ? specific : rows;
  return chosen.map((row) => {
    const exam = row.type === "EXAMINATION";
    return {
      key: `${section}:${exam ? "EXAM" : row.code}:${row.maxScore}`,
      id: null,
      code: row.code,
      name: row.name,
      short: shortOf(row.code, row.name),
      max: row.maxScore,
      weight: row.weight,
      exam
    };
  });
}

/** Finds or creates the stored component each column is saved against. The key doubles as its code. */
export async function ensureColumns(schoolId: string, columns: Column[]): Promise<Column[]> {
  const out: Column[] = [];
  for (const [index, column] of columns.entries()) {
    if (column.id) {
      out.push(column);
      continue;
    }
    const existing = await prisma.assessmentComponent.findUnique({ where: { schoolId_code: { schoolId, code: column.key } } });
    const row = existing ?? (await prisma.assessmentComponent.create({ data: { schoolId, termId: null, name: column.name, code: column.key, weight: column.weight, maxScore: column.max, order: index + 1, isActive: true } }));
    out.push({ ...column, id: row.id });
  }
  return out;
}

export async function loadBands(schoolId: string): Promise<{ bands: Band[]; passMark: number; scheme: string }> {
  const scheme = await prisma.gradingScheme.findFirst({ where: { schoolId, isActive: true }, include: { bands: { orderBy: { minScore: "desc" } } } });
  if (scheme?.bands.length) {
    return { bands: scheme.bands.map((band) => ({ label: band.label, min: band.minScore, max: band.maxScore, remark: band.remark, gpa: band.gpa })), passMark: scheme.passMark, scheme: scheme.name };
  }
  return { bands: nigerianTermGradeBands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark, gpa: band.gpa ?? null })), passMark: 40, scheme: "Nigerian termly A–F" };
}

export function gradeOf(bands: Band[], total: number | null): Band | null {
  if (total === null) return null;
  const rounded = Math.round(total * 100) / 100;
  return bands.find((band) => rounded >= band.min && rounded <= band.max) ?? bands.find((band) => rounded >= band.min) ?? bands[bands.length - 1] ?? null;
}

export const gradeTone = (label: string | null): "positive" | "submitted" | "attention" | "negative" => {
  if (!label) return "negative";
  const first = label[0];
  return first === "A" || first === "B" ? "positive" : first === "C" ? "submitted" : first === "D" || first === "E" ? "attention" : "negative";
};

export const ratingOf = (total: number | null, bands: Band[], passMark: number): string => {
  if (total === null) return "Not scored";
  const band = gradeOf(bands, total);
  if (band && /excellent|very good|good|credit|pass|fair|fail/i.test(band.remark)) return band.remark;
  return total >= 50 ? "Credit" : total >= passMark ? "Pass" : "Fail";
};

export const CREDIT_MARK = 50;

export const round1 = (value: number) => Math.round(value * 10) / 10;
export const round2 = (value: number) => Math.round(value * 100) / 100;
export const mean = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
}

/** Competition ranking: ties share a position, and the next position skips — 1, 2, 2, 4. */
export function rank(items: Array<{ id: string; value: number }>): Map<string, number> {
  const sorted = items.slice().sort((a, b) => b.value - a.value);
  const out = new Map<string, number>();
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    out.set(item.id, previous && previous.value === item.value ? (out.get(previous.id) as number) : index + 1);
  });
  return out;
}

export type CellValue = number | typeof ABSENT | null;

/** A child's row on a sheet: what is entered against each column, and what it adds up to. */
export function totalOf(columns: Column[], cells: Record<string, CellValue>): { total: number | null; blank: number; absent: number; entered: number; complete: boolean } {
  let total = 0;
  let blank = 0;
  let absent = 0;
  let entered = 0;
  for (const column of columns) {
    const value = cells[column.key];
    if (value === undefined || value === null) blank += 1;
    else if (value === ABSENT) absent += 1;
    else {
      total += value;
      entered += 1;
    }
  }
  return { total: entered ? round2(total) : null, blank, absent, entered, complete: blank === 0 && columns.length > 0 };
}

/* ───────────────────────── verification ───────────────────────── */

export type Flag = { key: string; kind: "anomaly" | "duplicate" | "zero" | "boundary"; title: string; detail: string; studentIds: string[]; blocking: boolean };

type FlagRow = { id: string; name: string; cells: Record<string, CellValue>; total: number | null; others: number | null };

/**
 * Things worth a second look before a sheet becomes final. Anomalies, copied rows and a column of
 * zeros each need an outcome recorded; a score one mark under a band boundary is only reported.
 */
export function flagsFor(columns: Column[], rows: FlagRow[], bands: Band[], passMark: number): Flag[] {
  const flags: Flag[] = [];
  for (const row of rows) {
    if (row.total !== null && row.others !== null && Math.abs(row.total - row.others) >= 25) {
      flags.push({ key: `anomaly:${row.id}`, kind: "anomaly", blocking: true, studentIds: [row.id], title: `${row.name} is far from their own pattern`, detail: `${row.total} here against an average of ${round1(row.others)} across their other subjects.` });
    }
  }
  const signature = (row: FlagRow) => columns.map((column) => String(row.cells[column.key] ?? "")).join("|");
  let run: FlagRow[] = [];
  const flush = () => {
    if (run.length >= 5 && signature(run[0]).replace(/\|/g, "").length) {
      flags.push({ key: `duplicate:${run[0].id}`, kind: "duplicate", blocking: true, studentIds: run.map((row) => row.id), title: `${run.length} consecutive children share an identical row`, detail: `${run[0].name} to ${run[run.length - 1].name} all carry ${columns.map((column) => `${column.short} ${row0(run[0], column)}`).join(", ")}.` });
    }
    run = [];
  };
  const row0 = (row: FlagRow, column: Column) => String(row.cells[column.key] ?? "—");
  for (const row of rows) {
    if (run.length && signature(run[0]) === signature(row)) run.push(row);
    else {
      flush();
      run = [row];
    }
  }
  flush();
  for (const column of columns) {
    const zeros = rows.filter((row) => row.cells[column.key] === 0);
    if (zeros.length >= Math.max(3, Math.ceil(rows.length * 0.2))) {
      flags.push({ key: `zero:${column.key}`, kind: "zero", blocking: true, studentIds: zeros.map((row) => row.id), title: `${zeros.length} zeros in ${column.name}`, detail: "A genuine zero, or a blank typed as zero. Absence is entered as A, never as 0." });
    }
  }
  const edges = bands.map((band) => band.min).filter((value) => value > 0).concat(passMark);
  const near = rows.filter((row) => row.total !== null && edges.some((edge) => (row.total as number) >= edge - 1 && (row.total as number) < edge));
  if (near.length) {
    flags.push({ key: "boundary", kind: "boundary", blocking: false, studentIds: near.map((row) => row.id), title: `${near.length} ${near.length === 1 ? "child is" : "children are"} one mark from a band boundary`, detail: near.slice(0, 6).map((row) => `${row.name} ${row.total}`).join(" · ") });
  }
  return flags;
}

export type FlagOutcome = { outcome: string; note: string; by: string; at: string };
export const FLAG_OUTCOMES = ["Checked against the script — correct", "Entry error — corrected", "Sent back to the teacher", "Needs follow-up outside the system"];
