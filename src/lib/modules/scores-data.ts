import { armResults, formMasterOf } from "@/lib/modules/school-data";

/**
 * Score sheets, for the Examination component of Second Term.
 *
 * A sheet is one subject in one arm. The administrator's first question is
 * never "what is in this sheet" — it is "which arms are done, and who is
 * holding the rest up", so the arm is the unit everything is grouped by.
 */

export type SheetState =
  | "Approved"
  | "Submitted"
  | "In progress"
  | "Returned"
  | "Not started"
  | "Blocked";

export type ArmSheetSummary = {
  arm: string;
  formMaster: string;
  /** Sheets received, of those expected for the arm. */
  sheetsIn: number;
  expected: number;
  approved: number;
  flags: number;
  roll: number;
  /** Who the arm is waiting on, or "Nobody named" when no teacher is mapped. */
  pendingFrom: string;
  state: SheetState;
};

/**
 * The arms the mockup calls out by name, with its own figures.
 *
 * Blocked means a sheet cannot exist yet — nobody teaches that subject in that
 * arm, so no score can be entered and no card can compute.
 */
const armSheetSeed: Array<Omit<ArmSheetSummary, "roll" | "formMaster">> = [
  { arm: "JSS 3A", sheetsIn: 8, expected: 9, approved: 6, flags: 0, pendingFrom: "Nobody named", state: "Blocked" },
  { arm: "JSS 3C", sheetsIn: 8, expected: 9, approved: 7, flags: 0, pendingFrom: "Nobody named", state: "Blocked" },
  { arm: "SSS 2A", sheetsIn: 8, expected: 9, approved: 5, flags: 3, pendingFrom: "Mr Samuel Adeyemi", state: "Returned" },
  { arm: "JSS 2B", sheetsIn: 7, expected: 8, approved: 4, flags: 1, pendingFrom: "Mr Ibrahim Danladi", state: "Returned" },
  { arm: "JSS 1A", sheetsIn: 7, expected: 8, approved: 6, flags: 0, pendingFrom: "Mrs Folake Adeniyi", state: "In progress" },
  { arm: "SSS 1B", sheetsIn: 8, expected: 9, approved: 7, flags: 0, pendingFrom: "Mr Sule Bature", state: "In progress" },
  { arm: "JSS 1C", sheetsIn: 8, expected: 8, approved: 8, flags: 0, pendingFrom: "—", state: "Approved" },
  { arm: "SSS 2B", sheetsIn: 9, expected: 9, approved: 9, flags: 0, pendingFrom: "—", state: "Approved" },
  { arm: "SSS 3A", sheetsIn: 9, expected: 9, approved: 7, flags: 1, pendingFrom: "—", state: "Submitted" },
  { arm: "JSS 2A", sheetsIn: 8, expected: 8, approved: 8, flags: 0, pendingFrom: "—", state: "Approved" },
];

export const armSheetSummaries: ArmSheetSummary[] = armSheetSeed.map((entry) => {
  const result = armResults().find((item) => item.arm === entry.arm);
  return {
    ...entry,
    roll: result?.roll ?? 0,
    // JSS 2A is the principal's own form class in the mockup.
    formMaster: entry.arm === "JSS 2A" ? "Adaeze Nwosu" : formMasterOf(entry.arm),
  };
});

export type SubjectSheet = {
  subject: string;
  arm: string;
  teacher: string;
  department: string;
  students: number;
  state: SheetState;
  /** How late, or how long it has sat. */
  age: string;
  overdue?: boolean;
};

/** The sheets the mockup names, with the teacher each one sits with. */
export const subjectSheets: SubjectSheet[] = [
  { subject: "Chemistry", arm: "SSS 2A", teacher: "Mr Samuel Adeyemi", department: "Sciences", students: 34, state: "Returned", age: "9 days late", overdue: true },
  { subject: "Mathematics", arm: "JSS 2B", teacher: "Mr Ibrahim Danladi", department: "Mathematics", students: 31, state: "Returned", age: "6 days late", overdue: true },
  { subject: "Civic Education", arm: "JSS 3A", teacher: "Unassigned", department: "Head of Languages to fill", students: 33, state: "Blocked", age: "34 days", overdue: true },
  { subject: "Civic Education", arm: "JSS 3C", teacher: "Unassigned", department: "Head of Languages to fill", students: 31, state: "Blocked", age: "34 days", overdue: true },
  { subject: "Physics", arm: "SSS 3A", teacher: "Mr Peter Obi", department: "Sciences", students: 22, state: "Submitted", age: "2 days" },
  { subject: "English Language", arm: "JSS 1A", teacher: "Mrs Folake Adeniyi", department: "Languages", students: 29, state: "In progress", age: "1 day" },
  { subject: "French", arm: "JSS 1C", teacher: "Mrs Ngozi Eze", department: "Languages", students: 28, state: "Approved", age: "—" },
  { subject: "Financial Accounting", arm: "SSS 2B", teacher: "Mrs Blessing Uche", department: "Commerce", students: 24, state: "Approved", age: "—" },
];

/** The examination window, as the mockup states it. */
export const examWindow = {
  component: "Examination",
  term: "Second Term",
  expected: 54,
  in: 38,
  approved: 16,
  readyToApprove: 12,
  returned: 7,
  impossible: 2,
  outstanding: 16,
  closed: "22 September",
  daysSinceClose: 4,
};

/** The school's results, computed from the same arm table every module reads. */
export function schoolResults() {
  const results = armResults();
  const roll = results.reduce((total, result) => total + result.roll, 0);
  const computed = results.reduce((total, result) => total + result.computed, 0);
  const blocked = results.reduce((total, result) => total + result.blocked, 0);
  const sorted = [...results].sort((left, right) => right.average - left.average);

  return {
    arms: results.length,
    roll,
    computed,
    blocked,
    average: (results.reduce((total, r) => total + r.average * r.roll, 0) / roll).toFixed(1),
    passRate: Math.round(results.reduce((total, r) => total + r.passRate * r.roll, 0) / roll),
    best: sorted[0]!,
    worst: sorted.at(-1)!,
    incompleteArms: results.filter((result) => result.blocked > 0),
    all: results,
  };
}
