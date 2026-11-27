/**
 * What a school keeps, for how long, and on what basis — the schedule every school starts with. It is read by the school's own governance
 * page and by the privacy notice a parent reads, so what a parent is told is the schedule the school actually holds.
 */
export const STANDARD_RETENTION: Array<{
  dataClass: string;
  years: number | null;
  untilAge: number | null;
  basis: string;
}> = [
  { dataClass: "Student academic record", years: null, untilAge: null, basis: "Legitimate interest · a transcript may be requested decades later" },
  { dataClass: "Attendance records", years: 7, untilAge: null, basis: "Education authority requirement" },
  { dataClass: "Financial records", years: 7, untilAge: null, basis: "Tax and audit requirement" },
  { dataClass: "Health and welfare notes", years: null, untilAge: 25, basis: "Explicit consent · sensitive category" },
  { dataClass: "Safeguarding records", years: null, untilAge: 25, basis: "Legal obligation · sensitive category" },
  { dataClass: "Message and delivery logs", years: 2, untilAge: null, basis: "Legitimate interest · dispute resolution" },
  { dataClass: "Audit log", years: 10, untilAge: null, basis: "Legal obligation · immutable" },
];


/** A schedule row in words: "7 years", "Until 25th birthday", or "Permanent". */
export const keptFor = (row: { years: number | null; untilAge: number | null }): string =>
  row.years ? `${row.years} years` : row.untilAge ? `Until the child's ${row.untilAge}th birthday` : "Permanent";
