/**
 * What a child's row on a score sheet adds up to — one rule, used by the server and by every screen that recomputes as you type, so a
 * preview, a sheet list, a card and a remark page can never rank the same child differently.
 *
 * An absence is not a zero. A child absent for one assessment is judged on the assessments they sat: the marks entered are scaled up to
 * the full marks of the sheet (70 of 90 sat → 77.78 of 100), so being away costs them nothing and gains them nothing. A blank is a mark not
 * yet entered; it stays out of the total, and the row is not complete — and so not ranked — until it is filled or the child is marked absent.
 */

export type ScoreCell = number | "ABS" | null;

export type ScoreTotal = { total: number | null; blank: number; absent: number; entered: number; complete: boolean };

const round2 = (value: number) => Math.round(value * 100) / 100;

export function scoreTotal(columns: Array<{ key: string; max: number }>, cells: Record<string, ScoreCell | undefined>): ScoreTotal {
  let total = 0;
  let blank = 0;
  let absent = 0;
  let entered = 0;
  let sat = 0;
  for (const column of columns) {
    const value = cells[column.key];
    if (value === undefined || value === null) blank += 1;
    else if (value === "ABS") absent += 1;
    else {
      total += value;
      entered += 1;
      sat += column.max;
    }
  }
  const full = columns.reduce((sum, column) => sum + column.max, 0);
  const scaled = absent > 0 && entered > 0 && sat > 0 && full > sat ? total * (full / sat) : total;
  return { total: entered ? round2(scaled) : null, blank, absent, entered, complete: blank === 0 && columns.length > 0 };
}

/** A child is ranked, and counts towards the class statistics, when their row is complete and has a total. */
export const isRanked = (row: { total: number | null; complete: boolean }) => row.complete && row.total !== null;
