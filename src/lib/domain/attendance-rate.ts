/**
 * The one attendance rule: what percentage of a child's counted days they were in school.
 *
 * An excused day is taken out of the count altogether — it is neither a day present nor a day missed — so a child whose only marked day
 * is excused has no rate yet, rather than 0%. A late day counts as present unless the school has chosen otherwise. With nothing to
 * divide the rate is null and a screen shows a dash, never a made-up 0%. The school's register, a child's record, the parent portal and
 * the student portal all read this, so they cannot disagree.
 */

export type AttendanceTally = { present: number; late: number; absent: number; excused: number };

export const emptyAttendanceTally = (): AttendanceTally => ({ present: 0, late: 0, absent: 0, excused: 0 });

/** Counts a list of register marks (PRESENT, LATE, ABSENT, EXCUSED); anything else, a holiday for one, is not a day at school. */
export function tallyMarks(marks: Iterable<string>): AttendanceTally {
  const tally = emptyAttendanceTally();
  for (const mark of marks) {
    if (mark === "PRESENT") tally.present += 1;
    else if (mark === "LATE") tally.late += 1;
    else if (mark === "ABSENT") tally.absent += 1;
    else if (mark === "EXCUSED") tally.excused += 1;
  }
  return tally;
}

/** Counts register marks that arrive already grouped, as { status, count }. */
export function tallyCounts(rows: Iterable<{ status: string; count: number }>): AttendanceTally {
  const tally = emptyAttendanceTally();
  for (const { status, count } of rows) {
    if (status === "PRESENT") tally.present += count;
    else if (status === "LATE") tally.late += count;
    else if (status === "ABSENT") tally.absent += count;
    else if (status === "EXCUSED") tally.excused += count;
  }
  return tally;
}

/** The days that count towards the rate: every marked day except an excused one. */
export const countedDays = (tally: AttendanceTally) => tally.present + tally.late + tally.absent;

/** Days that count as being in school. */
export const daysHere = (tally: AttendanceTally, lateCounts = true) => tally.present + (lateCounts ? tally.late : 0);

export function attendanceRate(tally: AttendanceTally, lateCounts = true): number | null {
  const denominator = countedDays(tally);
  if (!denominator) return null;
  return Math.round((daysHere(tally, lateCounts) / denominator) * 1000) / 10;
}
